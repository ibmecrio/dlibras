import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";

interface BootSplashProps {
  subtitle?: string;
  // Em telas com fundo escuro (como a demo da câmera) o splash precisa de
  // contraste invertido. Default é branco — coerente com index/_layout.
  variant?: "light" | "dark";
}

// Animação pulse via Reanimated em vez de ActivityIndicator — bate com o tom
// "DLibras" do app e dá identidade visual ao boot. Sem dep externa (lottie).
export function BootSplash({
  subtitle = "Carregando…",
  variant = "light",
}: BootSplashProps) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [scale, opacity]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const isDark = variant === "dark";

  return (
    <View style={[styles.root, isDark && styles.rootDark]}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <Text style={[styles.brand, isDark && styles.brandDark]}>DLibras</Text>
      <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
        {subtitle}
      </Text>
    </View>
  );
}

const DOT_SIZE = 64;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    gap: 12,
    padding: 28,
  },
  rootDark: {
    backgroundColor: "#0e0e15",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.primary.purple,
    marginBottom: 8,
    ...cardShadow({ color: colors.primary.purple, opacity: 0.45, radius: 24, y: 0 }),
  },
  brand: {
    fontFamily: "Poppins-Bold",
    fontSize: 32,
    color: colors.primary.purple,
  },
  brandDark: {
    color: "#fff",
  },
  subtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: colors.neutral.textSecondary,
    textAlign: "center",
  },
  subtitleDark: {
    color: "rgba(255,255,255,0.7)",
  },
});
