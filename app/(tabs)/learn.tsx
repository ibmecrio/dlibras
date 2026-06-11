import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { PathConnector, PathNode } from "@/components/PathNode";
import { images } from "@/constants/images";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { LESSONS } from "@/data/lessons";
import { UNITS } from "@/data/units";
import { useLearningStore } from "@/store/learningStore";
import { Lesson } from "@/types/learning";

// Computa o label que aparece dentro do círculo do nó. Pra lições do alfabeto
// usa a primeira letra-alvo; pra soletrar, a palavra inteira; motion, a letra.
function nodeLabel(lesson: Lesson): string {
  const targets = lesson.signTargets ?? [];
  if (lesson.unitId === "libras-unit-2") {
    return targets.map((t) => t.letter).join("");
  }
  if (lesson.unitId === "libras-unit-3") {
    return targets[0]?.letter ?? "?";
  }
  return targets[0]?.letter ?? lesson.title.slice(0, 2);
}

function nodeCaption(lesson: Lesson, unitIndex: number, lessonIndex: number): string {
  if (lesson.unitId === "libras-unit-2") {
    return `${lesson.title.replace("Palavra — ", "")} · +${lesson.xpReward} XP`;
  }
  return `Lição ${unitIndex}.${lessonIndex} · +${lesson.xpReward} XP`;
}

export default function LearnScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { completedLessonIds } = useLearningStore();

  const allLessons = useMemo(
    () =>
      UNITS.flatMap((u) =>
        u.lessonIds
          .map((id) => LESSONS.find((l) => l.id === id))
          .filter(Boolean) as Lesson[],
      ),
    [],
  );
  const completedTotal = allLessons.filter((l) =>
    completedLessonIds.includes(l.id),
  ).length;

  // O "nó atual" é a primeira lição não concluída na sequência global —
  // todas as anteriores ficam "completed", todas as posteriores "locked".
  const currentLessonId = useMemo(() => {
    for (const lesson of allLessons) {
      if (!completedLessonIds.includes(lesson.id)) return lesson.id;
    }
    return null;
  }, [allLessons, completedLessonIds]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.neutral.background }}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Minha jornada
        </Text>
        <Text style={styles.headerSubtitle}>
          {completedTotal}/{allLessons.length} lições concluídas
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero do mapa */}
        <View style={styles.heroContainer}>
          <Image
            source={images.palace}
            contentFit="contain"
            style={styles.heroImage}
          />
          <RNImage
            source={images.mascotWelcome}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>

        {UNITS.map((unit, unitIdx) => {
          const lessons = unit.lessonIds
            .map((id) => LESSONS.find((l) => l.id === id))
            .filter(Boolean) as Lesson[];
          const completedCount = lessons.filter((l) =>
            completedLessonIds.includes(l.id),
          ).length;

          return (
            <View key={unit.id} style={styles.unitWrap}>
              {/* Cabeçalho da unidade — badge de progresso à direita */}
              <Animated.View
                entering={FadeInDown.duration(380)}
                style={styles.unitHeader}
              >
                <View style={styles.unitHeaderText}>
                  <Text style={styles.unitOrder}>UNIDADE {unit.order}</Text>
                  <Text style={styles.unitTitle}>{unit.title}</Text>
                  <Text style={styles.unitDesc}>{unit.description}</Text>
                </View>
                <View
                  style={[
                    styles.unitBadge,
                    completedCount === lessons.length && {
                      backgroundColor: c.semantic.success,
                    },
                  ]}
                >
                  <Text style={styles.unitBadgeText}>
                    {completedCount}/{lessons.length}
                  </Text>
                </View>
              </Animated.View>

              {/* Caminho zig-zag — alterna left/right por index */}
              <View style={styles.path}>
                {lessons.map((lesson, i) => {
                  const align =
                    i % 3 === 0
                      ? "center"
                      : i % 3 === 1
                        ? "right"
                        : "left";
                  const isCompleted = completedLessonIds.includes(lesson.id);
                  const isCurrent = lesson.id === currentLessonId;
                  const state = isCompleted
                    ? "completed"
                    : isCurrent
                      ? "current"
                      : "locked";

                  // Conector pra o nó seguinte (não desenha após o último)
                  const next = lessons[i + 1];
                  const nextAlign = next
                    ? (i + 1) % 3 === 0
                      ? "center"
                      : (i + 1) % 3 === 1
                        ? "right"
                        : "left"
                    : null;
                  const nextActive = next
                    ? completedLessonIds.includes(next.id) ||
                      next.id === currentLessonId
                    : false;

                  return (
                    <View key={lesson.id}>
                      <PathNode
                        label={nodeLabel(lesson)}
                        caption={nodeCaption(lesson, unitIdx + 1, i + 1)}
                        state={state}
                        align={align}
                        index={i}
                        onPress={() => router.push(`/lesson/${lesson.id}`)}
                      />
                      {nextAlign && (
                        <PathConnector
                          fromAlign={align}
                          toAlign={nextAlign}
                          active={nextActive}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Footer com mascote */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.footer}
        >
          <Text style={styles.footerText}>🎉 Mais conteúdo em breve</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 8,
      alignItems: "center",
    },
    headerTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 18,
      color: c.neutral.textPrimary,
    },
    headerSubtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 100,
    },
    heroContainer: {
      height: 160,
      borderRadius: 20,
      overflow: "hidden",
      marginBottom: 20,
      backgroundColor: c.neutral.elevated,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    heroImage: {
      width: "100%",
      height: "100%",
    },
    mascotImage: {
      position: "absolute",
      bottom: 0,
      right: 16,
      width: 100,
      height: 100,
    },
    unitWrap: {
      marginBottom: 32,
    },
    unitHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 14,
      marginBottom: 12,
      backgroundColor: c.primary.purple,
      borderRadius: 18,
    },
    unitHeaderText: {
      flex: 1,
      paddingHorizontal: 8,
    },
    unitOrder: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 10,
      color: "rgba(255,255,255,0.7)",
      letterSpacing: 1.2,
    },
    unitTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 16,
      color: "#fff",
      marginTop: 2,
    },
    unitDesc: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: "rgba(255,255,255,0.85)",
      marginTop: 2,
    },
    unitBadge: {
      backgroundColor: "rgba(0,0,0,0.18)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    unitBadgeText: {
      color: "#fff",
      fontFamily: "Poppins-Bold",
      fontSize: 12,
    },
    path: {
      paddingVertical: 8,
    },
    footer: {
      alignItems: "center",
      paddingVertical: 24,
    },
    footerText: {
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      color: c.neutral.textSecondary,
    },
  });
}
