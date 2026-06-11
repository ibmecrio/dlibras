import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeOutUp,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ACHIEVEMENTS } from "@/data/achievements";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";
import { useLearningStore } from "@/store/learningStore";

// Banner que aparece quando uma conquista nova é desbloqueada.
// Lê `justUnlocked` do store, mostra o primeiro item por 3.5s, chama
// clearJustUnlocked depois — assim o store fica limpo pro próximo unlock.
export function AchievementToast() {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const justUnlocked = useLearningStore((s) => s.justUnlocked);
  const clear = useLearningStore((s) => s.clearJustUnlocked);

  const [current, setCurrent] = useState<string | null>(null);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (justUnlocked.length > 0 && !current) {
      setCurrent(justUnlocked[0]);
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
      const timer = setTimeout(() => {
        setCurrent(null);
        // Limpa só depois que escondeu pra não causar flash
        setTimeout(clear, 300);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [justUnlocked, current, clear, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.5,
  }));

  if (!current) return null;
  const achievement = ACHIEVEMENTS.find((a) => a.id === current);
  if (!achievement) return null;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(15)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.wrap, { pointerEvents: "none" }]}
    >
      <View style={[styles.card, { borderColor: achievement.color }]}>
        <Animated.View
          style={[
            styles.shimmer,
            { backgroundColor: achievement.color },
            shimmerStyle,
          ]}
        />
        <View
          style={[styles.iconCircle, { backgroundColor: achievement.color }]}
        >
          <Ionicons name={achievement.icon} size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>CONQUISTA DESBLOQUEADA</Text>
          <Text style={styles.title}>{achievement.title}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {achievement.description}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: "absolute",
      bottom: 80,
      left: 16,
      right: 16,
      zIndex: 50,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.neutral.elevated,
      borderRadius: 18,
      padding: 14,
      borderWidth: 2,
      overflow: "hidden",
      ...cardShadow({ opacity: 0.18, radius: 16, y: 6, elevation: 8 }),
    },
    shimmer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
    },
    iconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: "center",
      justifyContent: "center",
    },
    kicker: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 9,
      color: c.primary.purple,
      letterSpacing: 1.2,
    },
    title: {
      fontFamily: "Poppins-Bold",
      fontSize: 15,
      color: c.neutral.textPrimary,
      marginTop: 1,
    },
    desc: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
  });
}
