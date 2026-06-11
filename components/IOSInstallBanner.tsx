// Banner iOS Safari + overlay visual ensinando como adicionar a tela de inicio.
//
// LIMITE TECNICO: Apple nao expoe API JS pra instalar PWA programaticamente.
// O usuario PRECISA tocar manualmente em Compartilhar -> Adicionar a Tela.
// Esse componente compensa com UX visual: overlay escuro + seta animada
// apontando exatamente pra barra inferior do Safari (onde fica o icone).

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/constants/theme";

const STORAGE_KEY = "dlibras_ios_install_dismissed";
const SUPPRESS_DAYS = 7;

function isIosSafari(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

function wasRecentlyDismissed(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < SUPPRESS_DAYS * 86400000;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
  } catch {
    // ignore
  }
}

export function IOSInstallBanner() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  // mounted gate evita hydration mismatch — SSR renderiza null, cliente
  // tambem renderiza null no primeiro paint, e so depois decide se mostra.
  const [mounted, setMounted] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isIosSafari()) return;
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;
    const id = setTimeout(() => setBannerVisible(true), 1200);
    return () => clearTimeout(id);
  }, []);

  if (!mounted) return null;

  function handleDismiss() {
    markDismissed();
    setBannerVisible(false);
  }

  function handleInstall() {
    setOverlayVisible(true);
  }

  function closeOverlay() {
    setOverlayVisible(false);
    markDismissed();
    setBannerVisible(false);
  }

  if (!bannerVisible) return null;

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(400)}
        exiting={FadeOutUp.duration(220)}
        style={[
          styles.banner,
          { top: insets.top + 8, backgroundColor: c.primary.purple },
        ]}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="phone-portrait" size={20} color="#fff" />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>Instalar DLibras como app</Text>
          <Text style={styles.bannerBody}>
            Tela cheia, abre offline, sem URL bar
          </Text>
        </View>
        <Pressable
          onPress={handleInstall}
          style={({ pressed }) => [styles.installBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.installBtnText}>Instalar</Text>
        </Pressable>
        <Pressable onPress={handleDismiss} style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </Animated.View>

      <Modal
        visible={overlayVisible}
        transparent
        animationType="none"
        onRequestClose={closeOverlay}
        statusBarTranslucent
      >
        <InstallOverlay onClose={closeOverlay} />
      </Modal>
    </>
  );
}

// Overlay escuro com seta pulsante apontando pro botao Compartilhar
// do Safari (que fica na barra inferior em iPhone, ou superior em iPad).
function InstallOverlay({ onClose }: { onClose: () => void }) {
  const arrowY = useSharedValue(0);
  const arrowOpacity = useSharedValue(0);

  useEffect(() => {
    arrowOpacity.value = withTiming(1, { duration: 380 });
    arrowY.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(16, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [arrowY, arrowOpacity]);

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [{ translateY: arrowY.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(220)}
      style={styles.overlay}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <View style={styles.overlayContent}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={styles.cardTitle}>
              Passo 1 — Toque em Compartilhar
            </Text>
          </View>
          <Text style={styles.cardBody}>
            Procure o ícone abaixo na barra do Safari (parece um quadrado com
            uma seta pra cima).
          </Text>
          <View style={styles.shareIconRow}>
            <View style={styles.shareIconBox}>
              <Ionicons name="share-outline" size={42} color="#fff" />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).duration(380)}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>Passo 2 — Adicionar à Tela</Text>
          <Text style={styles.cardBody}>
            No menu que abrir, role um pouco e toque em{" "}
            <Text style={styles.bold}>Adicionar à Tela de Início</Text> →{" "}
            <Text style={styles.bold}>Adicionar</Text>.
          </Text>
          <View style={styles.menuMock}>
            <View style={styles.menuRow}>
              <Ionicons name="add-circle" size={20} color="#6c4ef5" />
              <Text style={styles.menuRowText}>Adicionar à Tela de Início</Text>
            </View>
          </View>
        </Animated.View>

        <Pressable onPress={onClose} style={styles.gotItBtn}>
          <Text style={styles.gotItText}>Entendi, vou instalar</Text>
        </Pressable>
      </View>

      {/* Seta animada apontando pro botão Compartilhar na barra inferior do Safari */}
      <Animated.View style={[styles.arrowWrap, arrowStyle]} pointerEvents="none">
        <Text style={styles.arrowEmoji}>👇</Text>
        <Text style={styles.arrowHint}>Aqui</Text>
      </Animated.View>
    </Animated.View>
  );
}

const { height: H } = Dimensions.get("window");

const styles = StyleSheet.create({
  // Banner topo
  banner: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { flex: 1, gap: 1 },
  bannerTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 13,
    color: "#fff",
  },
  bannerBody: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.88)",
  },
  installBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  installBtnText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 12,
    color: "#5b3bf6",
  },
  closeBtn: { padding: 4 },

  // Overlay full screen
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
  },
  overlayContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 80,
    gap: 14,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 16,
    color: "#fff",
  },
  cardBody: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 19,
  },
  bold: {
    fontFamily: "Poppins-SemiBold",
    color: "#fff",
  },
  shareIconRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 6,
  },
  shareIconBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "rgba(108,78,245,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuMock: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    padding: 12,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuRowText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 13,
    color: "#001328",
  },
  gotItBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#6c4ef5",
    alignItems: "center",
    justifyContent: "center",
  },
  gotItText: {
    color: "#fff",
    fontFamily: "Poppins-SemiBold",
    fontSize: 15,
  },

  // Seta animada apontando pra barra inferior do Safari
  arrowWrap: {
    position: "absolute",
    bottom: H > 700 ? 60 : 30,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 4,
  },
  arrowEmoji: { fontSize: 38 },
  arrowHint: {
    fontFamily: "Poppins-Bold",
    fontSize: 14,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
