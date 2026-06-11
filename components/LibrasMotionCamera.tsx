import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { speak as ttsSpeak, stopSpeaking } from "@/lib/voice";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ConfidenceBar } from "@/components/ConfidenceBar";
import { colors, useThemeColors } from "@/constants/theme";
import { LIBRAS_API_URL } from "@/lib/apiUrl";
import { playMatchChime } from "@/lib/audio";
import { cardShadow } from "@/lib/styles";
import { useLearningStore } from "@/store/learningStore";

function detectWebInsecureCameraHost(): { blocked: boolean; localhostUrl: string | null } {
  if (Platform.OS !== "web") return { blocked: false, localhostUrl: null };
  if (typeof window === "undefined") return { blocked: false, localhostUrl: null };
  const isSecure = window.isSecureContext;
  const host = window.location.hostname;
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (isSecure || isLocalhost) return { blocked: false, localhostUrl: null };
  const localhostUrl = `${window.location.protocol}//localhost:${window.location.port || "8081"}${window.location.pathname}${window.location.search}`;
  return { blocked: true, localhostUrl };
}

// Câmera pra letras COM movimento (J, Z). Estratégia: grava ~1.5s de frames,
// manda o lote pro endpoint /predict-motion do FastAPI que usa MediaPipe pra
// extrair landmarks por frame e aplica heurísticas de trajetória.
// É aproximação — modelo de sequência treinado (LSTM) entrega muito melhor.

const RECORD_DURATION_MS = 1500;
const RECORD_FPS = 8;
const FRAME_INTERVAL_MS = Math.floor(1000 / RECORD_FPS);

// Tenta `/predict-motion-v2` (LSTM treinado) primeiro. Se 404 / 500 /
// modelo não carregado no server, cai pra `/predict-motion` (heurística).
// Decisão é feita uma vez por sessão e cacheada em memória.
let preferredMotionEndpoint: "/predict-motion-v2" | "/predict-motion" | null = null;

async function chooseMotionEndpoint(): Promise<string> {
  if (preferredMotionEndpoint !== null) return preferredMotionEndpoint;
  try {
    const res = await fetch(`${LIBRAS_API_URL}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      const motionStatus = data?.motion_model?.status;
      preferredMotionEndpoint =
        motionStatus === "loaded" ? "/predict-motion-v2" : "/predict-motion";
    } else {
      preferredMotionEndpoint = "/predict-motion";
    }
  } catch {
    preferredMotionEndpoint = "/predict-motion";
  }
  return preferredMotionEndpoint;
}

type MotionResult = {
  letter: string | null;
  confidence: number;
  match: boolean | null;
  has_hand_in_frames: number;
  total_frames: number;
  detected_motion: string;
};

interface LibrasMotionCameraProps {
  target: string;
  hint: string;
  onMatch?: (letter: string) => void;
}

type RecordingState = "idle" | "recording" | "uploading" | "done";

export function LibrasMotionCamera({
  target,
  hint,
  onMatch,
}: LibrasMotionCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [state, setState] = useState<RecordingState>("idle");
  const [result, setResult] = useState<MotionResult | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const matchedRef = useRef(false);
  // recordingRef faz o guard contra double-tap mesmo que o setState ainda não
  // tenha refletido; usar só `state` permitia 2 clicks rápidos passarem.
  const recordingRef = useRef(false);
  // mountedRef bloqueia setStates depois que o usuário sai durante o upload.
  const mountedRef = useRef(true);
  const audioEnabled = useLearningStore((s) => s.audioFeedbackEnabled);
  const audioEnabledRef = useRef(audioEnabled);
  const themeColors = useThemeColors();
  const isDark = themeColors.neutral.background !== "#ffffff";

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    matchedRef.current = false;
    setResult(null);
    setState("idle");
  }, [target]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        stopSpeaking();
      } catch {}
    };
  }, []);

  const safeSet = useCallback(
    <T,>(setter: (v: T) => void, value: T) => {
      if (mountedRef.current) setter(value);
    },
    [],
  );

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recordingRef.current) return;
    recordingRef.current = true;
    safeSet(setState, "recording" as RecordingState);
    safeSet(setResult, null);
    const frames: string[] = [];
    const start = Date.now();
    while (Date.now() - start < RECORD_DURATION_MS && mountedRef.current) {
      const frameStart = Date.now();
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
          skipProcessing: Platform.OS === "web",
          shutterSound: false,
          exif: false,
        });
        if (photo?.base64) frames.push(photo.base64);
      } catch {
        // ignore frame errors
      }
      const elapsed = Date.now() - frameStart;
      if (elapsed < FRAME_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS - elapsed));
      }
    }
    if (!mountedRef.current) {
      recordingRef.current = false;
      return;
    }
    if (frames.length < 4) {
      recordingRef.current = false;
      safeSet(setState, "idle" as RecordingState);
      safeSet(setResult, {
        letter: null,
        confidence: 0,
        match: false,
        has_hand_in_frames: 0,
        total_frames: frames.length,
        detected_motion: "frames_insuficientes",
      });
      return;
    }
    safeSet(setState, "uploading" as RecordingState);
    try {
      const endpoint = await chooseMotionEndpoint();
      const res = await fetch(`${LIBRAS_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, target }),
      });
      const data: MotionResult = await res.json();
      if (!mountedRef.current) return;
      safeSet(setResult, data);
      safeSet(setState, "done" as RecordingState);
      if (data.match && !matchedRef.current) {
        matchedRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (audioEnabledRef.current) {
          playMatchChime().catch(() => {});
        }
        try {
          void ttsSpeak(target);
        } catch {}
        onMatch?.(target);
      }
    } catch {
      if (!mountedRef.current) return;
      safeSet(setState, "idle" as RecordingState);
      safeSet(setResult, {
        letter: null,
        confidence: 0,
        match: false,
        has_hand_in_frames: 0,
        total_frames: frames.length,
        detected_motion: "erro_de_rede",
      });
    } finally {
      recordingRef.current = false;
    }
  }, [target, onMatch, safeSet]);

  if (!permission) {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: themeColors.neutral.surface },
        ]}
      >
        <ActivityIndicator color={themeColors.primary.purple} />
      </View>
    );
  }

  if (!permission.granted) {
    const insecure = detectWebInsecureCameraHost();
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: themeColors.neutral.surface },
        ]}
      >
        <Text
          style={[
            styles.fallbackTitle,
            { color: themeColors.neutral.textPrimary },
          ]}
        >
          Câmera bloqueada
        </Text>
        {insecure.blocked && insecure.localhostUrl ? (
          <>
            <Text
              style={{
                textAlign: "center",
                color: isDark ? themeColors.semantic.warning : "#b45309",
                fontFamily: "Poppins-Regular",
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              Browser bloqueia câmera em IPs da rede. Abra em localhost:8081.
            </Text>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: themeColors.primary.purple },
              ]}
              onPress={() => Linking.openURL(insecure.localhostUrl!)}
              accessibilityRole="button"
              accessibilityLabel="Abrir em localhost"
            >
              <Text style={styles.buttonText}>Abrir em localhost</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[
              styles.button,
              { backgroundColor: themeColors.primary.purple },
            ]}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Liberar permissão da câmera"
          >
            <Text style={styles.buttonText}>Liberar câmera</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        mute
      />

      <View style={[styles.topOverlay, { pointerEvents: "none" }]}>
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>Letra dinâmica</Text>
          <Text style={styles.targetLetter}>{target.toUpperCase()}</Text>
          <Text style={styles.targetHint}>{hint}</Text>
        </View>
      </View>

      {result && (
        <View style={[styles.resultCard, { pointerEvents: "none" }]}>
          {result.match ? (
            <>
              <Text style={styles.resultGood}>
                ✓ Detectei a letra {result.letter}!
              </Text>
              <Text style={styles.resultDetail}>
                {Math.round(result.confidence * 100)}% confiança ·{" "}
                {result.has_hand_in_frames}/{result.total_frames} frames com mão
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.resultBad}>
                {result.letter ? `Detectei ${result.letter} (não bate)` : "Movimento não reconhecido"}
              </Text>
              <Text style={styles.resultDetail}>
                {Math.round(result.confidence * 100)}% confiança ·{" "}
                {result.detected_motion} · {result.has_hand_in_frames}/{result.total_frames} frames
              </Text>
            </>
          )}
          <View style={{ width: "100%", marginTop: 8 }}>
            <ConfidenceBar
              value={result.confidence}
              trackColor="rgba(255,255,255,0.18)"
            />
          </View>
        </View>
      )}

      <View style={styles.bottomOverlay}>
        <Pressable
          style={[
            styles.recordButton,
            state !== "idle" && styles.recordButtonDisabled,
          ]}
          disabled={state !== "idle"}
          onPress={startRecording}
          accessibilityRole="button"
          accessibilityLabel={`Gravar gesto de 1,5 segundo da letra ${target.toUpperCase()}`}
          accessibilityState={{ disabled: state !== "idle" }}
        >
          {state === "recording" && (
            <View style={styles.recordingDot} />
          )}
          <Text style={styles.recordButtonText}>
            {state === "idle"
              ? "Gravar 1,5s"
              : state === "recording"
                ? "Gravando…"
                : state === "uploading"
                  ? "Analisando…"
                  : "Tentar de novo"}
          </Text>
          {state === "done" && (
            <Text style={styles.recordHelper}>Toque pra tentar de novo</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
          style={styles.flipButton}
          accessibilityRole="button"
          accessibilityLabel="Virar câmera"
        >
          <Text style={styles.flipText}>↺ virar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  fallback: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  fallbackTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    color: colors.neutral.textPrimary,
  },
  button: {
    backgroundColor: colors.primary.purple,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  buttonText: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 14 },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  targetCard: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  targetLabel: {
    fontFamily: "Poppins-Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  targetLetter: {
    fontFamily: "Poppins-Bold",
    fontSize: 38,
    color: "#fff",
    lineHeight: 44,
  },
  targetHint: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  resultCard: {
    position: "absolute",
    top: "40%",
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    padding: 16,
    gap: 4,
    alignItems: "center",
  },
  resultGood: {
    fontFamily: "Poppins-Bold",
    fontSize: 18,
    color: colors.semantic.success,
  },
  resultBad: {
    fontFamily: "Poppins-Bold",
    fontSize: 18,
    color: colors.semantic.warning,
  },
  resultDetail: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.primary.purple,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 999,
    ...cardShadow({ color: colors.primary.purple, opacity: 0.35, radius: 12, y: 4, elevation: 6 }),
  },
  recordButtonDisabled: { opacity: 0.7 },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff4d4f",
  },
  recordButtonText: {
    color: "#fff",
    fontFamily: "Poppins-Bold",
    fontSize: 15,
  },
  recordHelper: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "Poppins-Regular",
    marginLeft: 6,
  },
  flipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
  },
  flipText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Poppins-SemiBold",
  },
});
