import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInRight, FadeInUp } from "react-native-reanimated";

import { images } from "@/constants/images";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";

interface MascotBubbleProps {
  // 0 = começo, 1 = última, [0,1) = progresso
  progress: number;
  // Total de alvos (pra mostrar "X/Y")
  total: number;
  // Index atual
  current: number;
  // Caso customizado
  message?: string;
}

// Bia (mascote) flutua no canto direito do header da lição com um balão de
// fala dinâmico baseado em progresso. Mensagem rotaciona pra não ficar repetida.
export function MascotBubble({
  progress,
  total,
  current,
  message,
}: MascotBubbleProps) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const text = message ?? defaultMessage(progress, total, current);

  return (
    <Animated.View
      entering={FadeInRight.duration(420)}
      style={[styles.wrap, { pointerEvents: "none" }]}
    >
      <Animated.View entering={FadeInUp.delay(180).duration(280)} style={styles.bubble}>
        <Text style={styles.bubbleText} numberOfLines={2}>
          {text}
        </Text>
        <View style={styles.bubbleTail} />
      </Animated.View>
      <Image source={images.mascotLogo} style={styles.mascot} resizeMode="contain" />
    </Animated.View>
  );
}

function defaultMessage(progress: number, total: number, current: number): string {
  if (current === 0) {
    return "Vamos lá! Mostre a primeira letra";
  }
  if (current >= total - 1) {
    return "Última! Foco";
  }
  if (progress < 0.5) {
    return "Boa! Continue";
  }
  return "Quase lá! Foco";
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      top: -2,
      right: 6,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
    },
    mascot: {
      width: 38,
      height: 38,
    },
    bubble: {
      maxWidth: 110,
      backgroundColor: c.primary.purple,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 0,
      marginBottom: 4,
      ...cardShadow({ color: c.primary.purple, opacity: 0.3, radius: 8, y: 4, elevation: 4 }),
    },
    bubbleText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: "#fff",
    },
    bubbleTail: {
      position: "absolute",
      bottom: -4,
      right: 8,
      width: 10,
      height: 10,
      transform: [{ rotate: "45deg" }],
      backgroundColor: c.primary.purple,
    },
  });
}
