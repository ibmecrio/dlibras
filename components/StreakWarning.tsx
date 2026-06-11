// Banner laranja no topo da home quando o streak está em risco
// (≥ 1 dia, sem XP hoje, faltam ≤ 4h pra meia-noite).

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { useLearningStore } from "@/store/learningStore";

const HOURS_THRESHOLD = 4;

function hoursTillMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return (midnight.getTime() - now.getTime()) / 3_600_000;
}

interface Props {
  onCta?: () => void;
}

export function StreakWarning({ onCta }: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const streak = useLearningStore((s) => s.streak);
  const xpToday = useLearningStore((s) => s.xpToday);
  const [hours, setHours] = useState<number>(() => hoursTillMidnight());

  useEffect(() => {
    const id = setInterval(() => setHours(hoursTillMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);

  const shouldShow = streak >= 1 && xpToday === 0 && hours <= HOURS_THRESHOLD;
  if (!shouldShow) return null;

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="flame" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Sua sequência de {streak} dias está em risco</Text>
        <Text style={styles.body}>
          Faltam {Math.ceil(hours)}h pra meia-noite. Ganhe XP hoje pra não perder!
        </Text>
      </View>
      {onCta && (
        <Pressable
          onPress={onCta}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Praticar agora"
        >
          <Text style={styles.ctaText}>Praticar</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.semantic.streak,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    title: {
      color: "#fff",
      fontFamily: "Poppins-Bold",
      fontSize: 13,
    },
    body: {
      color: "rgba(255,255,255,0.92)",
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      marginTop: 2,
    },
    cta: {
      backgroundColor: "#fff",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    ctaText: {
      color: c.semantic.streak,
      fontFamily: "Poppins-SemiBold",
      fontSize: 12,
    },
  });
}
