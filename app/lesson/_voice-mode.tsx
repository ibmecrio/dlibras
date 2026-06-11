// Modo professor (voice mode) — funciona em WEB e MOBILE.
//
// Pipeline 100% HTTP (sem WebRTC / Stream / OpenAI Realtime):
//   - Claude (lib/claude.ts)     → gera as instruções da Bia em pt-BR
//   - ElevenLabs (lib/voice.ts)  → voz neural natural
//   - AssemblyAI (lib/stt.ts)    → transcreve perguntas do aluno
//   - LibrasCamera               → reconhece a letra na câmera
//
// Fluxo:
//   1. Lição abre → Bia se apresenta + explica a 1ª letra
//   2. Aluno mostra na câmera → Vision API detecta → Bia parabeniza
//   3. Bia explica a próxima letra
//   4. Push-to-talk (segura o mic) → AssemblyAI → Claude → Bia responde
//   5. Última letra detectada → celebração + XP + volta pro mapa

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { LibrasCamera } from "@/components/LibrasCamera";
import { images } from "@/constants/images";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { LESSONS } from "@/data/lessons";
import { askClaude } from "@/lib/claude";
import { safeBack } from "@/lib/navigation";
import { posthog } from "@/lib/posthog";
import {
  cancelRecording,
  startRecording,
  stopAndTranscribeDetailed,
  type RecordingHandle,
  type StartRecordingResult,
} from "@/lib/stt";
import { cardShadow } from "@/lib/styles";
import { speak as ttsSpeak, stopSpeaking } from "@/lib/voice";
import { useLearningStore } from "@/store/learningStore";

const ADVANCE_DELAY_MS = 1400;
const COMPLETION_FALLBACK_MS = 3500;

export default function VoiceLessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { completeLesson, addXP, audioFeedbackEnabled } = useLearningStore();

  const lesson = LESSONS.find((l) => l.id === id);
  const signTargets = lesson?.signTargets ?? [];

  const [signIndex, setSignIndex] = useState(0);
  const [biaMessage, setBiaMessage] = useState(
    lesson ? `Oi! Vamos aprender ${lesson.title.toLowerCase()} juntos.` : "Oi!",
  );
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const currentTarget = signTargets[signIndex];
  const isFinished = signIndex >= signTargets.length;
  const isWordLesson = lesson?.unitId === "libras-unit-2";
  const targetWord = isWordLesson
    ? signTargets.map((t) => t.letter).join("")
    : null;

  const signIndexRef = useRef(0);
  const completedRef = useRef(false);
  const lessonStartTimeRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<RecordingHandle | null>(null);
  // Promise da start em flight pra evitar race quando user solta o botão
  // antes da permissão resolver.
  const startPromiseRef = useRef<Promise<StartRecordingResult> | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  // Token pra invalidar respostas atrasadas da Bia quando o aluno avança
  // ou cancela antes da resposta chegar.
  const askTokenRef = useRef(0);

  useEffect(() => {
    signIndexRef.current = signIndex;
  }, [signIndex]);

  // Setup inicial + cleanup
  useEffect(() => {
    if (!lesson) return;
    lessonStartTimeRef.current = Date.now();
    posthog.capture("voice_lesson_started", {
      lesson_id: lesson.id,
      sign_count: signTargets.length,
    });
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      stopSpeaking();
      if (recordingRef.current) {
        void cancelRecording(recordingRef.current);
        recordingRef.current = null;
      }
      if (!completedRef.current) {
        posthog.capture("voice_lesson_abandoned", {
          lesson_id: lesson.id,
          progress: `${signIndexRef.current}/${signTargets.length}`,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  // Quando a letra muda, pede pro Claude explicar e a Bia fala.
  useEffect(() => {
    if (!currentTarget || !lesson || isFinished) return;
    let cancelled = false;
    const token = ++askTokenRef.current;

    async function teach() {
      setIsThinking(true);
      const letter = currentTarget.letter;
      const isMotion = lesson?.unitId === "libras-unit-3";
      const isFirst = signIndexRef.current === 0;
      // Prompt enxuto + alternado, pra Claude responder diferente cada vez
      // e não cair sempre no mesmo template "fica firme por uns instantes".
      const variants = [
        `Ensina o ${letter}. Diz a forma da mão em 1-2 frases bem curtas.`,
        `Como faz o sinal de ${letter}? Posição da mão, dedos, polegar.`,
        `Próxima é ${letter}. Descreve a mão.`,
        `Vamos pra ${letter}. Manda a posição.`,
      ];
      const choice = variants[Math.floor(Math.random() * variants.length)];
      const motionHint = isMotion
        ? " Essa letra tem movimento — descreve o gesto."
        : "";
      const firstHint = isFirst
        ? " (Primeira letra, pode dar uma motivada rápida.)"
        : "";
      const prompt = `${choice}${motionHint}${firstHint}`;

      const text = await askClaude(prompt);
      if (cancelled || token !== askTokenRef.current) return;
      setIsThinking(false);

      const message =
        text ??
        `Vamos pra letra ${letter}. ${currentTarget.translation ?? "Mostra na câmera."}`;
      setBiaMessage(message);
      if (audioFeedbackEnabled) {
        setIsSpeaking(true);
        await ttsSpeak(message);
        if (!cancelled && token === askTokenRef.current) {
          setIsSpeaking(false);
        }
      }
    }

    void teach();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTarget?.letter, lesson?.id, isFinished]);

  function finishLesson() {
    if (!lesson || completedRef.current) return;
    completedRef.current = true;
    completeLesson(lesson.id);
    addXP(lesson.xpReward);
    posthog.capture("voice_lesson_completed", {
      lesson_id: lesson.id,
      xp_reward: lesson.xpReward,
      duration_seconds: lessonStartTimeRef.current
        ? Math.floor((Date.now() - lessonStartTimeRef.current) / 1000)
        : 0,
    });
    const finalMsg = `Parabéns! Você completou a lição e ganhou ${lesson.xpReward} pontos de experiência. Continue praticando, viu?`;
    setBiaMessage(finalMsg);
    if (audioFeedbackEnabled) {
      void ttsSpeak(finalMsg);
    }
  }

  // Identidade estável — evita derrubar o setInterval da câmera quando o
  // parent re-renderiza por mudanças de estado da Bia.
  const handleSignMatched = useCallback(
    (letter: string) => {
      const idx = signIndexRef.current;
      posthog.capture("voice_sign_matched", {
        lesson_id: lesson?.id ?? id,
        letter,
        sign_index: idx,
      });

      const praise = pickPraise(letter);
      // Invalida qualquer resposta de "teach" anterior que ainda esteja
      // chegando — a Bia agora está parabenizando, não ensinando.
      askTokenRef.current += 1;
      setBiaMessage(praise);
      if (audioFeedbackEnabled) {
        setIsSpeaking(true);
        void ttsSpeak(praise).finally(() => setIsSpeaking(false));
      }

      advanceTimerRef.current = setTimeout(() => {
        const next = idx + 1;
        if (next >= signTargets.length) {
          finishLesson();
          exitTimerRef.current = setTimeout(
            () => safeBack(router),
            COMPLETION_FALLBACK_MS,
          );
        }
        setSignIndex(next);
      }, ADVANCE_DELAY_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audioFeedbackEnabled],
  );

  // ─── Push-to-talk ────────────────────────────────────────────────────
  async function handleMicPressIn() {
    if (isThinking || transcribing || isFinished) return;
    stopSpeaking();
    setIsSpeaking(false);
    setRecording(true);
    recordStartTimeRef.current = Date.now();
    posthog.capture("voice_lesson_record_start");
    // Dispara start sem esperar — handleMicPressOut espera o promise.
    startPromiseRef.current = startRecording();
  }

  async function handleMicPressOut() {
    const startPromise = startPromiseRef.current;
    startPromiseRef.current = null;
    setRecording(false);
    if (!startPromise) return;

    // Min 250ms pra MediaRecorder/expo-av terem tempo de capturar audio.
    const elapsed = Date.now() - recordStartTimeRef.current;
    if (elapsed < 250) {
      await new Promise((r) => setTimeout(r, 250 - elapsed));
    }

    const result = await startPromise;
    if (!result.ok) {
      setBiaMessage(result.reason);
      return;
    }
    recordingRef.current = result.recording;
    setTranscribing(true);
    const tx = await stopAndTranscribeDetailed(result.recording);
    recordingRef.current = null;
    setTranscribing(false);
    if (!tx.ok) {
      setBiaMessage(tx.reason);
      return;
    }
    const text = tx.text;
    if (!text || !text.trim()) {
      setBiaMessage("Não captei sua voz. Segura o botão por pelo menos 1 segundo.");
      return;
    }
    posthog.capture("voice_lesson_question_sent", { length: text.length });

    setIsThinking(true);
    setBiaMessage(`Você perguntou: "${text}". Deixa eu pensar…`);
    const token = ++askTokenRef.current;
    const ctx = currentTarget
      ? `[Contexto: o aluno está praticando a letra ${currentTarget.letter} em Libras.] `
      : "";
    const reply = await askClaude(`${ctx}Pergunta do aluno: ${text}`);
    if (token !== askTokenRef.current) return;
    setIsThinking(false);

    const message = reply ?? "Hmm, não consegui responder agora. Tenta de novo?";
    setBiaMessage(message);
    if (audioFeedbackEnabled) {
      setIsSpeaking(true);
      await ttsSpeak(message);
      if (token === askTokenRef.current) setIsSpeaking(false);
    }
  }

  function handleLeave() {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    stopSpeaking();
    safeBack(router);
  }

  // ─────────────────────────────────────────────────────────────────────
  if (!lesson) {
    return (
      <SafeAreaView style={styles.notFoundWrap}>
        <Text style={styles.notFoundTitle}>Lição não encontrada</Text>
        <Pressable style={styles.primaryButton} onPress={() => safeBack(router)}>
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleLeave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar pro mapa de lições"
        >
          <Ionicons name="chevron-back" size={24} color={c.neutral.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {lesson.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            Modo professor · {Math.min(signIndex + 1, signTargets.length)} /{" "}
            {signTargets.length}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Bia card — mascote + balão de fala + demo da mão */}
      <BiaTeacherCard
        message={biaMessage}
        isThinking={isThinking}
        isSpeaking={isSpeaking}
        currentTarget={currentTarget}
        currentVocab={
          currentTarget
            ? lesson.vocabulary.find(
                (v) => v.word.toUpperCase() === currentTarget.letter,
              )
            : undefined
        }
        styles={styles}
        c={c}
      />

      {/* Word strip (lições de soletrar) */}
      {isWordLesson && targetWord && !isFinished && (
        <View style={styles.wordRow}>
          {targetWord.split("").map((ch, i) => {
            const done = i < signIndex;
            const active = i === signIndex;
            return (
              <View
                key={`${ch}-${i}`}
                style={[
                  styles.wordCell,
                  done && styles.wordCellDone,
                  active && styles.wordCellActive,
                ]}
              >
                <Text
                  style={[
                    styles.wordCellChar,
                    (done || active) && styles.wordCellCharOn,
                  ]}
                >
                  {done || active ? ch : "_"}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Camera ou tela de conclusão */}
      <View style={styles.cameraContainer}>
        {isFinished || !currentTarget ? (
          <FinishedView lesson={lesson} styles={styles} />
        ) : (
          <LibrasCamera
            target={currentTarget.letter}
            paused={recording || transcribing}
            onMatch={handleSignMatched}
          />
        )}
      </View>

      {/* Vocab chips + mic */}
      {!isFinished && (
        <View style={styles.bottomRow}>
          <View style={styles.vocabRow}>
            {signTargets.map((t, idx) => (
              <View
                key={t.letter}
                style={[
                  styles.vocabChip,
                  idx === signIndex && styles.vocabChipActive,
                  idx < signIndex && styles.vocabChipDone,
                ]}
              >
                <Text
                  style={[
                    styles.vocabLetter,
                    (idx === signIndex || idx < signIndex) &&
                      styles.vocabLetterOn,
                  ]}
                >
                  {t.letter}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
            disabled={isThinking || transcribing}
            accessibilityRole="button"
            accessibilityLabel="Segure pra perguntar à Bia"
            style={({ pressed }) => [
              styles.micBtn,
              recording && styles.micBtnActive,
              pressed && { opacity: 0.85 },
              (isThinking || transcribing) && { opacity: 0.5 },
            ]}
          >
            {transcribing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={recording ? "mic" : "mic-outline"}
                size={22}
                color="#fff"
              />
            )}
            <Text style={styles.micBtnLabel}>
              {recording
                ? "Solte pra enviar"
                : transcribing
                  ? "Transcrevendo…"
                  : "Segure pra perguntar"}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bia teacher card — mascote com balão de fala animado + demo da mão
// ─────────────────────────────────────────────────────────────────────────
function BiaTeacherCard({
  message,
  isThinking,
  isSpeaking,
  currentTarget,
  currentVocab,
  styles,
  c,
}: {
  message: string;
  isThinking: boolean;
  isSpeaking: boolean;
  currentTarget?: { letter: string };
  currentVocab?: { emoji?: string; pronunciation?: string };
  styles: ReturnType<typeof createStyles>;
  c: ThemeColors;
}) {
  const pulse = useSharedValue(1);
  // Idle bobbing — sobe e desce sempre que o card está montado, dá vida
  // mesmo quando Bia tá em silêncio.
  const bob = useSharedValue(0);
  // Wiggle (rotação leve) na demo da mão pra simular um "olha aqui, faz assim".
  const handWiggle = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    handWiggle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800 }),
      ),
      -1,
      false,
    );
  }, [bob, handWiggle]);

  useEffect(() => {
    if (isSpeaking) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 320, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 240 });
    }
  }, [isSpeaking, pulse]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulse.value },
      // Bob: -4px (cima) a +1px (chão). Fora isso fica parado.
      { translateY: -4 + 5 * (1 - bob.value) },
    ],
  }));

  const handStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${handWiggle.value * 8}deg` },
      { scale: 1 + Math.abs(handWiggle.value) * 0.05 },
    ],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(360)}
      style={styles.biaCard}
      accessible
      accessibilityLabel={`Bia diz: ${message}`}
    >
      <View style={styles.biaCardTopRow}>
        <Animated.View style={[styles.biaAvatarWrap, mascotStyle]}>
          <Image
            source={images.mascotLogo}
            style={styles.biaAvatar}
            resizeMode="contain"
          />
          {isSpeaking && <View style={styles.biaSpeakingDot} />}
        </Animated.View>
        <View style={styles.biaBubble}>
          <View style={styles.biaBubbleHeader}>
            <Text style={styles.biaBubbleName}>Bia · professora</Text>
            {isThinking && (
              <View style={styles.biaTypingDots}>
                <TypingDot delay={0} c={c} />
                <TypingDot delay={150} c={c} />
                <TypingDot delay={300} c={c} />
              </View>
            )}
            {isSpeaking && !isThinking && (
              <View style={styles.biaSpeakingTag}>
                <Ionicons
                  name="volume-medium"
                  size={11}
                  color={c.primary.purple}
                />
                <Text style={styles.biaSpeakingText}>falando</Text>
              </View>
            )}
          </View>
          <Text style={styles.biaBubbleText} numberOfLines={4}>
            {message}
          </Text>
        </View>
        {/* Painel de demonstração da mão — emoji animado representando o
            gesto. A Bia "ensina" usando esse painel como referência visual. */}
        {currentTarget && (
          <View style={styles.handDemo}>
            <Animated.Text style={[styles.handEmoji, handStyle]}>
              {currentVocab?.emoji ?? "🤚"}
            </Animated.Text>
            <Text style={styles.handLetter}>{currentTarget.letter}</Text>
          </View>
        )}
      </View>
      {currentTarget && currentVocab?.pronunciation ? (
        <Text style={styles.handHint} numberOfLines={2}>
          💡 {currentVocab.pronunciation}
        </Text>
      ) : null}
    </Animated.View>
  );
}

function TypingDot({ delay, c }: { delay: number; c: ThemeColors }) {
  const t = useSharedValue(0.3);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: 380, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [t, delay]);
  const s = useAnimatedStyle(() => ({ opacity: t.value }));
  return (
    <Animated.View
      style={[
        s,
        {
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: c.primary.purple,
        },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tela final — celebração
// ─────────────────────────────────────────────────────────────────────────
function FinishedView({
  lesson,
  styles,
}: {
  lesson: { xpReward: number };
  styles: ReturnType<typeof createStyles>;
}) {
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
    <View style={styles.finishedWrap}>
      <Animated.Text style={[styles.finishedEmoji, animStyle]}>⭐</Animated.Text>
      <Animated.Text entering={FadeIn.delay(180)} style={styles.finishedTitle}>
        Lição completa!
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(280)} style={styles.finishedSubtitle}>
        +{lesson.xpReward} XP — voltando ao mapa…
      </Animated.Text>
      <ConfettiCannon
        count={140}
        origin={{ x: Dimensions.get("window").width / 2, y: 0 }}
        fadeOut
        autoStart
        fallSpeed={2800}
        explosionSpeed={500}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Frases curtas pra Bia variar quando o aluno acerta.
// ─────────────────────────────────────────────────────────────────────────
function pickPraise(letter: string): string {
  const options = [
    `Boa! Letra ${letter} certinha!`,
    `Mandou bem! ${letter} reconhecida.`,
    `Isso! Você fez a letra ${letter}.`,
    `Show! Letra ${letter} no ponto.`,
    `Perfeito! ${letter} feita.`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

// ─────────────────────────────────────────────────────────────────────────
function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.neutral.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 8,
    },
    headerTextWrap: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 15,
      color: c.neutral.textPrimary,
    },
    headerSubtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },

    // Bia card
    biaCard: {
      flexDirection: "column",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 10,
      padding: 12,
      backgroundColor: c.neutral.elevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.neutral.border,
      ...cardShadow({ color: c.primary.purple, opacity: 0.12, radius: 12, y: 4 }),
    },
    biaCardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    handDemo: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      minWidth: 64,
    },
    handEmoji: {
      fontSize: 38,
      lineHeight: 44,
    },
    handLetter: {
      fontFamily: "Poppins-Bold",
      fontSize: 18,
      color: c.primary.purple,
      letterSpacing: 1,
      marginTop: -2,
    },
    handHint: {
      fontFamily: "Poppins-Medium",
      fontSize: 11,
      color: c.neutral.textSecondary,
      fontStyle: "italic",
      paddingLeft: 4,
    },
    biaAvatarWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#F4F2FF",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    biaAvatar: {
      width: 52,
      height: 52,
    },
    biaSpeakingDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.semantic.success,
      borderWidth: 2,
      borderColor: c.neutral.elevated,
    },
    biaBubble: {
      flex: 1,
      minHeight: 56,
      paddingTop: 2,
    },
    biaBubbleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    biaBubbleName: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.primary.purple,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    biaTypingDots: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    biaSpeakingTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: "rgba(108,78,245,0.10)",
    },
    biaSpeakingText: {
      fontFamily: "Poppins-Medium",
      fontSize: 10,
      color: c.primary.purple,
    },
    biaBubbleText: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      lineHeight: 19,
      color: c.neutral.textPrimary,
    },

    // Word strip
    wordRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    wordCell: {
      minWidth: 34,
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: c.neutral.surface,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      alignItems: "center",
      justifyContent: "center",
    },
    wordCellActive: {
      backgroundColor: c.primary.purple,
      borderColor: c.primary.purple,
    },
    wordCellDone: {
      backgroundColor: c.semantic.success,
      borderColor: c.semantic.success,
    },
    wordCellChar: {
      fontFamily: "Poppins-Bold",
      fontSize: 20,
      color: c.neutral.textSecondary,
      letterSpacing: 1,
    },
    wordCellCharOn: {
      color: "#fff",
    },

    // Camera
    cameraContainer: {
      flex: 1,
      marginHorizontal: 16,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: "#000",
    },

    // Bottom bar
    bottomRow: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 10,
    },
    vocabRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
    },
    vocabChip: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.neutral.surface,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      alignItems: "center",
      justifyContent: "center",
    },
    vocabChipActive: {
      backgroundColor: c.primary.purple,
      borderColor: c.primary.purple,
    },
    vocabChipDone: {
      backgroundColor: c.semantic.success,
      borderColor: c.semantic.success,
    },
    vocabLetter: {
      fontFamily: "Poppins-Bold",
      fontSize: 14,
      color: c.neutral.textPrimary,
    },
    vocabLetterOn: {
      color: "#fff",
    },
    micBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.primary.purple,
      borderRadius: 18,
      paddingVertical: 14,
      ...cardShadow({ color: c.primary.purple, opacity: 0.25, radius: 10, y: 4 }),
    },
    micBtnActive: {
      backgroundColor: c.semantic.error,
      transform: [{ scale: 1.02 }],
    },
    micBtnLabel: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },

    // Finished
    finishedWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.semantic.success,
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

    // Not found
    notFoundWrap: {
      flex: 1,
      backgroundColor: c.neutral.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      gap: 12,
    },
    notFoundTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 18,
      color: c.neutral.textPrimary,
    },
    primaryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.primary.purple,
    },
    primaryButtonText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
  });
}
