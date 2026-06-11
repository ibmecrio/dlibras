// Modal antes de entrar na lição — mostra letras que serão praticadas,
// XP a ganhar, hearts disponíveis. Bloqueia start se hearts === 0.

import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";
import { useLearningStore } from "@/store/learningStore";

interface PreviewLesson {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  signTargets: { letter: string }[];
  vocabulary: { word: string; emoji?: string; pronunciation?: string }[];
}

interface Props {
  visible: boolean;
  lesson: PreviewLesson | null;
  onClose: () => void;
  onStart: () => void;
}

export function LessonPreviewModal({ visible, lesson, onClose, onStart }: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const hearts = useLearningStore((s) => s.hearts);
  const unlimited = useLearningStore((s) => s.unlimitedHearts);

  if (!lesson) return null;

  const blocked = !unlimited && hearts <= 0;
  const letters = lesson.signTargets.map((t) => t.letter.toUpperCase());

  function emojiFor(letter: string): string {
    const entry = lesson?.vocabulary.find(
      (v) => v.word.toUpperCase() === letter,
    );
    return entry?.emoji ?? "🤚";
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Fechar preview"
          onPress={onClose}
        >
          <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop} />
        </Pressable>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title} numberOfLines={2}>
            {lesson.title}
          </Text>
          <Text style={styles.subtitle}>{lesson.description}</Text>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Ionicons name="trophy" size={16} color={c.semantic.warning} />
              <Text style={styles.statText}>+{lesson.xpReward} XP</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="flag" size={16} color={c.primary.purple} />
              <Text style={styles.statText}>{letters.length} letras</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons
                name={unlimited ? "infinite" : "heart"}
                size={16}
                color={c.semantic.error}
              />
              <Text style={styles.statText}>
                {unlimited ? "∞ vidas" : `${hearts}/5 vidas`}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Você vai praticar</Text>
          <View style={styles.lettersGrid}>
            {letters.map((letter) => (
              <View key={letter} style={styles.letterChip}>
                <Text style={styles.letterEmoji}>{emojiFor(letter)}</Text>
                <Text style={styles.letterText}>{letter}</Text>
              </View>
            ))}
          </View>

          {blocked && (
            <View style={styles.blockedBanner}>
              <Ionicons name="heart-dislike" size={16} color="#fff" />
              <Text style={styles.blockedText}>
                Sem vidas. Aguarde regen (30min) ou ative ilimitado nos hearts.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
            >
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={onStart}
              disabled={blocked}
              style={({ pressed }) => [
                styles.btnPrimary,
                blocked && { opacity: 0.5 },
                pressed && !blocked && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Iniciar lição"
            >
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.btnPrimaryText}>Começar</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    sheet: {
      backgroundColor: c.neutral.elevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 28,
      gap: 10,
      maxWidth: 600,
      alignSelf: "center",
      width: "100%",
      ...cardShadow({ opacity: 0.16, radius: 16, y: -4, elevation: 12 }),
    },
    handle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.neutral.border,
    },
    title: {
      fontFamily: "Poppins-Bold",
      fontSize: 20,
      color: c.neutral.textPrimary,
      marginTop: 6,
    },
    subtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
      marginBottom: 4,
    },
    statRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    stat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: c.neutral.surface,
    },
    statText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.neutral.textPrimary,
    },
    sectionTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.neutral.textSecondary,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginTop: 4,
    },
    lettersGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    letterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
    },
    letterEmoji: { fontSize: 18 },
    letterText: {
      fontFamily: "Poppins-Bold",
      fontSize: 14,
      color: c.primary.purple,
    },
    blockedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.semantic.error,
      marginTop: 4,
    },
    blockedText: {
      flex: 1,
      color: "#fff",
      fontFamily: "Poppins-Medium",
      fontSize: 11,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    btnGhost: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      alignItems: "center",
      justifyContent: "center",
    },
    btnGhostText: {
      color: c.neutral.textPrimary,
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
    },
    btnPrimary: {
      flex: 1.5,
      flexDirection: "row",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.primary.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
  });
}
