// Banner global que aparece no topo quando o app perde conexão com a API.
// Usa o hook useIsOnline (web: navigator.onLine, native: polling do /health).

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/constants/theme";
import { useT } from "@/lib/i18n";
import { useIsOnline } from "@/lib/network";

export function OfflineBanner() {
  const isOnline = useIsOnline();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const t = useT();

  if (isOnline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(280)}
      exiting={FadeOutUp.duration(220)}
      style={[
        styles.wrap,
        { top: insets.top + 4, backgroundColor: c.semantic.error },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Sem conexão com a API de Libras"
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>
        {t("common.offline")} · API de Libras indisponível
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    zIndex: 1000,
  },
  text: {
    color: "#fff",
    fontFamily: "Poppins-SemiBold",
    fontSize: 11,
  },
});
