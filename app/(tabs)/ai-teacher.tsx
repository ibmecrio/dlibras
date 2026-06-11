import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { LESSONS } from "@/data/lessons";
import { UNITS } from "@/data/units";
import { posthog } from "@/lib/posthog";
import { cardShadow } from "@/lib/styles";
import { useLearningStore } from "@/store/learningStore";

// O nome da tab continua "Professor IA" pra ficar coerente com o design
// original, mas em modo demo ela é o hub das práticas: letras com movimento
// + leitor livre da câmera. Quando IA voltar, é só restaurar.

const clerkEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function AITeacherScreen() {
  const router = useRouter();
  const { completedLessonIds } = useLearningStore();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  useEffect(() => {
    posthog.capture("practice_hub_viewed");
  }, []);

  const motionUnit = UNITS.find((u) => u.id === "libras-unit-3");
  const motionLessons =
    motionUnit?.lessonIds
      .map((id) => LESSONS.find((l) => l.id === id)!)
      .filter(Boolean) ?? [];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.neutral.background }}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Práticas</Text>
          <Text style={styles.subtitle}>
            {clerkEnabled
              ? "Bia ainda está conectada via voz, e você pode treinar movimentos com a câmera."
              : "Treine sinais com movimento e use o leitor livre da câmera."}
          </Text>
        </View>

        {/* CARD: leitor livre */}
        <Animated.View entering={FadeInUp.duration(420)}>
        <Pressable
          style={[styles.bigCard, { backgroundColor: c.primary.purple }]}
          onPress={() => router.push("/libras-demo")}
          accessibilityRole="button"
          accessibilityLabel="Abrir leitor livre da câmera"
        >
          <Ionicons name="videocam" size={36} color="#fff" />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.bigCardTitle}>Leitor livre</Text>
            <Text style={styles.bigCardSubtitle}>
              Câmera aberta, faça qualquer letra do alfabeto e veja o que a IA detecta em tempo real.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#fff" />
        </Pressable>
        </Animated.View>

        {/* Letras com movimento */}
        <Text style={styles.sectionTitle}>Letras com movimento</Text>
        <Text style={styles.sectionHint}>
          Essas letras não são estáticas — você precisa traçar o gesto no ar
          durante a gravação de 1,5 segundo.
        </Text>
        <View style={{ gap: 10 }}>
          {motionLessons.map((lesson, idx) => {
            const done = completedLessonIds.includes(lesson.id);
            const letter = lesson.signTargets?.[0]?.letter ?? "?";
            return (
              <Animated.View
                key={lesson.id}
                entering={FadeInDown.delay(120 + idx * 80).duration(380)}
              >
              <Pressable
                style={styles.lessonRow}
                onPress={() => router.push(`/lesson/${lesson.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Praticar letra ${letter}${done ? " — já concluída" : ""}`}
              >
                <View style={styles.lessonBigLetter}>
                  <Text style={styles.lessonBigLetterText}>{letter}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.lessonSubtitle}>
                    {lesson.vocabulary[0]?.pronunciation ?? ""}
                  </Text>
                </View>
                {done ? (
                  <View style={styles.checkPill}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={c.neutral.textSecondary}
                  />
                )}
              </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {clerkEnabled && (
          <Pressable
            style={styles.aiCard}
            onPress={() => router.push("/(tabs)/learn")}
          >
            <Ionicons name="sparkles" size={20} color={c.primary.purple} />
            <Text style={styles.aiCardText}>
              Aula com voz da Bia — disponível nas lições com IA ligada
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  const isDark = c.neutral.background !== "#ffffff";
  return StyleSheet.create({
    scroll: {
      padding: 18,
      paddingBottom: 100,
      gap: 18,
    },
    header: {
      gap: 4,
    },
    title: {
      fontFamily: "Poppins-Bold",
      fontSize: 26,
      color: c.neutral.textPrimary,
    },
    subtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
    },
    bigCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 18,
      borderRadius: 20,
      ...cardShadow({ color: c.primary.purple, opacity: 0.25, radius: 14, y: 6, elevation: 6 }),
    },
    bigCardTitle: {
      color: "#fff",
      fontFamily: "Poppins-Bold",
      fontSize: 17,
    },
    bigCardSubtitle: {
      color: "rgba(255,255,255,0.85)",
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      marginTop: 2,
    },
    sectionTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 16,
      color: c.neutral.textPrimary,
      marginTop: 4,
    },
    sectionHint: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
      marginBottom: 4,
    },
    lessonRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.neutral.elevated,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: c.neutral.border,
      gap: 14,
    },
    lessonBigLetter: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(239,68,68,0.18)" : "#FEE2E2",
      alignItems: "center",
      justifyContent: "center",
    },
    lessonBigLetterText: {
      fontFamily: "Poppins-Bold",
      fontSize: 26,
      color: "#EF4444",
    },
    lessonTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
      color: c.neutral.textPrimary,
    },
    lessonSubtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    checkPill: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.semantic.success,
      alignItems: "center",
      justifyContent: "center",
    },
    aiCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: isDark ? c.neutral.surface : "#F4F0FF",
      borderRadius: 14,
      padding: 12,
    },
    aiCardText: {
      flex: 1,
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      color: c.primary.purple,
    },
  });
}
