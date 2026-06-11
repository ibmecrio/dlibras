import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { speak as ttsSpeak, stopSpeaking } from "@/lib/voice";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { LibrasCamera } from "@/components/LibrasCamera";
import { LibrasMotionCamera } from "@/components/LibrasMotionCamera";
import { MascotBubble } from "@/components/MascotBubble";
import { XpFloat } from "@/components/XpFloat";
import { colors, useThemeColors } from "@/constants/theme";
import { LESSONS } from "@/data/lessons";
import { safeBack } from "@/lib/navigation";
import { posthog } from "@/lib/posthog";
import { useLearningStore } from "@/store/learningStore";

const COMPLETION_FALLBACK_DELAY_MS = 1200;
const ADVANCE_DELAY_MS = 1100;

export default function DemoLessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const { completeLesson, addXP } = useLearningStore();

  const lesson = LESSONS.find((l) => l.id === id);

  const [signIndex, setSignIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [xpFloat, setXpFloat] = useState<number | null>(null);
  const lessonStartTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Segundo timer (volta pro mapa depois do confete) — também precisa de
  // cleanup pra não empilhar router.back() se o usuário sair antes.
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // signIndex é lido dentro de handleSignMatched via ref — assim o callback
  // pode ter identidade estável (useCallback com [] deps), o que evita
  // resetar o loop de captura da câmera a cada re-render do parent.
  const signIndexRef = useRef(0);

  const signTargets = lesson?.signTargets ?? [];
  const currentTarget = signTargets[signIndex];
  const isFinished = signIndex >= signTargets.length;
  const isWordLesson = lesson?.unitId === "libras-unit-2";
  // Palavra alvo (das lições de soletrar): concatena as letras de signTargets.
  const targetWord = isWordLesson
    ? signTargets.map((t) => t.letter).join("")
    : null;

  useEffect(() => {
    signIndexRef.current = signIndex;
  }, [signIndex]);

  useEffect(() => {
    if (!lesson) return;
    lessonStartTimeRef.current = Date.now();
    posthog.capture("lesson_started", {
      lesson_id: lesson.id,
      language: "libras",
      sign_count: signTargets.length,
    });
    // Lê em voz alta os alvos da lição assim que ela abre — usa expo-speech
    // que já era usado no finish. Falha silenciosa se TTS não disponível.
    try {
      const letters = signTargets.map((t) => t.letter).join(", ");
      const intro = isWordLesson && targetWord
        ? `Vamos soletrar ${targetWord.split("").join(", ")}. ${targetWord}.`
        : `Vamos praticar as letras ${letters}.`;
      void ttsSpeak(intro);
    } catch {}
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      try {
        stopSpeaking();
      } catch {}
      if (!completedRef.current) {
        posthog.capture("lesson_abandoned", {
          lesson_id: lesson.id,
          progress: `${signIndexRef.current}/${signTargets.length}`,
          time_into_lesson_seconds: lessonStartTimeRef.current
            ? Math.floor((Date.now() - lessonStartTimeRef.current) / 1000)
            : 0,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  function finishLesson() {
    if (!lesson || completedRef.current) return;
    completedRef.current = true;
    completeLesson(lesson.id);
    addXP(lesson.xpReward);
    setXpFloat(lesson.xpReward);
    posthog.capture("lesson_completed", {
      lesson_id: lesson.id,
      language: "libras",
      xp_reward: lesson.xpReward,
      duration_seconds: lessonStartTimeRef.current
        ? Math.floor((Date.now() - lessonStartTimeRef.current) / 1000)
        : 0,
    });
    void ttsSpeak(`Boa! ${lesson.xpReward} pontos de experiência ganhos.`);
  }

  function handleSkipLetter() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    posthog.capture("lesson_letter_skipped", {
      lesson_id: lesson?.id ?? id ?? "",
      sign_index: signIndex,
    });
    setHintShown(false);
    const next = signIndex + 1;
    if (next >= signTargets.length) {
      finishLesson();
      exitTimerRef.current = setTimeout(
        () => safeBack(router),
        COMPLETION_FALLBACK_DELAY_MS,
      );
    }
    setSignIndex(next);
  }

  function handleTogglePause() {
    setPaused((p) => {
      if (!p) {
        try { stopSpeaking(); } catch {}
      }
      posthog.capture("lesson_pause_toggled", { paused: !p });
      return !p;
    });
  }

  function handleShowHint() {
    setHintShown(true);
    if (currentTarget) {
      const vocab = lesson?.vocabulary.find(
        (v) => v.word.toUpperCase() === currentTarget.letter,
      );
      const hint = vocab?.pronunciation
        ? `Letra ${currentTarget.letter}: ${vocab.pronunciation}.`
        : `Lembre da posição da letra ${currentTarget.letter}.`;
      void ttsSpeak(hint);
    }
    setTimeout(() => setHintShown(false), 4500);
  }

  // useCallback com [] deps + signIndexRef: identidade estável durante toda
  // a vida do componente, então a LibrasCamera não recria o setInterval a
  // cada render do parent.
  const handleSignMatched = useCallback(
    (letter: string) => {
      const idx = signIndexRef.current;
      posthog.capture("libras_sign_matched", {
        lesson_id: lesson?.id ?? id,
        letter,
        sign_index: idx,
      });
      advanceTimerRef.current = setTimeout(() => {
        const next = idx + 1;
        if (next >= signTargets.length) {
          finishLesson();
          exitTimerRef.current = setTimeout(
            () => safeBack(router),
            COMPLETION_FALLBACK_DELAY_MS,
          );
        }
        setSignIndex(next);
      }, ADVANCE_DELAY_MS);
    },
    // signTargets.length e router são estáveis pra uma mesma lesson; lesson
    // só muda se a rota mudar (id diferente), o que já desmonta o screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function handleLeave() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    safeBack(router);
  }

  if (!lesson) {
    return (
      <SafeAreaView
        style={[
          styles.notFoundWrap,
          { backgroundColor: c.neutral.background },
        ]}
      >
        <Text style={[styles.notFoundTitle, { color: c.neutral.textPrimary }]}>
          Lição não encontrada
        </Text>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: c.primary.purple }]}
          onPress={() => safeBack(router)}
        >
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Mascote só aparece enquanto a lição está em andamento — não na celebração.
  const showMascot = !isFinished && signTargets.length > 0;
  const mascotProgress = signTargets.length
    ? signIndex / signTargets.length
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.neutral.background }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleLeave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar pro mapa de lições"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={c.neutral.textPrimary}
          />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: c.neutral.textPrimary }]} numberOfLines={1}>
            {lesson.title}
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: c.neutral.textSecondary }]}
          >
            {Math.min(signIndex + 1, signTargets.length)} / {signTargets.length}
          </Text>
        </View>
        <View style={styles.headerRightSpacer}>
          {showMascot && (
            <MascotBubble
              progress={mascotProgress}
              total={signTargets.length}
              current={signIndex}
            />
          )}
        </View>
      </View>

      {/* Word-builder strip: só nas lições de soletrar.
          Cada letra começa underscore, vira roxa quando é a atual, e verde
          quando o aluno já mostrou ela na câmera. */}
      {isWordLesson && targetWord && (
        <View style={styles.wordRow}>
          {targetWord.split("").map((ch, i) => {
            const done = i < signIndex;
            const active = i === signIndex && !isFinished;
            return (
              <View
                key={`${ch}-${i}`}
                style={[
                  styles.wordCell,
                  { backgroundColor: c.neutral.surface, borderColor: c.neutral.border },
                  done && { backgroundColor: c.semantic.success, borderColor: c.semantic.success },
                  active && { backgroundColor: c.primary.purple, borderColor: c.primary.purple },
                ]}
              >
                <Text
                  style={[
                    styles.wordCellChar,
                    { color: c.neutral.textSecondary },
                    (done || active) && styles.wordCellCharOn,
                  ]}
                >
                  {done || active || isFinished ? ch : "_"}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Action bar: Pause + Hint + Skip — só durante a lição */}
      {!isFinished && currentTarget && (
        <View style={styles.actionBar}>
          <Pressable
            onPress={handleTogglePause}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && { opacity: 0.7 },
              paused && styles.actionBtnActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={paused ? "Continuar" : "Pausar"}
          >
            <Ionicons
              name={paused ? "play" : "pause"}
              size={16}
              color={paused ? "#fff" : c.primary.purple}
            />
            <Text style={[styles.actionBtnText, paused && { color: "#fff" }]}>
              {paused ? "Continuar" : "Pausar"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShowHint}
            disabled={hintShown}
            style={({ pressed }) => [
              styles.actionBtn,
              hintShown && styles.actionBtnActive,
              pressed && !hintShown && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Dica"
          >
            <Ionicons
              name={hintShown ? "bulb" : "bulb-outline"}
              size={16}
              color={hintShown ? "#fff" : c.primary.purple}
            />
            <Text
              style={[styles.actionBtnText, hintShown && { color: "#fff" }]}
            >
              Dica
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSkipLetter}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pular letra"
          >
            <Ionicons
              name="play-skip-forward"
              size={16}
              color={c.primary.purple}
            />
            <Text style={styles.actionBtnText}>Pular</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.cameraContainer}>
        {isFinished || !currentTarget ? (
          <View style={styles.finishedWrap}>
            <CelebrationStar />
            <Text style={styles.finishedTitle}>Lição completa!</Text>
            <Text style={styles.finishedSubtitle}>
              +{lesson.xpReward} XP — voltando ao mapa…
            </Text>
            <ConfettiCannon
              count={140}
              origin={{ x: Dimensions.get("window").width / 2, y: 0 }}
              fadeOut
              autoStart
              fallSpeed={2800}
              explosionSpeed={500}
            />
          </View>
        ) : lesson.unitId === "libras-unit-3" ? (
          <LibrasMotionCamera
            target={currentTarget.letter}
            hint={lesson.vocabulary[0]?.pronunciation ?? ""}
            onMatch={handleSignMatched}
          />
        ) : (
          <LibrasCamera
            target={currentTarget.letter}
            paused={paused}
            onMatch={handleSignMatched}
          />
        )}
        {paused && (
          <View style={styles.pauseOverlay} pointerEvents="none">
            <Ionicons name="pause-circle" size={64} color="#fff" />
            <Text style={styles.pauseOverlayText}>Pausado</Text>
          </View>
        )}
      </View>

      {xpFloat !== null && (
        <XpFloat amount={xpFloat} onDone={() => setXpFloat(null)} />
      )}

      {/* Vocabulário da lição embaixo, pro estudante consultar */}
      <View style={styles.vocabRow}>
        {signTargets.map((t, idx) => (
          <View
            key={t.letter}
            style={[
              styles.vocabChip,
              { backgroundColor: c.neutral.surface, borderColor: c.neutral.border },
              idx === signIndex && { backgroundColor: c.primary.purple, borderColor: c.primary.purple },
              idx < signIndex && { backgroundColor: c.semantic.success, borderColor: c.semantic.success },
            ]}
          >
            <Text
              style={[
                styles.vocabLetter,
                { color: c.neutral.textPrimary },
                idx === signIndex && styles.vocabLetterActive,
                idx < signIndex && styles.vocabLetterDone,
              ]}
            >
              {t.letter}
            </Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

// Estrela animada da tela de conclusão — bounce pra dar peso ao acerto.
function CelebrationStar() {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.25, { duration: 360, easing: Easing.out(Easing.back(1.8)) }),
      withTiming(1, { duration: 240, easing: Easing.inOut(Easing.quad) }),
    );
  }, [scale]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.Text style={[styles.finishedEmoji, animStyle]}>⭐</Animated.Text>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  actionBtnActive: {
    backgroundColor: colors.primary.purple,
    borderColor: colors.primary.purple,
  },
  actionBtnText: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 11,
    color: colors.primary.purple,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pauseOverlayText: {
    color: "#fff",
    fontFamily: "Poppins-Bold",
    fontSize: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 15,
    color: colors.neutral.textPrimary,
  },
  headerSubtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: colors.neutral.textSecondary,
    marginTop: 1,
  },
  headerRightSpacer: {
    width: 80,
    height: 50,
    justifyContent: "center",
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  vocabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  wordRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  wordCell: {
    minWidth: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
  },
  wordCellActive: {
    backgroundColor: colors.primary.purple,
    borderColor: colors.primary.purple,
  },
  wordCellDone: {
    backgroundColor: colors.semantic.success,
    borderColor: colors.semantic.success,
  },
  wordCellChar: {
    fontFamily: "Poppins-Bold",
    fontSize: 22,
    color: colors.neutral.textSecondary,
    letterSpacing: 1,
  },
  wordCellCharOn: {
    color: "#fff",
  },
  vocabChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    alignItems: "center",
    justifyContent: "center",
  },
  vocabChipActive: {
    backgroundColor: colors.primary.purple,
    borderColor: colors.primary.purple,
  },
  vocabChipDone: {
    backgroundColor: colors.semantic.success,
    borderColor: colors.semantic.success,
  },
  vocabLetter: {
    fontFamily: "Poppins-Bold",
    fontSize: 16,
    color: colors.neutral.textPrimary,
  },
  vocabLetterActive: {
    color: "#fff",
  },
  vocabLetterDone: {
    color: "#fff",
  },
  finishedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.semantic.success,
    gap: 8,
  },
  finishedEmoji: {
    fontSize: 64,
  },
  finishedTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 26,
    color: "#fff",
  },
  finishedSubtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  notFoundWrap: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  notFoundTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 18,
    color: colors.neutral.textPrimary,
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primary.purple,
  },
  primaryButtonText: {
    color: "#fff",
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
  },
});
