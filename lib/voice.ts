// TTS multi-provider com fallback.
//
// Hierarquia de qualidade:
//   1. ElevenLabs (se EXPO_PUBLIC_ELEVENLABS_API_KEY existe) — qualidade
//      neural igual ChatGPT, free tier 10k chars/mês
//   2. OpenAI TTS (se EXPO_PUBLIC_OPENAI_API_KEY existe) — mesma engine do ChatGPT
//   3. Web Speech / expo-speech — robótico mas free, fallback final
//
// API pública:
//   await speak("oi anderson");                  // toca a melhor voz disponível
//   stopSpeaking();                              // interrompe qualquer fala
//   const provider = getActiveProvider();        // pra UI mostrar status

import * as Speech from "expo-speech";
import { Platform } from "react-native";

const ELEVENLABS_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const USE_PROXY = process.env.EXPO_PUBLIC_USE_PROXY === "true";
const PROXY_SECRET = process.env.EXPO_PUBLIC_PROXY_SECRET;

// Voice ID + modelo do ElevenLabs. pFZP5JQG7iQjIQuC4Bku = "Lily" (female,
// multilingual, warm — soa bem em pt-BR). Trocar em
// https://elevenlabs.io/app/voice-library. Alternativas femininas boas:
//   EXAVITQu4vr4xnSDxMaL = Bella, XB0fDUnXU5powFXDhCwa = Charlotte
const ELEVENLABS_VOICE_ID = "pFZP5JQG7iQjIQuC4Bku";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";
const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

// Cache LRU simples (text → base64 audio). Evita re-baixar o mesmo texto
// (ex.: o user clica 3x na letra A no glossário) e evita estourar o rate
// limit do ElevenLabs (10k chars/mês free). Limite de 32 entradas.
const audioCache = new Map<string, string>();
const AUDIO_CACHE_LIMIT = 32;

function cacheGet(key: string): string | undefined {
  const v = audioCache.get(key);
  if (v) {
    // LRU touch — re-insere pra ficar no final
    audioCache.delete(key);
    audioCache.set(key, v);
  }
  return v;
}

function cacheSet(key: string, value: string): void {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, value);
  if (audioCache.size > AUDIO_CACHE_LIMIT) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
}

// OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
const OPENAI_VOICE = "nova"; // feminina, soft

type Provider = "elevenlabs" | "openai" | "speech";

export function getActiveProvider(): Provider {
  if (ELEVENLABS_KEY) return "elevenlabs";
  if (OPENAI_KEY) return "openai";
  return "speech";
}

// ─────────────────────────────────────────────────────────────────────────
// Player de áudio cross-platform
// ─────────────────────────────────────────────────────────────────────────

let currentWebAudio: HTMLAudioElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentNativeSound: any | null = null;

async function playFromBase64(b64: string, mime = "audio/mpeg"): Promise<void> {
  if (Platform.OS === "web") {
    stopSpeaking();
    const audio = new Audio(`data:${mime};base64,${b64}`);
    currentWebAudio = audio;
    await audio.play().catch(() => {});
    audio.onended = () => {
      if (currentWebAudio === audio) currentWebAudio = null;
    };
    return;
  }
  try {
    stopSpeaking();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Audio } = require("expo-av");
    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:${mime};base64,${b64}` },
      { shouldPlay: true, volume: 1.0 },
    );
    currentNativeSound = sound;
    sound.setOnPlaybackStatusUpdate((status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (currentNativeSound === sound) currentNativeSound = null;
      }
    });
  } catch {
    // se expo-av falhar, fallback pra Web Speech
    speakFallback(b64);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ElevenLabs
// ─────────────────────────────────────────────────────────────────────────

async function speakElevenLabs(text: string): Promise<boolean> {
  if (!USE_PROXY && !ELEVENLABS_KEY) return false;
  const cacheKey = `${ELEVENLABS_VOICE_ID}::${text}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    await playFromBase64(cached, "audio/mpeg");
    return true;
  }
  try {
    const voiceSettings = {
      stability: 0.55,
      similarity_boost: 0.7,
      style: 0.25,
      use_speaker_boost: true,
    };
    const { LIBRAS_API_URL } = await import("./apiUrl");
    const url = USE_PROXY
      ? `${LIBRAS_API_URL}/api/elevenlabs/tts`
      : `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`;
    const body = USE_PROXY
      ? {
          voiceId: ELEVENLABS_VOICE_ID,
          output_format: ELEVENLABS_OUTPUT_FORMAT,
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: voiceSettings,
        }
      : {
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: voiceSettings,
        };
    const headers: Record<string, string> = USE_PROXY
      ? {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          ...(PROXY_SECRET ? { Authorization: `Bearer ${PROXY_SECRET}` } : {}),
        }
      : {
          "xi-api-key": ELEVENLABS_KEY!,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn("[voice] elevenlabs error", res.status);
      return false;
    }
    const blob = await res.blob();
    const b64 = await blobToBase64(blob);
    cacheSet(cacheKey, b64);
    await playFromBase64(b64, "audio/mpeg");
    return true;
  } catch (err) {
    console.warn("[voice] elevenlabs threw", err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAI TTS
// ─────────────────────────────────────────────────────────────────────────

async function speakOpenAI(text: string): Promise<boolean> {
  if (!OPENAI_KEY) return false;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        voice: OPENAI_VOICE,
        input: text,
        response_format: "mp3",
        speed: 1.0,
      }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const b64 = await blobToBase64(blob);
    await playFromBase64(b64, "audio/mpeg");
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Web Speech / expo-speech (fallback)
// ─────────────────────────────────────────────────────────────────────────

let cachedFallbackVoice: string | null | undefined;

async function detectFallbackVoice(): Promise<string | null> {
  if (cachedFallbackVoice !== undefined) return cachedFallbackVoice;
  try {
    if (Platform.OS === "web") {
      const ss =
        typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!ss) {
        cachedFallbackVoice = null;
        return null;
      }
      let voices = ss.getVoices();
      if (voices.length === 0) {
        await new Promise<void>((resolve) => {
          const h = () => {
            ss.removeEventListener("voiceschanged", h);
            resolve();
          };
          ss.addEventListener("voiceschanged", h);
          setTimeout(resolve, 800);
        });
        voices = ss.getVoices();
      }
      const pt = voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
      pt.sort((a, b) => {
        const aBR = a.lang.toLowerCase() === "pt-br" ? 1 : 0;
        const bBR = b.lang.toLowerCase() === "pt-br" ? 1 : 0;
        if (aBR !== bBR) return bBR - aBR;
        // prefere "Google" / "Natural" / "Premium" sobre default
        const score = (n: string) => {
          if (/natural|premium|enhanced|neural/i.test(n)) return 100;
          if (/google/i.test(n)) return 80;
          if (/microsoft.*maria|microsoft.*helo[ií]sa/i.test(n)) return 70;
          if (/luciana/i.test(n)) return 60;
          return 0;
        };
        return score(b.name) - score(a.name);
      });
      cachedFallbackVoice = pt[0]?.name ?? null;
    } else {
      const voices = await Speech.getAvailableVoicesAsync();
      const pt = voices.filter((v) =>
        v.language.toLowerCase().startsWith("pt"),
      );
      pt.sort((a, b) => {
        const aBR = a.language.toLowerCase() === "pt-br" ? 1 : 0;
        const bBR = b.language.toLowerCase() === "pt-br" ? 1 : 0;
        if (aBR !== bBR) return bBR - aBR;
        const aQ = (a as { quality?: string }).quality === "Enhanced" ? 50 : 0;
        const bQ = (b as { quality?: string }).quality === "Enhanced" ? 50 : 0;
        return bQ - aQ;
      });
      cachedFallbackVoice = pt[0]?.identifier ?? null;
    }
  } catch {
    cachedFallbackVoice = null;
  }
  return cachedFallbackVoice;
}

function speakFallback(text: string): void {
  void (async () => {
    const voice = await detectFallbackVoice();
    try {
      Speech.stop();
      Speech.speak(text, {
        language: "pt-BR",
        rate: 1.0,
        pitch: 1.0,
        voice: voice ?? undefined,
      });
    } catch {
      // ignore
    }
  })();
}

// ─────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────

export async function speak(text: string): Promise<void> {
  const t = text.trim();
  if (!t) return;
  stopSpeaking();
  if (await speakElevenLabs(t)) return;
  if (await speakOpenAI(t)) return;
  speakFallback(t);
}

export function stopSpeaking(): void {
  if (Platform.OS === "web") {
    try {
      if (currentWebAudio) {
        currentWebAudio.pause();
        currentWebAudio.currentTime = 0;
        currentWebAudio = null;
      }
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
  }
  try {
    Speech.stop();
  } catch {
    // ignore
  }
  if (currentNativeSound) {
    try {
      currentNativeSound.unloadAsync();
    } catch {
      // ignore
    }
    currentNativeSound = null;
  }
}

// helpers
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
