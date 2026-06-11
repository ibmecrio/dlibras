import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";
import { Lesson } from "@/types/learning";

interface LessonCardProps {
  lesson: Lesson;
  index: number;
  isCompleted: boolean;
  isInProgress: boolean;
  onPress: () => void;
}

// Thumbnail brand-friendly: pega a primeira letra-alvo da lição e mostra
// num círculo colorido por unidade. Sem rede, sem placeholders aleatórios.
function getLessonGlyph(lesson: Lesson): {
  text: string;
  background: string;
  color: string;
} {
  const targets = lesson.signTargets ?? [];
  if (lesson.unitId === "libras-unit-2") {
    return {
      text: targets.map((t) => t.letter).join("").slice(0, 4) || "?",
      background: "#DBEAFE",
      color: "#2563eb",
    };
  }
  if (lesson.unitId === "libras-unit-3") {
    return {
      text: targets[0]?.letter ?? "?",
      background: "#FEE2E2",
      color: "#ef4444",
    };
  }
  return {
    text: targets[0]?.letter ?? lesson.title.slice(0, 1),
    background: "#DCFCE7",
    color: "#16a34a",
  };
}

export function LessonCard({
  lesson,
  index,
  isCompleted,
  isInProgress,
  onPress,
}: LessonCardProps) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const glyph = useMemo(() => getLessonGlyph(lesson), [lesson]);
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(380)}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Lição ${index + 1}: ${lesson.title}${
          isCompleted ? " — concluída" : isInProgress ? " — em andamento" : ""
        }`}
        style={[styles.card, isInProgress && styles.cardInProgress]}
      >
        <View
          style={[styles.glyph, { backgroundColor: glyph.background }]}
        >
          <Text
            style={[styles.glyphText, { color: glyph.color }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {glyph.text}
          </Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.row}>
            <Text style={styles.captionText}>Lição {index + 1}</Text>
            {isInProgress && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Em andamento</Text>
              </View>
            )}
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {lesson.title}
          </Text>

          <Text style={styles.subtitle}>
            {lesson.activities.length} atividades · {lesson.xpReward} XP
          </Text>
        </View>

        {isCompleted && (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.neutral.elevated,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.neutral.border,
      ...cardShadow({ opacity: 0.04, radius: 4, y: 1, elevation: 1 }),
    },
    cardInProgress: {
      backgroundColor:
        c.neutral.background === "#ffffff" ? "#EDE9FE" : c.neutral.surface,
      borderColor: c.primary.purple,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    captionText: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
    },
    badge: {
      backgroundColor:
        c.neutral.background === "#ffffff"
          ? "rgba(108, 78, 245, 0.12)"
          : "rgba(139, 115, 255, 0.2)",
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 10,
      color: c.primary.purple,
      fontFamily: "Poppins-Medium",
    },
    title: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
      color: c.neutral.textPrimary,
    },
    subtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
    },
    checkCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.semantic.success,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 12,
    },
    glyph: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    glyphText: {
      fontFamily: "Poppins-Bold",
      fontSize: 22,
      paddingHorizontal: 4,
    },
  });
}
