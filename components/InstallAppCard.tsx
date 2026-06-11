// Card universal "Instalar como app" — detecta iOS Safari, Android Chrome,
// Desktop e mostra o caminho certo pra cada um.
//
// - Chrome/Edge (Android + Desktop): captura beforeinstallprompt e oferece
//   o botão "Instalar"
// - Safari iOS: mostra instruções "Add to Home Screen" (Safari não dispara
//   beforeinstallprompt, só dá pra instalar via menu Compartilhar)
// - Firefox/Outros: explica como adicionar bookmark / instalar via menu
// - Já instalado (display-mode: standalone): mostra check verde
// - Native (Expo Go ou EAS Build): explica como instalar via stores

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { AppModal } from "@/components/AppModal";
import { ThemeColors, useThemeColors } from "@/constants/theme";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredInstallPrompt: any = null;
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
}

type Browser = "chrome" | "safari-ios" | "safari-mac" | "firefox" | "other";

function detectBrowser(): Browser {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (/crios|edgios|fxios/.test(ua)) {
    // Chrome/Edge/Firefox on iOS = WebKit underneath; install only via Safari
    return "safari-ios";
  }
  if (/iphone|ipod|ipad/.test(ua) && /safari/.test(ua)) return "safari-ios";
  if (/firefox/.test(ua)) return "firefox";
  if (/chrome|edg|opr/.test(ua)) return "chrome";
  if (/safari/.test(ua)) return "safari-mac";
  return "other";
}

function isStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

export function InstallAppCard() {
  const c = useThemeColors();
  const styles = createStyles(c);
  const [browser, setBrowser] = useState<Browser>("other");
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setBrowser(detectBrowser());
    setInstalled(isStandalone());
    setCanInstall(!!deferredInstallPrompt);
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onPrompt = () => setCanInstall(true);
    const onInstalled = () => {
      deferredInstallPrompt = null;
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleChromeInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice?.outcome === "accepted") setInstalled(true);
    deferredInstallPrompt = null;
    setCanInstall(false);
  }

  // Em native (iOS/Android via Expo Go / EAS): explica como instalar via lojas.
  if (Platform.OS !== "web") {
    return (
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={Platform.OS === "ios" ? "logo-apple" : "logo-android"}
            size={20}
            color={c.primary.purple}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>App instalado</Text>
          <Text style={styles.body}>
            Você já está usando o app nativo. Atualizações automáticas via OTA Expo.
          </Text>
        </View>
      </View>
    );
  }

  if (installed) {
    return (
      <View style={[styles.card, { borderColor: c.semantic.success }]}>
        <View style={[styles.iconCircle, { backgroundColor: c.semantic.success }]}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Instalado!</Text>
          <Text style={styles.body}>DLibras já está como app no seu dispositivo.</Text>
        </View>
      </View>
    );
  }

  // Chrome / Edge / Brave — botão direto pra instalar
  if (canInstall) {
    return (
      <Pressable
        onPress={handleChromeInstall}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Instalar como app"
      >
        <View style={[styles.iconCircle, { backgroundColor: c.primary.purple }]}>
          <Ionicons name="download" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Instalar como app</Text>
          <Text style={styles.body}>
            Adiciona um ícone na tela inicial, abre em fullscreen, funciona offline.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.neutral.textSecondary} />
      </Pressable>
    );
  }

  // Safari iOS — mostra modal com guia manual
  return (
    <>
      <Pressable
        onPress={() => setShowGuide(true)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Como instalar como app"
      >
        <View style={[styles.iconCircle, { backgroundColor: c.primary.purple }]}>
          <Ionicons name="phone-portrait" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Instalar como app</Text>
          <Text style={styles.body}>
            {browser === "safari-ios"
              ? "iPhone/iPad: tocar pra ver os 3 passos."
              : browser === "firefox"
                ? "Firefox: tocar pra ver o caminho."
                : "Tocar pra saber como adicionar à tela inicial."}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.neutral.textSecondary} />
      </Pressable>

      <AppModal
        visible={showGuide}
        onClose={() => setShowGuide(false)}
        kind="info"
        icon={browser === "safari-ios" ? "logo-apple" : "phone-portrait"}
        title="Adicionar à tela de início"
        body={guideText(browser)}
        primaryLabel="Entendi"
      />
    </>
  );
}

function guideText(browser: Browser): string {
  if (browser === "safari-ios") {
    return (
      "1. Toque no ícone Compartilhar (□↑) na barra inferior.\n" +
      "2. Role e toque em 'Adicionar à Tela de Início'.\n" +
      "3. Confirme 'Adicionar' — pronto, vira ícone separado."
    );
  }
  if (browser === "safari-mac") {
    return (
      "Safari 17+ no Mac: menu Arquivo → 'Adicionar ao Dock'.\n" +
      "Em versões antigas, marque como favorito ou abra em uma janela dedicada."
    );
  }
  if (browser === "firefox") {
    return (
      "Firefox Mobile: menu (⋮) → 'Adicionar ao Início' → 'Adicionar à Tela'.\n" +
      "Firefox Desktop não suporta install. Use Chrome ou Edge."
    );
  }
  return (
    "No menu do seu navegador procure por 'Adicionar à Tela de Início' " +
    "ou 'Instalar'. Em Chrome/Edge essa opção aparece automaticamente."
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      backgroundColor: c.neutral.elevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.neutral.surface,
    },
    title: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
      color: c.neutral.textPrimary,
    },
    body: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
    },
  });
}
