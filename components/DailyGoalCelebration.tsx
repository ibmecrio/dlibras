// Modal que aparece UMA VEZ por dia quando o usuário bate a meta diária.
// Auto-dispara ao detectar xpToday >= dailyGoal e lastDailyGoalCelebrated !== hoje.

import { useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";
import { useLearningStore } from "@/store/learningStore";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DailyGoalCelebration() {
  const c = useThemeColors();
  const styles = createStyles(c);
  const xpToday = useLearningStore((s) => s.xpToday);
  const dailyGoal = useLearningStore((s) => s.dailyGoal);
  const lastCelebrated = useLearningStore((s) => s.lastDailyGoalCelebrated);
  const markCelebrated = useLearningStore((s) => s.markDailyGoalCelebrated);
  const [visible, setVisible] = useState(false);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (xpToday < dailyGoal) return;
    if (lastCelebrated === todayKey()) return;
    setVisible(true);
    markCelebrated();
    scale.value = withSequence(
      withTiming(1.15, { duration: 320, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
  }, [xpToday, dailyGoal, lastCelebrated, markCelebrated, scale]);

  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.backdrop}>
        <Animated.View entering={FadeIn} style={styles.card}>
          <Animated.Text style={[styles.trophy, trophyStyle]}>🏆</Animated.Text>
          <Text style={styles.title}>Meta diária batida!</Text>
          <Text style={styles.body}>
            Você fez {xpToday} XP hoje — passou da meta de {dailyGoal}!
            Continue pra estender sua sequência.
          </Text>
          <Pressable
            onPress={() => setVisible(false)}
            style={styles.cta}
            accessibilityRole="button"
            accessibilityLabel="Continuar"
          >
            <Text style={styles.ctaText}>Continuar</Text>
          </Pressable>
        </Animated.View>
        {visible && (
          <ConfettiCannon
            count={120}
            origin={{ x: Dimensions.get("window").width / 2, y: 0 }}
            fadeOut
            autoStart
            fallSpeed={2800}
            explosionSpeed={500}
          />
        )}
      </View>
    </Modal>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
    },
    card: {
      backgroundColor: c.neutral.elevated,
      borderRadius: 24,
      padding: 28,
      alignItems: "center",
      gap: 10,
      maxWidth: 380,
      ...cardShadow({ opacity: 0.22, radius: 20, y: 6, elevation: 14 }),
    },
    trophy: { fontSize: 72, lineHeight: 86 },
    title: {
      fontFamily: "Poppins-Bold",
      fontSize: 22,
      color: c.neutral.textPrimary,
      textAlign: "center",
    },
    body: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
      textAlign: "center",
      lineHeight: 19,
    },
    cta: {
      marginTop: 8,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.primary.purple,
    },
    ctaText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
  });
}
