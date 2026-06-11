import { Ionicons } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { speak as ttsSpeak } from "@/lib/voice";
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
import { LIBRAS_API_URL, LIBRAS_WS_URL } from "@/lib/apiUrl";
import { playMatchChime, playWrongChime } from "@/lib/audio";
import { useLearningStore } from "@/store/learningStore";

// Em browser, getUserMedia só permite câmera em contexto seguro
// (HTTPS ou localhost). Rodar no IP da LAN dispara permissão denied
// silenciosamente, e o app fica em loop de "bloqueada".
function detectWebInsecureCameraHost(): { blocked: boolean; localhostUrl: string | null } {
  if (Platform.OS !== "web") return { blocked: false, localhostUrl: null };
  if (typeof window === "undefined") return { blocked: false, localhostUrl: null };
  const isSecure = window.isSecureContext;
  const host = window.location.hostname;
  const localhostNames = ["localhost", "127.0.0.1", "::1"];
  const isLocalhost = localhostNames.includes(host);
  if (isSecure || isLocalhost) return { blocked: false, localhostUrl: null };
  const localhostUrl = `${window.location.protocol}//localhost:${window.location.port || "8081"}${window.location.pathname}${window.location.search}`;
  return { blocked: true, localhostUrl };
}

// Reduzido pra ~3.5fps — sensação real-time, sem matar a CPU do server.
// WebSocket aceita um pouco mais (pode ir pra 4-5fps sem stress).
const CAPTURE_INTERVAL_MS = 280;
const CONSECUTIVE_MATCHES_TO_PASS = 3;
// Após N falhas consecutivas, dispara o som de "wrong" como dica.
const WRONG_FEEDBACK_AFTER = 12;

type Prediction = {
  letter: string | null;
  confidence: number | null;
  match: boolean | null;
  has_hand: boolean;
  latency_ms: number;
};

type ApiStatus = "checking" | "online" | "offline";

interface LibrasCameraProps {
  target: string;
  paused?: boolean;
  onMatch?: (letter: string) => void;
  onPrediction?: (prediction: Prediction) => void;
}

export function LibrasCamera({
  target,
  paused = false,
  onMatch,
  onPrediction,
}: LibrasCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [matched, setMatched] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  const cameraRef = useRef<CameraView | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inflightRef = useRef(false);
  const consecutiveMatchesRef = useRef(0);
  const consecutiveMissesRef = useRef(0);
  const wrongPlayedRef = useRef(false);
  const matchedRef = useRef(false);
  const mountedRef = useRef(true);
  const targetRef = useRef(target);
  // WebSocket connection — só usado se estiver online e conectar.
  const wsRef = useRef<WebSocket | null>(null);
  const wsReadyRef = useRef(false);
  const wsPendingRef = useRef(false);
  const librasModel = useLearningStore((s) => s.librasModel);
  const librasModelRef = useRef(librasModel);
  useEffect(() => {
    librasModelRef.current = librasModel;
  }, [librasModel]);
  // Refs pros callbacks do parent — evita que `capture` mude de identidade
  // toda vez que o parent re-renderiza (qualquer callback inline lá vira
  // uma nova função e antes derrubava o setInterval).
  const onMatchRef = useRef(onMatch);
  const onPredictionRef = useRef(onPrediction);
  const audioEnabled = useLearningStore((s) => s.audioFeedbackEnabled);
  const audioEnabledRef = useRef(audioEnabled);
  const themeColors = useThemeColors();
  const isDark = themeColors.neutral.background !== "#ffffff";

  useEffect(() => {
    onMatchRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    onPredictionRef.current = onPrediction;
  }, [onPrediction]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    targetRef.current = target.toUpperCase();
    setMatched(false);
    matchedRef.current = false;
    consecutiveMatchesRef.current = 0;
    consecutiveMissesRef.current = 0;
    wrongPlayedRef.current = false;
  }, [target]);

  // Tenta abrir WebSocket pra real-time. Se falhar, segue com HTTP normal.
  useEffect(() => {
    if (apiStatus !== "online") return;
    let cancelled = false;
    try {
      const ws = new WebSocket(LIBRAS_WS_URL);
      ws.onopen = () => {
        if (cancelled) return;
        wsReadyRef.current = true;
        wsRef.current = ws;
      };
      ws.onmessage = (ev) => {
        wsPendingRef.current = false;
        if (cancelled || !mountedRef.current) return;
        try {
          const data = JSON.parse(ev.data) as Prediction & { error?: string };
          if (data.error) return;
          handlePredictionResult(data);
        } catch {
          // ignore
        }
      };
      ws.onerror = () => {
        wsReadyRef.current = false;
      };
      ws.onclose = () => {
        wsReadyRef.current = false;
        wsRef.current = null;
      };
    } catch {
      // ignore — fica no HTTP
    }
    return () => {
      cancelled = true;
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      wsReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkHealth = useCallback(async () => {
    setApiStatus("checking");
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${LIBRAS_API_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      setApiStatus(res.ok ? "online" : "offline");
    } catch {
      setApiStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Processa o resultado da predição (vindo do HTTP ou do WS).
  function handlePredictionResult(data: Prediction) {
    if (!mountedRef.current) return;
    setApiStatus("online");
    setPrediction(data);
    onPredictionRef.current?.(data);

    if (data.match) {
      consecutiveMatchesRef.current += 1;
      consecutiveMissesRef.current = 0;
      if (
        consecutiveMatchesRef.current >= CONSECUTIVE_MATCHES_TO_PASS &&
        !matchedRef.current
      ) {
        matchedRef.current = true;
        setMatched(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (audioEnabledRef.current) {
          playMatchChime().catch(() => {});
        }
        void ttsSpeak(targetRef.current);
        useLearningStore
          .getState()
          .registerLetterResult(targetRef.current, true);
        onMatchRef.current?.(targetRef.current);
      }
    } else {
      consecutiveMatchesRef.current = 0;
      // Se a mão está visível mas a letra continua errada por X frames,
      // toca o som de "wrong" + tira heart + registra erro pra heatmap.
      if (data.has_hand) {
        consecutiveMissesRef.current += 1;
        if (
          consecutiveMissesRef.current >= WRONG_FEEDBACK_AFTER &&
          !wrongPlayedRef.current
        ) {
          wrongPlayedRef.current = true;
          if (audioEnabledRef.current) {
            playWrongChime().catch(() => {});
          }
          useLearningStore.getState().loseHeart();
          useLearningStore
            .getState()
            .registerLetterResult(targetRef.current, false);
        }
      }
    }
  }

  const capture = useCallback(async () => {
    if (!cameraRef.current || inflightRef.current || matchedRef.current) return;
    // WebSocket: se há um envio pendente, pula esse ciclo (backpressure)
    if (wsReadyRef.current && wsPendingRef.current) return;
    inflightRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: Platform.OS === "web",
        shutterSound: false,
        exif: false,
      });
      if (!photo?.base64 || !mountedRef.current) return;

      // PRIORIDADE: WebSocket se aberto (real-time, sem header HTTP)
      if (wsReadyRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        wsPendingRef.current = true;
        try {
          wsRef.current.send(
            JSON.stringify({
              image: photo.base64,
              target: targetRef.current,
              model: librasModelRef.current,
            }),
          );
        } catch {
          wsPendingRef.current = false;
          wsReadyRef.current = false;
        }
        return;
      }

      // Fallback HTTP
      const res = await fetch(`${LIBRAS_API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: photo.base64,
          target: targetRef.current,
          model: librasModelRef.current,
        }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setApiStatus("offline");
        return;
      }
      const data: Prediction = await res.json();
      handlePredictionResult(data);
    } catch {
      if (mountedRef.current) setApiStatus("offline");
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!permission?.granted) return;
    if (paused || matched || apiStatus !== "online") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(capture, CAPTURE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [permission?.granted, paused, matched, apiStatus, capture]);

  if (!permission) {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: isDark ? themeColors.neutral.surface : "#F4F2FF" },
        ]}
      >
        <ActivityIndicator size="small" color={themeColors.primary.purple} />
      </View>
    );
  }

  if (!permission.granted) {
    const insecure = detectWebInsecureCameraHost();
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: isDark ? themeColors.neutral.surface : "#F4F2FF" },
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
        <Text
          style={[
            styles.fallbackBody,
            { color: themeColors.neutral.textSecondary },
          ]}
        >
          Para aprender Libras precisamos enxergar sua mão.
        </Text>
        {insecure.blocked && insecure.localhostUrl ? (
          <>
            <Text
              style={[
                styles.fallbackBody,
                { color: isDark ? themeColors.semantic.warning : "#b45309" },
              ]}
            >
              Seu navegador bloqueia câmera em IPs da rede.{"\n"}
              Abra pelo endereço <Text style={{ fontWeight: "700" }}>localhost:8081</Text> no Mac, ou use o app no celular.
            </Text>
            <Pressable
              style={[
                styles.permissionButton,
                { backgroundColor: themeColors.primary.purple },
              ]}
              onPress={() => Linking.openURL(insecure.localhostUrl!)}
              accessibilityRole="button"
              accessibilityLabel="Abrir em localhost"
            >
              <Text style={styles.permissionButtonText}>Abrir em localhost</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[
              styles.permissionButton,
              { backgroundColor: themeColors.primary.purple },
            ]}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Liberar permissão da câmera"
          >
            <Text style={styles.permissionButtonText}>Liberar câmera</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const detected = prediction?.letter ?? "—";
  const detectedColor = matched
    ? colors.semantic.success
    : prediction?.match
      ? colors.semantic.warning
      : colors.primary.purple;

  const statusBadge = {
    checking: { label: "Conectando à IA…", color: colors.semantic.warning },
    online: { label: "IA online", color: colors.semantic.success },
    offline: { label: "API offline", color: colors.semantic.error },
  }[apiStatus];

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        mute
      />

      <View style={[styles.overlay, { pointerEvents: "none" }]}>
        <View style={styles.topRow}>
          <View style={styles.targetCard}>
            <Text style={styles.targetLabel}>Mostre a letra</Text>
            <Text style={styles.targetLetter}>{target.toUpperCase()}</Text>
          </View>

          <View
            style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}
          >
            <Text style={styles.statusBadgeText}>{statusBadge.label}</Text>
          </View>
        </View>

        <View
          style={[
            styles.detectedCard,
            {
              borderColor: detectedColor,
              // Em dark, surface escura translúcida; em light, branco translúcido.
              backgroundColor: isDark
                ? "rgba(28,31,43,0.92)"
                : "rgba(255,255,255,0.92)",
            },
          ]}
        >
          <Text
            style={[
              styles.detectedLabel,
              { color: themeColors.neutral.textSecondary },
            ]}
          >
            Detectado
          </Text>
          <Text style={[styles.detectedLetter, { color: detectedColor }]}>
            {detected}
          </Text>
          {prediction?.confidence != null && (
            <>
              <Text
                style={[
                  styles.confidence,
                  { color: themeColors.neutral.textSecondary },
                ]}
              >
                {Math.round(prediction.confidence * 100)}% confiança
              </Text>
              <View style={{ width: "100%", marginTop: 4 }}>
                <ConfidenceBar
                  value={prediction.confidence}
                  trackColor={
                    isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"
                  }
                />
              </View>
            </>
          )}
          {prediction && !prediction.has_hand && (
            <Text style={styles.hint}>Não vejo sua mão ainda</Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
        style={styles.flipButton}
        accessibilityRole="button"
        accessibilityLabel="Virar câmera"
      >
        <Text style={styles.flipButtonText}>↺</Text>
      </Pressable>

      {apiStatus === "offline" && (
        <View style={styles.offlineOverlay}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color="#fff"
            style={{ opacity: 0.85, marginBottom: 8 }}
          />
          <Text style={styles.offlineTitle}>API offline</Text>
          <Text style={styles.offlineBody}>
            Não consegui falar com{"\n"}
            <Text style={{ fontFamily: "Poppins-SemiBold" }}>
              {LIBRAS_API_URL}
            </Text>
            {"\n\n"}
            Rode{" "}
            <Text style={{ fontFamily: "Poppins-SemiBold" }}>
              npm run libras:api
            </Text>{" "}
            no diretório do projeto e tente novamente.
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={checkHealth}
            accessibilityRole="button"
            accessibilityLabel="Tentar conectar à API novamente"
          >
            <Text style={styles.permissionButtonText}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      {matched && (
        <View style={styles.successOverlay}>
          <Text style={styles.successTitle}>Boa! Letra {target.toUpperCase()} ✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  targetCard: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  targetLabel: {
    fontFamily: "Poppins-Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  targetLetter: {
    fontFamily: "Poppins-Bold",
    fontSize: 36,
    color: "#fff",
    lineHeight: 42,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "#fff",
    fontFamily: "Poppins-SemiBold",
    fontSize: 10,
    letterSpacing: 0.3,
  },
  detectedCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: "flex-end",
    borderWidth: 2,
    minWidth: 130,
    alignItems: "center",
  },
  detectedLabel: {
    fontFamily: "Poppins-Medium",
    fontSize: 11,
    color: colors.neutral.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detectedLetter: {
    fontFamily: "Poppins-Bold",
    fontSize: 32,
    lineHeight: 38,
    marginTop: 2,
  },
  confidence: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  hint: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: colors.semantic.warning,
    marginTop: 4,
  },
  flipButton: {
    position: "absolute",
    top: 56,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  flipButtonText: {
    color: "#fff",
    fontSize: 18,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(33,193,107,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 26,
    color: "#fff",
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  offlineTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 20,
    color: "#fff",
  },
  offlineBody: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 20,
  },
  fallback: {
    flex: 1,
    backgroundColor: "#F4F2FF",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 10,
  },
  fallbackTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 16,
    color: colors.neutral.textPrimary,
  },
  fallbackBody: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: colors.neutral.textSecondary,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: 6,
    backgroundColor: colors.primary.purple,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  permissionButtonText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
