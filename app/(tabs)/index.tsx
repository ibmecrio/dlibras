import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppModal } from "@/components/AppModal";
import { DailyGoalCelebration } from "@/components/DailyGoalCelebration";
import { HeartsDisplay } from "@/components/HeartsDisplay";
import { StreakWarning } from "@/components/StreakWarning";
import { images } from "@/constants/images";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { DEFAULT_LANGUAGE } from "@/data/languages";
import { LESSONS } from "@/data/lessons";
import { UNITS } from "@/data/units";
import { useAuth, useUser } from "@/lib/auth";
import { posthog } from "@/lib/posthog";
import { useLearningStore } from "@/store/learningStore";

const clerkEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

type PlanItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  href: string;
};

const PLAN_ITEMS: PlanItem[] = [
  {
    id: "alphabet",
    icon: "hand-left",
    iconBg: "#DCFCE7",
    iconColor: "#16a34a",
    title: "Alfabeto manual",
    subtitle: "21 letras estáticas",
    href: "/(tabs)/learn",
  },
  {
    id: "spelling",
    icon: "text",
    iconBg: "#DBEAFE",
    iconColor: "#2563eb",
    title: "Soletrar palavras",
    subtitle: "Forme palavras curtas",
    href: "/(tabs)/learn",
  },
  {
    id: "camera-practice",
    icon: "videocam",
    iconBg: "#EDE9FE",
    iconColor: "#6c4ef5",
    title: "Prática com câmera",
    subtitle: "Leitor de letras em tempo real",
    href: "/libras-demo",
  },
  {
    id: "motion",
    icon: "sparkles",
    iconBg: "#FEE2E2",
    iconColor: "#EF4444",
    title: "Letras com movimento",
    subtitle: "Pratique J e Z",
    href: "/(tabs)/ai-teacher",
  },
  {
    id: "quiz",
    icon: "school",
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    title: "Quiz de revisão",
    subtitle: "Teste o que aprendeu",
    href: "/quiz",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const {
    xpToday,
    dailyGoal,
    streak,
    completedLessonIds,
    librasDemoVisited,
  } = useLearningStore();

  const language = DEFAULT_LANGUAGE;
  const firstName = user?.firstName ?? "Estudante";
  const xpProgress =
    dailyGoal > 0 ? Math.min((xpToday / dailyGoal) * 100, 100) : 0;

  const orderedLessonIds = UNITS.flatMap((u) => u.lessonIds);
  const nextLessonId =
    orderedLessonIds.find((id) => !completedLessonIds.includes(id)) ??
    orderedLessonIds[0];
  const nextLesson = LESSONS.find((l) => l.id === nextLessonId);
  const nextUnit = UNITS.find((u) => u.id === nextLesson?.unitId);

  function goNextLesson() {
    if (!nextLesson) return;
    posthog.capture("continue_learning_tapped", {
      lesson_id: nextLesson.id,
      unit_id: nextLesson.unitId,
      xp_today: xpToday,
      streak,
    });
    router.push(`/lesson/${nextLesson.id}`);
  }

  const planStatus: Record<string, boolean> = {
    alphabet: completedLessonIds.some((id) => id.startsWith("libras-lesson-")),
    spelling: completedLessonIds.some((id) => id.startsWith("libras-word-")),
    "camera-practice": librasDemoVisited,
    motion: completedLessonIds.some((id) => id.startsWith("libras-motion-")),
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={{ uri: language.flag }} style={styles.flag} />
            <Text style={styles.greeting} numberOfLines={1}>
              Olá, {firstName}! 👋
            </Text>
          </View>

          <View style={styles.headerRight}>
            <HeartsDisplay />
            <Pressable
              onPress={() => setShowStreakModal(true)}
              style={({ pressed }) => [
                styles.streakBox,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Sequência de ${streak} dias`}
            >
              <Image source={images.streakFire} style={styles.streakIcon} />
              <Text style={styles.streakCount}>{streak}</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowNotifModal(true)}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Notificações"
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={c.neutral.textPrimary}
              />
            </Pressable>
            {clerkEnabled ? (
              <Pressable
                onPress={() => setShowLogoutModal(true)}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sair da conta"
              >
                <Ionicons
                  name="log-out-outline"
                  size={24}
                  color={c.neutral.textPrimary}
                />
              </Pressable>
            ) : (
              <View
                style={styles.demoBadge}
                accessibilityRole="text"
                accessibilityLabel="Modo demonstração ativo"
              >
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
            )}
          </View>
        </View>

        {/* Streak modal */}
        <AppModal
          visible={showStreakModal}
          onClose={() => setShowStreakModal(false)}
          kind="info"
          icon="flame"
          title={`Sequência de ${streak} ${streak === 1 ? "dia" : "dias"}`}
          body={
            streak === 0
              ? "Você ainda não começou uma sequência. Complete uma lição hoje pra iniciar! Cada dia consecutivo conta como +1."
              : `Você está há ${streak} ${streak === 1 ? "dia" : "dias"} mantendo o ritmo! Continue praticando todo dia pra não perder. Volta amanhã pra somar +1.`
          }
          primaryLabel="Bora praticar"
          onPrimary={goNextLesson}
        />

        {/* Notifications modal */}
        <AppModal
          visible={showNotifModal}
          onClose={() => setShowNotifModal(false)}
          kind="info"
          icon="notifications"
          title="Notificações"
          body="Notificações push chegam num próximo update! Por enquanto, configure um lembrete diário no seu calendário pra praticar — recomendamos antes de dormir, 10 minutos."
        />

        {/* Logout confirm modal */}
        <AppModal
          visible={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          kind="confirm"
          icon="log-out-outline"
          variant="danger"
          title="Sair da conta?"
          body="Você precisará entrar de novo na próxima vez."
          primaryLabel="Sair"
          secondaryLabel="Cancelar"
          onPrimary={async () => {
            try {
              await signOut();
            } catch {}
            router.replace("/(auth)/sign-in" as never);
          }}
        />

        <StreakWarning onCta={goNextLesson} />
        <DailyGoalCelebration />

        {/* ── Daily Goal Card ── */}
        <View style={styles.goalCard}>
          <View style={styles.goalCardContent}>
            <Text style={styles.goalLabel}>Meta diária</Text>
            <View style={styles.goalNumberRow}>
              <Text style={styles.goalNumber}>{xpToday}</Text>
              <Text style={styles.goalDenom}>{` / ${dailyGoal} XP`}</Text>
            </View>
            <View style={styles.goalBarTrack}>
              <View
                style={[styles.goalBarFill, { width: `${Math.round(xpProgress)}%` as `${number}%` }]}
              />
            </View>
          </View>
          <Image
            source={images.treasure}
            style={styles.treasure}
            resizeMode="contain"
          />
        </View>

        {/* ── Continue Learning Card ── */}
        <Animated.View entering={FadeInUp.duration(420)}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={goNextLesson}
            accessibilityRole="button"
            accessibilityLabel={`Continuar lição: ${nextLesson?.title ?? "começar"}`}
            style={styles.continueCard}
          >
            <View style={styles.continueText}>
              <View>
                <Text style={styles.continueKicker}>Continue aprendendo</Text>
                <Text style={styles.continueTitle} numberOfLines={2}>
                  {nextLesson?.title ?? language.name}
                </Text>
                <Text style={styles.continueSubtitle}>
                  {nextUnit?.title ?? "Alfabeto"} · Unidade{" "}
                  {nextUnit?.order ?? 1}
                </Text>
              </View>
              <View style={styles.continueButton}>
                <Text style={styles.continueButtonText}>
                  {completedLessonIds.length === 0 ? "Começar" : "Continuar"}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={c.primary.purple}
                />
              </View>
            </View>
            <Image source={images.palace} style={styles.palace} resizeMode="cover" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Today's Plan Header ── */}
        <View style={styles.planHeaderRow}>
          <Text style={styles.planHeaderTitle}>Plano de hoje</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/learn")}
            accessibilityRole="button"
            accessibilityLabel="Ver mapa completo"
          >
            <Text style={styles.planHeaderLink}>Ver tudo</Text>
          </TouchableOpacity>
        </View>

        {/* ── Today's Plan Card ── */}
        <View style={styles.planCard}>
          {PLAN_ITEMS.map((item, index) => {
            const done = !!planStatus[item.id];
            return (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(index * 70).duration(380)}
              >
                {index > 0 && <View style={styles.planDivider} />}
                <TouchableOpacity
                  onPress={() => router.push(item.href as never)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}${done ? " — concluído" : ""}`}
                  style={styles.planItem}
                >
                  <View
                    style={[styles.planIcon, { backgroundColor: item.iconBg }]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={item.iconColor}
                    />
                  </View>
                  <View style={styles.planItemText}>
                    <Text style={styles.planItemTitle}>{item.title}</Text>
                    <Text style={styles.planItemSubtitle}>{item.subtitle}</Text>
                  </View>
                  {done ? (
                    <View style={styles.planDoneBadge}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={c.neutral.textSecondary}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  const isDark = c.neutral.background !== "#ffffff";
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 100,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexShrink: 1,
    },
    flag: { width: 34, height: 34, borderRadius: 17 },
    greeting: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 16,
      color: c.neutral.textPrimary,
      flexShrink: 1,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    streakBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    iconBtn: {
      padding: 4,
      borderRadius: 10,
    },
    streakIcon: { width: 22, height: 22 },
    streakCount: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 15,
      color: c.semantic.streak,
    },
    demoBadge: {
      backgroundColor: c.primary.purple,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.15)" : c.primary.deepPurple,
    },
    demoBadgeText: {
      color: "#fff",
      fontFamily: "Poppins-Bold",
      fontSize: 10,
      letterSpacing: 0.6,
    },

    // Daily Goal
    goalCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? c.neutral.surface : "#FFF5E8",
      borderRadius: 20,
      paddingVertical: 16,
      paddingLeft: 20,
      paddingRight: 12,
      marginBottom: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: c.neutral.border,
    },
    goalCardContent: { flex: 1, paddingRight: 8 },
    goalLabel: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
      marginBottom: 4,
    },
    goalNumberRow: { flexDirection: "row", alignItems: "baseline" },
    goalNumber: {
      fontFamily: "Poppins-Bold",
      fontSize: 28,
      lineHeight: 34,
      color: c.neutral.textPrimary,
    },
    goalDenom: {
      fontFamily: "Poppins-Regular",
      fontSize: 14,
      color: c.neutral.textSecondary,
    },
    goalBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.neutral.border,
      marginTop: 10,
      overflow: "hidden",
    },
    goalBarFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.semantic.streak,
    },
    treasure: { width: 80, height: 80 },

    // Continue Card
    continueCard: {
      flexDirection: "row",
      backgroundColor: c.primary.purple,
      borderRadius: 20,
      height: 160,
      marginBottom: 24,
      overflow: "hidden",
    },
    continueText: {
      flex: 1,
      paddingVertical: 20,
      paddingLeft: 20,
      paddingRight: 8,
      justifyContent: "space-between",
    },
    continueKicker: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: "rgba(255,255,255,0.75)",
      marginBottom: 2,
    },
    continueTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 22,
      lineHeight: 28,
      color: "#fff",
    },
    continueSubtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: "rgba(255,255,255,0.65)",
      marginTop: 2,
    },
    continueButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: "#fff",
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 6,
    },
    continueButtonText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.primary.purple,
    },
    palace: { width: 130, height: 160 },

    // Plan
    planHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    planHeaderTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 17,
      color: c.neutral.textPrimary,
    },
    planHeaderLink: {
      fontFamily: "Poppins-Medium",
      fontSize: 13,
      color: c.primary.blue,
    },
    planCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
      overflow: "hidden",
      marginBottom: 16,
    },
    planDivider: {
      height: 1,
      backgroundColor: c.neutral.border,
      marginHorizontal: 16,
    },
    planItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    planIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    planItemText: { flex: 1, marginLeft: 12 },
    planItemTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
      color: c.neutral.textPrimary,
      marginBottom: 2,
    },
    planItemSubtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
    },
    planDoneBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.semantic.success,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
