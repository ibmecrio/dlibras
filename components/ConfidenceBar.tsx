import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";

interface ConfidenceBarProps {
  // 0 a 1. null/undefined renderiza barra vazia.
  value: number | null | undefined;
  // Altura da barra. Default 6px.
  height?: number;
  // Largura. Default "100%".
  width?: number | `${number}%`;
  // Cor de fundo da trilha; em camera overlay pode passar mais translúcido.
  trackColor?: string;
  // Se true, usa cores semantic (success/warning/error). Se false, força purple.
  semantic?: boolean;
}

// Barra de confiança animada com cor que reflete o nível.
// >= 80% verde, 50-80% amarelo, < 50% vermelho — pra dar leitura visual
// imediata da qualidade da detecção sem o usuário precisar ler o número.
export function ConfidenceBar({
  value,
  height = 6,
  width = "100%",
  trackColor,
  semantic = true,
}: ConfidenceBarProps) {
  const c = useThemeColors();
  const pct = Math.max(0, Math.min(1, value ?? 0));

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(pct, {
      duration: 280,
      easing: Easing.out(Easing.quad),
    });
  }, [pct, progress]);

  const fillColor = semantic ? confidenceColor(pct, c) : c.primary.purple;

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        {
          height,
          width,
          borderRadius: height / 2,
          backgroundColor: trackColor ?? c.neutral.border,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          fillStyle,
          { backgroundColor: fillColor, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

function confidenceColor(pct: number, c: ThemeColors): string {
  if (pct >= 0.8) return c.semantic.success;
  if (pct >= 0.5) return c.semantic.warning;
  return c.semantic.error;
}

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
