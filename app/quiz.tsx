// Tela de quiz multipla escolha — 5 perguntas das letras já vistas.
//
// Fluxo:
//   1. Mostra emoji da letra ("Qual letra esse sinal representa?")
//   2. 4 opções (1 correta + 3 distratoras das letras concluídas)
//   3. Feedback imediato (verde correto / vermelho errado)
//   4. Próxima pergunta
//   5. Final: XP ganho, heart perdido se errou, navega de volta
//
// Quando aparece:
//   - Acessível pela home (botão "Revisar") quando completedLessonIds >= 3
//   - Não aparece automático ainda (TODO: trigger pós-lição)

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { LESSONS } from "@/data/lessons";
import { playCelebration, playWrongChime } from "@/lib/audio";
import { safeBack } from "@/lib/navigation";
import { posthog } from "@/lib/posthog";
import { speak as ttsSpeak } from "@/lib/voice";
import { useLearningStore } from "@/store/learningStore";

interface QuizQuestion {
  letter: string;
  emoji: string;
  pronunciation: string;
  options: string[]; // 4 letras (1 correta + 3 distratoras)
}

function buildQuestions(seenLetters: string[]): QuizQuestion[] {
  // Catalogo de todas as letras únicas vistas com emoji + pronunciation
  const catalog: Record<string, { emoji: string; pronunciation: string }> = {};
  for (const lesson of LESSONS) {
    for (const v of lesson.vocabulary) {
      const k = v.word.toUpperCase();
      if (!catalog[k]) {
        catalog[k] = {
          emoji: v.emoji ?? "🤚",
          pronunciation: v.pronunciation,
        };
      }
    }
  }
  const letters = seenLetters.filter((l) => catalog[l]);
  if (letters.length < 4) return [];

  const shuffled = [...letters].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(5, letters.length));
  return picked.map((letter) => {
    const data = catalog[letter];
    // Distratoras: outras letras vistas, embaralhadas
    const distractors = letters
      .filter((l) => l !== letter)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const options = [...distractors, letter].sort(() => Math.random() - 0.5);
    return {
      letter,
      emoji: data.emoji,
      pronunciation: data.pronunciation,
      options,
    };
  });
}

function lettersFromCompletedLessons(completedIds: string[]): string[] {
  const seen = new Set<string>();
  for (const id of completedIds) {
    const lesson = LESSONS.find((l) => l.id === id);
    if (!lesson?.signTargets) continue;
    for (const t of lesson.signTargets) {
      seen.add(t.letter.toUpperCase());
    }
  }
  return Array.from(seen);
}

export default function QuizScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const completedIds = useLearningStore((s) => s.completedLessonIds);
  const addXP = useLearningStore((s) => s.addXP);
  const loseHeart = useLearningStore((s) => s.loseHeart);
  const registerLetterResult = useLearningStore((s) => s.registerLetterResult);
  const audioEnabled = useLearningStore((s) => s.audioFeedbackEnabled);

  const seenLetters = useMemo(
    () => lettersFromCompletedLessons(completedIds),
    [completedIds],
  );
  const [questions] = useState<QuizQuestion[]>(() =>
    buildQuestions(seenLetters),
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    posthog.capture("quiz_started", { question_count: questions.length });
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [questions.length]);

  const current = questions[index];

  function handleSelect(option: string) {
    if (selected || !current) return;
    setSelected(option);
    const correct = option === current.letter;
    if (correct) {
      setScore((s) => s + 1);
      if (audioEnabled) void playCelebration();
      registerLetterResult(current.letter, true);
      void ttsSpeak(current.letter);
    } else {
      if (audioEnabled) void playWrongChime();
      registerLetterResult(current.letter, false);
      loseHeart();
    }
    posthog.capture("quiz_answer", {
      letter: current.letter,
      selected: option,
      correct,
      index,
    });

    advanceTimerRef.current = setTimeout(() => {
      if (index + 1 >= questions.length) {
        finishQuiz(correct ? score + 1 : score);
      } else {
        setIndex((i) => i + 1);
        setSelected(null);
      }
    }, 1100);
  }

  function finishQuiz(finalScore: number) {
    const xp = finalScore * 5;
    addXP(xp);
    posthog.capture("quiz_completed", {
      score: finalScore,
      total: questions.length,
      xp,
    });
    setDone(true);
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notReadyWrap}>
          <Ionicons name="school-outline" size={56} color={c.primary.purple} />
          <Text style={styles.notReadyTitle}>Quiz indisponível</Text>
          <Text style={styles.notReadyBody}>
            Complete ao menos 1 lição com 4 letras pra desbloquear o quiz de
            revisão.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => safeBack(router)}
          >
            <Text style={styles.primaryBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    const total = questions.length;
    const perfect = score === total;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneEmoji}>{perfect ? "🌟" : "🎉"}</Text>
          <Animated.Text entering={FadeIn} style={styles.doneTitle}>
            {perfect ? "Perfeito!" : "Quiz completo!"}
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(180)} style={styles.doneSubtitle}>
            Acertou {score} de {total} · +{score * 5} XP
          </Animated.Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => safeBack(router)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Voltar pro mapa</Text>
          </Pressable>
          {perfect && (
            <ConfettiCannon
              count={140}
              origin={{ x: Dimensions.get("window").width / 2, y: 0 }}
              fadeOut
              autoStart
              fallSpeed={2800}
              explosionSpeed={500}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack(router)} hitSlop={8}>
          <Ionicons name="close" size={24} color={c.neutral.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((index + 1) / questions.length) * 100}%` as `${number}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.headerCount}>
          {index + 1}/{questions.length}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.questionLabel}>Qual letra é essa?</Text>
        <Animated.View
          key={current.letter}
          entering={FadeInDown.duration(280)}
          style={styles.emojiCard}
        >
          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={styles.pronunciation} numberOfLines={2}>
            {current.pronunciation}
          </Text>
        </Animated.View>

        <View style={styles.options}>
          {current.options.map((opt) => {
            const isCorrect = selected && opt === current.letter;
            const isWrong =
              selected === opt && opt !== current.letter;
            return (
              <OptionButton
                key={opt}
                letter={opt}
                disabled={!!selected}
                isCorrect={!!isCorrect}
                isWrong={isWrong}
                onPress={() => handleSelect(opt)}
                styles={styles}
                c={c}
              />
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function OptionButton({
  letter,
  disabled,
  isCorrect,
  isWrong,
  onPress,
  styles,
  c,
}: {
  letter: string;
  disabled: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  c: ThemeColors;
}) {
  const shake = useSharedValue(0);
  useEffect(() => {
    if (isWrong) {
      shake.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
    }
  }, [isWrong, shake]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.optionBtn,
          isCorrect && {
            backgroundColor: c.semantic.success,
            borderColor: c.semantic.success,
          },
          isWrong && {
            backgroundColor: c.semantic.error,
            borderColor: c.semantic.error,
          },
          pressed && !disabled && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Opção ${letter}`}
      >
        <Text
          style={[
            styles.optionText,
            (isCorrect || isWrong) && { color: "#fff" },
          ]}
        >
          {letter}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 12,
    },
    progressTrack: {
      flex: 1,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.neutral.surface,
      overflow: "hidden",
    },
    progressFill: {
      height: 10,
      borderRadius: 5,
      backgroundColor: c.primary.purple,
    },
    headerCount: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.neutral.textSecondary,
    },
    body: {
      flex: 1,
      padding: 20,
      gap: 18,
    },
    questionLabel: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textSecondary,
      textAlign: "center",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    emojiCard: {
      backgroundColor: c.neutral.elevated,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.neutral.border,
      paddingVertical: 36,
      paddingHorizontal: 24,
      alignItems: "center",
      gap: 10,
    },
    emoji: {
      fontSize: 96,
      lineHeight: 110,
    },
    pronunciation: {
      fontFamily: "Poppins-Medium",
      fontSize: 13,
      color: c.neutral.textSecondary,
      textAlign: "center",
      fontStyle: "italic",
    },
    options: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
    },
    optionBtn: {
      width: 130,
      paddingVertical: 22,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    optionText: {
      fontFamily: "Poppins-Bold",
      fontSize: 32,
      color: c.neutral.textPrimary,
      letterSpacing: 1,
    },
    doneWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      gap: 12,
    },
    doneEmoji: { fontSize: 72 },
    doneTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 28,
      color: c.neutral.textPrimary,
    },
    doneSubtitle: {
      fontFamily: "Poppins-Medium",
      fontSize: 15,
      color: c.neutral.textSecondary,
    },
    primaryBtn: {
      marginTop: 20,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: c.primary.purple,
    },
    primaryBtnText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
    notReadyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      gap: 14,
    },
    notReadyTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 20,
      color: c.neutral.textPrimary,
    },
    notReadyBody: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
      textAlign: "center",
      maxWidth: 360,
      lineHeight: 20,
    },
  });
}
