// Popup flutuante "+X XP" — usado pelo lesson screen quando ganha XP.
// Renderiza em posição absoluta no centro-baixo da tela com slide up + fade out.

import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";

interface XpFloatProps {
  amount: number;
  onDone?: () => void;
  bottom?: number;
}

export function XpFloat({ amount, onDone, bottom = 80 }: XpFloatProps) {
  const c = useThemeColors();
  const styles = createStyles(c);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 280 }),
    );
    scale.value = withSequence(
      withTiming(1.05, { duration: 220, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200, easing: Easing.inOut(Easing.quad) }),
    );
    translateY.value = withTiming(-100, {
      duration: 1420,
      easing: Easing.out(Easing.cubic),
    });
    const id = setTimeout(() => onDone?.(), 1500);
    return () => clearTimeout(id);
  }, [translateY, opacity, scale, onDone]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="none">
      <Animated.View style={[styles.pill, animStyle]}>
        <Ionicons name="sparkles" size={16} color="#fff" />
        <Text style={styles.text}>+{amount} XP</Text>
      </Animated.View>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 1000,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: c.primary.purple,
      ...cardShadow({ color: c.primary.purple, opacity: 0.4, radius: 12, y: 6, elevation: 6 }),
    },
    text: {
      color: "#fff",
      fontFamily: "Poppins-Bold",
      fontSize: 16,
    },
  });
}
