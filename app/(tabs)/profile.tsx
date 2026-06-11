import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SafeAreaView } from "react-native-safe-area-context";

import { AchievementGrid } from "@/components/AchievementGrid";
import { AppModal } from "@/components/AppModal";
import { EditProfileModal } from "@/components/EditProfileModal";
import { InstallAppCard } from "@/components/InstallAppCard";
import { LetterHeatmap } from "@/components/LetterHeatmap";
import { SdgBanner } from "@/components/SdgBanner";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { SUPPORTED_LOCALES, useT } from "@/lib/i18n";
import {
  cancelAllReminders,
  ensureNotifPermission,
  scheduleDailyReminder,
  sendTestNotification,
} from "@/lib/notifications";
import { useIsOnline } from "@/lib/network";
import { LESSONS } from "@/data/lessons";
import { UNITS } from "@/data/units";
import { useAuth, useUser } from "@/lib/auth";
import { lastSevenDays, useLearningStore } from "@/store/learningStore";

const clerkEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const setDevBypass = useLearningStore((s) => s.setDevBypassAuth);
  const {
    xpToday,
    dailyGoal,
    streak,
    completedLessonIds,
    xpHistory,
    resetProgress,
    audioFeedbackEnabled,
    setAudioFeedbackEnabled,
    unlockedAchievements,
  } = useLearningStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const displayNameOverride = useLearningStore((s) => s.displayNameOverride);
  const avatarEmoji = useLearningStore((s) => s.avatarEmoji);
  const themeOverride = useLearningStore((s) => s.themeOverride);
  const setThemeOverride = useLearningStore((s) => s.setThemeOverride);
  const t = useT();
  const isOnline = useIsOnline();
  const locale = useLearningStore((s) => s.locale);
  const setLocale = useLearningStore((s) => s.setLocale);
  const notifEnabled = useLearningStore((s) => s.notifEnabled);
  const setNotifEnabled = useLearningStore((s) => s.setNotifEnabled);
  const notifHour = useLearningStore((s) => s.notifHour);
  const notifMinute = useLearningStore((s) => s.notifMinute);
  const setNotifTime = useLearningStore((s) => s.setNotifTime);
  const librasModel = useLearningStore((s) => s.librasModel);
  const setLibrasModel = useLearningStore((s) => s.setLibrasModel);
  const [notifError, setNotifError] = useState<string | null>(null);

  async function toggleNotif(value: boolean) {
    setNotifError(null);
    if (value) {
      const { granted, reason } = await ensureNotifPermission();
      if (!granted) {
        setNotifError(reason ?? "Permissão negada.");
        return;
      }
      const ok = await scheduleDailyReminder({
        hour: notifHour,
        minute: notifMinute,
      });
      if (!ok) {
        setNotifError(
          "Agendamento só funciona em EAS Build (Expo Go não suporta).",
        );
        // Não desliga o toggle — a preferência fica salva
      }
    } else {
      await cancelAllReminders();
    }
    setNotifEnabled(value);
  }

  async function testNotif() {
    const { granted, reason } = await ensureNotifPermission();
    if (!granted) {
      setNotifError(reason ?? "Permissão negada.");
      return;
    }
    const ok = await sendTestNotification();
    if (!ok) setNotifError("Falhou ao disparar notificação de teste.");
  }

  async function performSignOut() {
    try {
      await signOut();
    } catch (err) {
      console.warn("[profile] signOut err", err);
    }
    setDevBypass(false);
    router.replace("/(auth)/sign-in" as never);
  }

  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const weeklyData = lastSevenDays(xpHistory).map((d, i, arr) => ({
    ...d,
    frontColor: i === arr.length - 1 ? c.primary.deepPurple : c.primary.purple,
  }));
  const totalXp = weeklyData.reduce((acc, d) => acc + d.value, 0);
  const maxXp = Math.max(...weeklyData.map((d) => d.value), dailyGoal);

  const totalLessons = LESSONS.length;
  const completedCount = completedLessonIds.length;
  const progressPct =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.neutral.background }}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.avatarRow}
          onPress={() => setShowEditModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Editar perfil"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>
              {displayNameOverride ?? user?.fullName ?? user?.firstName ?? "Estudante"}
            </Text>
            <Text style={styles.userEmail}>
              {user?.primaryEmailAddress?.emailAddress ?? "demo@dlibras.local"}
            </Text>
          </View>
          <Ionicons name="pencil-outline" size={18} color={c.neutral.textSecondary} />
        </Pressable>

        <View style={styles.statsRow}>
          <Stat
            label="Sequência"
            value={`${streak}d`}
            color={c.semantic.streak}
            styles={styles}
          />
          <View style={styles.statDivider} />
          <Stat
            label="XP hoje"
            value={`${xpToday}/${dailyGoal}`}
            color={c.primary.purple}
            styles={styles}
          />
          <View style={styles.statDivider} />
          <Stat
            label="Lições"
            value={`${completedCount}`}
            color={c.semantic.success}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>XP da semana</Text>
            <Text style={styles.cardCaption}>{totalXp} XP no total</Text>
          </View>
          <BarChart
            data={weeklyData}
            barWidth={22}
            spacing={18}
            barBorderRadius={6}
            frontColor={c.primary.purple}
            yAxisColor="transparent"
            xAxisColor={c.neutral.border}
            xAxisLabelTextStyle={styles.axisLabel}
            yAxisTextStyle={styles.axisLabel}
            noOfSections={4}
            maxValue={Math.max(maxXp, 20)}
            disablePress
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Progresso por unidade</Text>
            <Text style={styles.cardCaption}>{progressPct}%</Text>
          </View>
          {UNITS.map((unit) => {
            const unitLessons = unit.lessonIds;
            const done = unitLessons.filter((id) =>
              completedLessonIds.includes(id),
            ).length;
            const pct =
              unitLessons.length > 0
                ? Math.round((done / unitLessons.length) * 100)
                : 0;
            return (
              <View key={unit.id} style={styles.unitRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitTitle}>{unit.title}</Text>
                  <Text style={styles.unitCaption}>
                    {done} / {unitLessons.length} lições
                  </Text>
                </View>
                <View style={styles.unitBarTrack}>
                  <View
                    style={[
                      styles.unitBarFill,
                      { width: `${pct}%` as `${number}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Conquistas</Text>
          </View>
          <AchievementGrid unlocked={unlockedAchievements} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Mapa de letras</Text>
            <Text style={styles.cardCaption}>Sua proficiência A-Z</Text>
          </View>
          <LetterHeatmap />
        </View>

        <View style={styles.card}>
          <SdgBanner />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Preferências</Text>
          </View>

          <View style={styles.prefRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefLabel}>{t("profile.audio")}</Text>
              <Text style={styles.prefCaption}>{t("profile.audio.caption")}</Text>
            </View>
            <Switch
              value={audioFeedbackEnabled}
              onValueChange={setAudioFeedbackEnabled}
              trackColor={{ false: c.neutral.border, true: c.primary.purple }}
              thumbColor="#fff"
              accessibilityLabel="Ativar ou desativar som de acerto"
            />
          </View>

          {/* Tema */}
          <View style={styles.langRow}>
            <Text style={styles.prefLabel}>Tema</Text>
            <View style={styles.langChips}>
              {(["system", "light", "dark"] as const).map((mode) => {
                const active = themeOverride === mode;
                const icon =
                  mode === "system"
                    ? "phone-portrait-outline"
                    : mode === "light"
                      ? "sunny-outline"
                      : "moon-outline";
                const label =
                  mode === "system"
                    ? "Sistema"
                    : mode === "light"
                      ? "Claro"
                      : "Escuro";
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setThemeOverride(mode)}
                    style={[styles.langChip, active && styles.langChipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Tema ${label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={icon}
                      size={14}
                      color={active ? "#fff" : c.neutral.textPrimary}
                    />
                    <Text
                      style={[
                        styles.langChipText,
                        active && styles.langChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Idioma */}
          <View style={styles.langRow}>
            <Text style={styles.prefLabel}>{t("profile.language")}</Text>
            <View style={styles.langChips}>
              {SUPPORTED_LOCALES.map((l) => {
                const active = l.code === locale;
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => setLocale(l.code)}
                    style={[
                      styles.langChip,
                      active && styles.langChipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={l.label}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={styles.langFlag}>{l.flag}</Text>
                    <Text
                      style={[
                        styles.langChipText,
                        active && styles.langChipTextActive,
                      ]}
                    >
                      {l.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Notificações */}
          <View style={styles.prefRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefLabel}>{t("profile.notifications")}</Text>
              <Text style={styles.prefCaption}>
                {t("profile.notifications.caption")} ·{" "}
                {String(notifHour).padStart(2, "0")}:
                {String(notifMinute).padStart(2, "0")}
              </Text>
              {notifError && (
                <Text style={styles.errorCaption}>{notifError}</Text>
              )}
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={toggleNotif}
              trackColor={{ false: c.neutral.border, true: c.primary.purple }}
              thumbColor="#fff"
              accessibilityLabel="Ativar lembrete diário"
            />
          </View>

          {notifEnabled && (
            <View style={styles.timeRow}>
              <Text style={styles.prefCaption}>Hora do lembrete:</Text>
              <View style={styles.timeChips}>
                {[7, 12, 18, 20, 22].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      setNotifTime(h, 0);
                      if (notifEnabled)
                        void scheduleDailyReminder({ hour: h, minute: 0 });
                    }}
                    style={[
                      styles.timeChip,
                      notifHour === h && styles.timeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        notifHour === h && styles.timeChipTextActive,
                      ]}
                    >
                      {String(h).padStart(2, "0")}h
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={testNotif} style={styles.testNotifBtn}>
                <Ionicons
                  name="paper-plane-outline"
                  size={14}
                  color={c.primary.purple}
                />
                <Text style={styles.testNotifText}>Testar notificação</Text>
              </Pressable>
            </View>
          )}

          {/* Modelo Libras Vision */}
          <View style={styles.langRow}>
            <View>
              <Text style={styles.prefLabel}>Modelo de reconhecimento</Text>
              <Text style={styles.prefCaption}>
                Ensemble = mais preciso. KNN = mais rápido.
              </Text>
            </View>
            <View style={styles.modelChips}>
              {(["knn", "svm", "mlp", "rf", "lr", "ensemble"] as const).map(
                (m) => (
                  <Pressable
                    key={m}
                    onPress={() => setLibrasModel(m)}
                    style={[
                      styles.modelChip,
                      librasModel === m && styles.modelChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modelChipText,
                        librasModel === m && styles.modelChipTextActive,
                      ]}
                    >
                      {m.toUpperCase()}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          </View>

          {/* Status da conexão */}
          <View style={styles.prefRow}>
            <Ionicons
              name={isOnline ? "wifi" : "cloud-offline-outline"}
              size={18}
              color={isOnline ? c.semantic.success : c.semantic.error}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.prefLabel}>
                {isOnline ? t("common.online") : t("common.offline")}
              </Text>
              <Text style={styles.prefCaption}>
                {isOnline
                  ? "Reconhecimento de Libras + Bia funcionando"
                  : "API offline — só glossário + lições em cache"}
              </Text>
            </View>
          </View>

          {!clerkEnabled && (
            <Pressable
              style={styles.tutorialRow}
              onPress={() => router.push("/onboarding")}
            >
              <Ionicons
                name="play-circle-outline"
                size={22}
                color={c.primary.purple}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.prefLabel}>Ver tutorial inicial</Text>
                <Text style={styles.prefCaption}>
                  Relembre como o reconhecimento de Libras funciona
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={c.neutral.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {/* Install Card — universal (Chrome/Safari iOS/Edge/Firefox/Native) */}
        <InstallAppCard />

        {/* Link pro Ranking semanal */}
        <Pressable
          onPress={() => router.push("/leaderboard" as never)}
          style={({ pressed }) => [
            styles.aboutLinkBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Ranking semanal"
        >
          <Ionicons name="trophy" size={18} color={c.primary.purple} />
          <Text style={styles.aboutLinkText}>Ranking semanal</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={c.neutral.textSecondary}
          />
        </Pressable>

        {/* Link pro Modo Professor (beta) */}
        <Pressable
          onPress={() => router.push("/teacher-dashboard" as never)}
          style={({ pressed }) => [
            styles.aboutLinkBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Modo Professor (beta)"
        >
          <Ionicons name="school" size={18} color={c.primary.purple} />
          <Text style={styles.aboutLinkText}>Modo Professor (beta)</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={c.neutral.textSecondary}
          />
        </Pressable>

        <Pressable
          style={styles.signOutButton}
          onPress={() => setShowLogoutModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.signOutButtonText}>Sair da conta</Text>
        </Pressable>

        <Pressable
          style={styles.resetButton}
          onPress={() => setShowResetModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Resetar progresso da demonstração"
        >
          <Text style={styles.resetButtonText}>Resetar progresso (demo)</Text>
        </Pressable>

        {/* Link pra About / créditos */}
        <Pressable
          onPress={() => router.push("/about" as never)}
          style={({ pressed }) => [
            styles.aboutLinkBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sobre o DLibras"
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={c.primary.purple}
          />
          <Text style={styles.aboutLinkText}>Sobre o DLibras</Text>
          <Ionicons name="chevron-forward" size={16} color={c.neutral.textSecondary} />
        </Pressable>

        <EditProfileModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          initialName={
            displayNameOverride ?? user?.fullName ?? user?.firstName ?? ""
          }
          initialEmoji={avatarEmoji}
        />

        <AppModal
          visible={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          kind="confirm"
          variant="danger"
          icon="log-out-outline"
          title="Sair da conta?"
          body="Você precisará entrar de novo na próxima vez."
          primaryLabel="Sair"
          secondaryLabel="Cancelar"
          onPrimary={performSignOut}
        />

        <AppModal
          visible={showResetModal}
          onClose={() => setShowResetModal(false)}
          kind="confirm"
          variant="danger"
          icon="refresh-outline"
          title="Resetar todo o progresso?"
          body="Isso apaga XP, sequência, lições concluídas e conquistas. Não dá pra desfazer."
          primaryLabel="Resetar"
          secondaryLabel="Cancelar"
          onPrimary={() => resetProgress()}
        />

        <Text style={styles.footer}>
          DLibras — projeto de faculdade · {LESSONS.length} lições disponíveis
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: string;
  color: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      padding: 18,
      paddingBottom: 90,
      gap: 16,
    },
    avatarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: "#fff",
      fontFamily: "Poppins-Bold",
      fontSize: 22,
    },
    avatarEmoji: {
      fontSize: 32,
    },
    userName: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 16,
      color: c.neutral.textPrimary,
    },
    userEmail: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
    },
    stat: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    statValue: {
      fontFamily: "Poppins-Bold",
      fontSize: 20,
    },
    statLabel: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: c.neutral.border,
    },
    card: {
      backgroundColor: c.neutral.elevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.neutral.border,
      padding: 14,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    cardTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
      color: c.neutral.textPrimary,
    },
    cardCaption: {
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      color: c.neutral.textSecondary,
    },
    axisLabel: {
      color: c.neutral.textSecondary,
      fontSize: 10,
      fontFamily: "Poppins-Regular",
    },
    unitRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      gap: 12,
    },
    unitTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    unitCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    unitBarTrack: {
      width: 100,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.neutral.surface,
      overflow: "hidden",
    },
    unitBarFill: {
      height: 8,
      backgroundColor: c.primary.purple,
      borderRadius: 4,
    },
    footer: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      textAlign: "center",
      marginTop: 4,
    },
    resetButton: {
      alignSelf: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.semantic.error,
    },
    resetButtonText: {
      color: c.semantic.error,
      fontFamily: "Poppins-SemiBold",
      fontSize: 12,
    },
    signOutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.semantic.error,
    },
    signOutButtonText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
    installButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.primary.purple,
      backgroundColor: c.neutral.elevated,
    },
    installButtonText: {
      color: c.primary.purple,
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
    langRow: {
      paddingVertical: 8,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: c.neutral.border,
      marginTop: 4,
    },
    langChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    langChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.surface,
    },
    langChipActive: {
      borderColor: c.primary.purple,
      backgroundColor: c.primary.purple,
    },
    langFlag: { fontSize: 14 },
    langChipText: {
      fontFamily: "Poppins-Medium",
      fontSize: 11,
      color: c.neutral.textPrimary,
    },
    langChipTextActive: { color: "#fff" },
    timeRow: {
      gap: 8,
      paddingVertical: 8,
    },
    timeChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    timeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    timeChipActive: {
      backgroundColor: c.primary.purple,
      borderColor: c.primary.purple,
    },
    timeChipText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.neutral.textPrimary,
    },
    timeChipTextActive: { color: "#fff" },
    testNotifBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.primary.purple,
      marginTop: 4,
    },
    testNotifText: {
      color: c.primary.purple,
      fontFamily: "Poppins-Medium",
      fontSize: 11,
    },
    modelChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 4,
    },
    modelChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    modelChipActive: {
      backgroundColor: c.primary.purple,
      borderColor: c.primary.purple,
    },
    modelChipText: {
      fontFamily: "Poppins-Bold",
      fontSize: 9,
      letterSpacing: 0.4,
      color: c.neutral.textPrimary,
    },
    modelChipTextActive: { color: "#fff" },
    errorCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 10,
      color: c.semantic.error,
      marginTop: 2,
    },
    aboutLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
    },
    aboutLinkText: {
      flex: 1,
      color: c.neutral.textPrimary,
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
    },
    prefRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      gap: 12,
    },
    prefLabel: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    prefCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    tutorialRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: c.neutral.border,
    },
  });
}
