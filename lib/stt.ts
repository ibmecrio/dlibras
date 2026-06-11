// Speech-to-Text via AssemblyAI — usado pelo chat de voz e pelo modo professor.
//
// Cross-platform:
//   - Native (iOS/Android): expo-av Audio.Recording → m4a → upload
//   - Web: navigator.mediaDevices.getUserMedia + MediaRecorder → webm/mp4 → upload
//
// API:
//   const r = await startRecording();
//   if (!r.ok) showError(r.reason);
//   // ... user holds button ...
//   const text = await stopAndTranscribe(r.recording);

import { Audio } from "expo-av";
import { Platform } from "react-native";

const ASSEMBLYAI_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
const USE_PROXY = process.env.EXPO_PUBLIC_USE_PROXY === "true";
const PROXY_SECRET = process.env.EXPO_PUBLIC_PROXY_SECRET;
const POLL_INTERVAL_MS = 800;
const MAX_POLL_ATTEMPTS = 60; // ~48s timeout

async function getAssemblyBaseUrl(): Promise<string> {
  if (!USE_PROXY) return "https://api.assemblyai.com/v2";
  const { LIBRAS_API_URL } = await import("./apiUrl");
  return `${LIBRAS_API_URL}/api/assemblyai`;
}

function authHeaders(): Record<string, string> {
  if (USE_PROXY) {
    return PROXY_SECRET ? { Authorization: `Bearer ${PROXY_SECRET}` } : {};
  }
  return { Authorization: ASSEMBLYAI_KEY ?? "" };
}

let permissionsAsked = false;

// ─────────────────────────────────────────────────────────────────────────
// Handle unificado
// ─────────────────────────────────────────────────────────────────────────

export type RecordingHandle =
  | { kind: "native"; recording: Audio.Recording }
  | {
      kind: "web";
      recorder: MediaRecorder;
      stream: MediaStream;
      chunks: Blob[];
      mime: string;
    };

export type StartRecordingResult =
  | { ok: true; recording: RecordingHandle }
  | { ok: false; reason: string };

// ─────────────────────────────────────────────────────────────────────────
// Permissão (native) / contexto seguro (web)
// ─────────────────────────────────────────────────────────────────────────

export async function ensureMicPermission(): Promise<{
  granted: boolean;
  reason?: string;
}> {
  if (Platform.OS === "web") return ensureMicPermissionWeb();
  return ensureMicPermissionNative();
}

async function ensureMicPermissionWeb(): Promise<{
  granted: boolean;
  reason?: string;
}> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      granted: false,
      reason: "Seu navegador não suporta captura de microfone.",
    };
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const localhost = ["localhost", "127.0.0.1", "::1"].includes(host);
    if (!window.isSecureContext && !localhost) {
      return {
        granted: false,
        reason:
          "Microfone só funciona em localhost ou HTTPS. Abra http://localhost:8081 no navegador.",
      };
    }
  }
  // getUserMedia vai abrir o prompt nativo do browser na hora de startRecording.
  return { granted: true };
}

async function ensureMicPermissionNative(): Promise<{
  granted: boolean;
  reason?: string;
}> {
  try {
    const current = await Audio.getPermissionsAsync();
    if (current.granted) {
      await setupAudioMode();
      return { granted: true };
    }
    if (!current.canAskAgain && permissionsAsked) {
      return {
        granted: false,
        reason:
          "Permissão negada anteriormente. Abra Configurações do app e habilite o microfone.",
      };
    }
    permissionsAsked = true;
    const result = await Audio.requestPermissionsAsync();
    if (result.granted) {
      await setupAudioMode();
      return { granted: true };
    }
    return {
      granted: false,
      reason: result.canAskAgain
        ? "Você precisa permitir o microfone pra falar com a Bia."
        : "Permissão de microfone negada. Habilite em Configurações → Expo Go → Microphone.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stt] permission error", msg);
    return { granted: false, reason: `Erro: ${msg}` };
  }
}

async function setupAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  } catch (err) {
    console.warn("[stt] setAudioModeAsync failed", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// startRecording
// ─────────────────────────────────────────────────────────────────────────

export async function startRecording(): Promise<StartRecordingResult> {
  const perm = await ensureMicPermission();
  if (!perm.granted) {
    return {
      ok: false,
      reason: perm.reason ?? "Sem permissão de microfone.",
    };
  }
  return Platform.OS === "web" ? startRecordingWeb() : startRecordingNative();
}

async function startRecordingNative(): Promise<StartRecordingResult> {
  try {
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    await recording.startAsync();
    console.log("[stt] native recording started");
    return { ok: true, recording: { kind: "native", recording } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stt] startRecording native failed", msg);
    return {
      ok: false,
      reason: `Não consegui iniciar gravação: ${msg}`,
    };
  }
}

async function startRecordingWeb(): Promise<StartRecordingResult> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickWebMime();
    const recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime } : undefined,
    );
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    // Timeslice 100ms — força emissão periódica de chunks, garantindo que
    // mesmo gravações muito curtas (< 500ms) tenham dados quando paradas.
    recorder.start(100);
    console.log("[stt] web recording started, mime:", recorder.mimeType);
    return {
      ok: true,
      recording: {
        kind: "web",
        recorder,
        stream,
        chunks,
        mime: recorder.mimeType || mime || "audio/webm",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stt] startRecording web failed", msg);
    return {
      ok: false,
      reason:
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permissão de microfone negada no navegador. Clique no ícone de cadeado da URL e libere."
          : `Não consegui acessar o microfone: ${msg}`,
    };
  }
}

function pickWebMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported?.(c)) return c;
    } catch {
      // ignore
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────
// stopAndTranscribe
// ─────────────────────────────────────────────────────────────────────────

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export async function stopAndTranscribe(
  handle: RecordingHandle,
): Promise<string | null> {
  const r = await stopAndTranscribeDetailed(handle);
  return r.ok ? r.text : null;
}

// Versão com detalhes de erro pra UI mostrar feedback claro.
export async function stopAndTranscribeDetailed(
  handle: RecordingHandle,
): Promise<TranscribeResult> {
  if (!USE_PROXY && !ASSEMBLYAI_KEY) {
    return {
      ok: false,
      reason: "AssemblyAI API key não configurada (EXPO_PUBLIC_ASSEMBLYAI_API_KEY).",
    };
  }
  try {
    const audioBlob =
      handle.kind === "web"
        ? await stopWebRecording(handle)
        : await stopNativeRecording(handle);
    if (!audioBlob || audioBlob.size === 0) {
      console.warn("[stt] blob vazio", { kind: handle.kind });
      return {
        ok: false,
        reason: "Gravação ficou vazia. Segure o botão por pelo menos 1 segundo.",
      };
    }
    console.log("[stt] blob size:", audioBlob.size, "type:", audioBlob.type);

    const base = await getAssemblyBaseUrl();
    const upload = await fetch(`${base}/upload`, {
      method: "POST",
      headers: authHeaders(),
      body: audioBlob,
    });
    if (!upload.ok) {
      const body = await upload.text().catch(() => "");
      console.warn("[stt] upload error", upload.status, body.slice(0, 200));
      return {
        ok: false,
        reason: `Falha no upload (HTTP ${upload.status}). Verifica conexão e a key da AssemblyAI.`,
      };
    }
    const { upload_url } = (await upload.json()) as { upload_url: string };

    const tx = await fetch(`${base}/transcript`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: "pt",
        speech_model: "best",
      }),
    });
    if (!tx.ok) {
      const body = await tx.text().catch(() => "");
      console.warn("[stt] transcript create error", tx.status, body.slice(0, 200));
      return {
        ok: false,
        reason: `Falha criando transcrição (HTTP ${tx.status}).`,
      };
    }
    const { id } = (await tx.json()) as { id: string };

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const r = await fetch(`${base}/transcript/${id}`, {
        headers: authHeaders(),
      });
      const data = (await r.json()) as {
        status: string;
        text?: string;
        error?: string;
      };
      if (data.status === "completed") {
        return { ok: true, text: data.text ?? "" };
      }
      if (data.status === "error") {
        console.warn("[stt] transcript error", data.error);
        return {
          ok: false,
          reason: `AssemblyAI retornou erro: ${data.error ?? "desconhecido"}`,
        };
      }
    }
    return { ok: false, reason: "Transcrição demorou demais (timeout 48s)." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stt] threw", msg);
    return { ok: false, reason: `Erro: ${msg}` };
  }
}

async function stopNativeRecording(handle: {
  kind: "native";
  recording: Audio.Recording;
}): Promise<Blob | null> {
  try {
    await handle.recording.stopAndUnloadAsync();
  } catch {
    // já parada
  }
  const uri = handle.recording.getURI();
  if (!uri) return null;
  const fileRes = await fetch(uri);
  return await fileRes.blob();
}

async function stopWebRecording(handle: {
  kind: "web";
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  mime: string;
}): Promise<Blob> {
  return new Promise((resolve) => {
    const finish = () => {
      try {
        handle.stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      resolve(new Blob(handle.chunks, { type: handle.mime || "audio/webm" }));
    };
    if (handle.recorder.state === "inactive") {
      finish();
      return;
    }
    handle.recorder.onstop = finish;
    handle.recorder.onerror = finish;
    try {
      handle.recorder.stop();
    } catch {
      finish();
    }
  });
}

// Cancela a gravação sem transcrever (libera mic/stream).
export async function cancelRecording(handle: RecordingHandle): Promise<void> {
  try {
    if (handle.kind === "web") {
      handle.stream.getTracks().forEach((t) => t.stop());
      if (handle.recorder.state !== "inactive") handle.recorder.stop();
    } else {
      await handle.recording.stopAndUnloadAsync().catch(() => {});
    }
  } catch {
    // ignore
  }
}
