import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BootSplash } from "@/components/BootSplash";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { colors } from "@/constants/theme";
import { LIBRAS_API_URL } from "@/lib/apiUrl";
import { useLearningStore } from "@/store/learningStore";

const CAPTURE_INTERVAL_MS = 700;

type Prediction = {
  letter: string | null;
  confidence: number | null;
  has_hand: boolean;
  latency_ms: number;
};

type ApiStatus = "checking" | "online" | "offline";

export default function LibrasDemoScreen() {
  const [mounted, setMounted] = useState(false);
  const markVisited = useLearningStore((s) => s.markLibrasDemoVisited);

  useEffect(() => {
    setMounted(true);
    // Marca o "Prática com câmera" como concluído no plano da home —
    // basta uma visita pra mostrar que o usuário viu o leitor livre.
    markVisited();
  }, [markVisited]);

  return (
    <SafeAreaView style={styles.root}>
      {mounted ? (
        <LibrasDemoBody />
      ) : (
        <BootSplash variant="dark" subtitle="Carregando câmera…" />
      )}
    </SafeAreaView>
  );
}

function LibrasDemoBody() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  const cameraRef = useRef<CameraView | null>(null);
  const inflightRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const capture = useCallback(async () => {
    if (!cameraRef.current || inflightRef.current) return;
    inflightRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: Platform.OS === "web",
        shutterSound: false,
        exif: false,
      });
      if (!photo?.base64) return;
      const res = await fetch(`${LIBRAS_API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo.base64 }),
      });
      if (!res.ok) {
        setApiStatus("offline");
        return;
      }
      const data: Prediction = await res.json();
      setApiStatus("online");
      setPrediction(data);
    } catch {
      setApiStatus("offline");
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!permission?.granted || apiStatus !== "online") {
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
  }, [permission?.granted, apiStatus, capture]);

  if (!permission) {
    return <BootSplash variant="dark" subtitle="Carregando câmera…" />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permWrap}>
        <Text style={styles.permTitle}>DLibras precisa da câmera</Text>
        <Text style={styles.permBody}>
          Para reconhecer as letras em Libras precisamos enxergar sua mão.
          {"\n\n"}
          {Platform.OS === "web"
            ? "Seu navegador vai pedir permissão. Aceite e a câmera liga."
            : "Toque em liberar pra dar permissão."}
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Liberar câmera</Text>
        </Pressable>
        <Text style={styles.apiUrlText}>API: {LIBRAS_API_URL}</Text>
      </View>
    );
  }

  const detectedLetter = prediction?.has_hand ? prediction?.letter : null;
  const confidence = prediction?.confidence;
  const showingHand = !!prediction?.has_hand;

  const statusBadge = {
    checking: { label: "Conectando à IA…", color: colors.semantic.warning },
    online: { label: "IA online", color: colors.semantic.success },
    offline: { label: "API offline", color: colors.semantic.error },
  }[apiStatus];

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        mute
      />

      {/* Top: title + status */}
      <View style={styles.topRow}>
        <View style={styles.titleCard}>
          <Text style={styles.titleLabel}>DLibras · Leitor</Text>
          <Text style={styles.titleHint}>Faça uma letra com a mão</Text>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}
        >
          <Text style={styles.statusBadgeText}>{statusBadge.label}</Text>
        </View>
      </View>

      {/* Center: huge detected letter */}
      <View style={[styles.center, { pointerEvents: "none" }]}>
        {detectedLetter ? (
          <>
            <Text style={styles.bigLetter}>{detectedLetter}</Text>
            {confidence != null && (
              <>
                <Text style={styles.bigConfidence}>
                  {Math.round(confidence * 100)}% de confiança
                </Text>
                <View style={styles.bigConfidenceBar}>
                  <ConfidenceBar
                    value={confidence}
                    height={8}
                    trackColor="rgba(255,255,255,0.18)"
                  />
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>
              {showingHand === false && prediction
                ? "Mostre sua mão pra câmera"
                : "Aguardando…"}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom */}
      <View style={styles.bottomRow}>
        <Pressable
          style={styles.flipButton}
          onPress={() =>
            setFacing((f) => (f === "front" ? "back" : "front"))
          }
          accessibilityRole="button"
          accessibilityLabel="Virar câmera"
        >
          <Text style={styles.flipText}>↺ Virar câmera</Text>
        </Pressable>
        <Text style={styles.apiUrlBottom}>{LIBRAS_API_URL}</Text>
      </View>

      {apiStatus === "offline" && (
        <View style={styles.offlineOverlay}>
          <Text style={styles.offlineTitle}>API offline</Text>
          <Text style={styles.offlineBody}>
            Não consegui falar com{"\n"}
            {LIBRAS_API_URL}
            {"\n\n"}
            Garanta que o servidor Libras está rodando.
          </Text>
          <Pressable style={styles.primaryButton} onPress={checkHealth}>
            <Text style={styles.primaryButtonText}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0e0e15",
  },
  permWrap: {
    flex: 1,
    backgroundColor: "#0e0e15",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  permTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  permBody: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 380,
  },
  primaryButton: {
    backgroundColor: colors.primary.purple,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  apiUrlText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    marginTop: 10,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
    overflow: "hidden",
  },
  topRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 2,
  },
  titleCard: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  titleLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  titleHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  center: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    gap: 6,
  },
  bigLetter: {
    fontSize: 220,
    lineHeight: 240,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  bigConfidence: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "rgba(108,78,245,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  bigConfidenceBar: {
    width: 220,
    marginTop: 10,
  },
  placeholderBox: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
  },
  placeholderText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  bottomRow: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  flipButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
  },
  flipText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  apiUrlBottom: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
    zIndex: 3,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  offlineBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 20,
  },
});
