// Banner FIXO no topo que aparece pra usuario do iPhone Safari instalar como app.
//
// Safari iOS nao dispara beforeinstallprompt — a unica forma de instalar e via
// Compartilhar -> "Adicionar a Tela de Inicio". Esse banner ensina o caminho.
//
// Aparece quando:
//   - Plataforma == web
//   - User agent indica iOS (iphone/ipad/ipod)
//   - Nao esta em modo standalone (ja instalado)
//   - Nao foi dispensado nas ultimas 7 dias (localStorage)

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppModal } from "@/components/AppModal";
import { useThemeColors } from "@/constants/theme";

const STORAGE_KEY = "dlibras_ios_install_dismissed";
const SUPPRESS_DAYS = 7;

function isIosSafari(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  // Em iOS, Chrome/Firefox tambem usam WebKit por baixo — todos seguem mesmo flow
  return isIos;
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
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
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
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;
    // Delay 1.2s pra nao competir com splash
    const id = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    markDismissed();
    setVisible(false);
  }

  function handleInstall() {
    setShowModal(true);
  }

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(400)}
        exiting={FadeOutUp.duration(220)}
        style={[
          styles.wrap,
          {
            top: insets.top + 8,
            backgroundColor: c.primary.purple,
          },
        ]}
        accessibilityRole="alert"
        accessibilityLabel="Instalar DLibras como aplicativo"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait" size={20} color="#fff" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Instalar DLibras como app</Text>
          <Text style={styles.body}>
            Tela cheia, abre offline, igual app nativo
          </Text>
        </View>
        <Pressable
          onPress={handleInstall}
          style={({ pressed }) => [
            styles.installBtn,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Como instalar"
        >
          <Text style={styles.installBtnText}>Instalar</Text>
        </Pressable>
        <Pressable
          onPress={handleDismiss}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          hitSlop={10}
        >
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </Animated.View>

      <AppModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        kind="info"
        icon="logo-apple"
        title="Adicionar a Tela de Inicio"
        body={
          "1. Toque no icone Compartilhar (quadrado com seta pra cima) na barra do Safari.\n\n" +
          "2. Role e toque em 'Adicionar a Tela de Inicio'.\n\n" +
          "3. Confirme tocando 'Adicionar'.\n\n" +
          "O DLibras aparece como app no seu iPhone, abre em tela cheia e funciona offline."
        }
        primaryLabel="Entendi"
        onPrimary={() => {
          markDismissed();
          setVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
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
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1, gap: 1 },
  title: {
    fontFamily: "Poppins-Bold",
    fontSize: 13,
    color: "#fff",
  },
  body: {
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
  closeBtn: {
    padding: 4,
  },
});
