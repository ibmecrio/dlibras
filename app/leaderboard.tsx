// Tela de Ranking (leaderboard) do DLibras.
//
// Três tabs:
//   - Semanal — top N da semana corrente
//   - Tudo    — ranking acumulado
//   - Eu      — janela centrada no user + cards de stats pessoais
//
// Estados:
//   - loading: ActivityIndicator
//   - erro: mensagem amigável + botão "Tentar de novo"
//   - vazio: "Sem ranking ainda — seja o primeiro!" + CTA pra iniciar lição
//   - sucesso: FlatList com pull-to-refresh
//
// Tema:
//   - Theme-aware via useThemeColors()
//   - User atual fica destacado com background colorido
//
// Wire de navegação: registrada no AppStack em app/_layout.tsx
// e linkada a partir do profile via router.push("/leaderboard").

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { useUser } from "@/lib/auth";
import {
  AroundMeResult,
  LeaderboardEntry,
  MyStats,
  fetchAllTime,
  fetchAroundMe,
  fetchMe,
  fetchWeekly,
} from "@/lib/leaderboard";
import { safeBack } from "@/lib/navigation";
import { cardShadow } from "@/lib/styles";
import { useLearningStore } from "@/store/learningStore";

type TabKey = "weekly" | "all" | "me";

const TABS: { key: TabKey; label: string }[] = [
  { key: "weekly", label: "Semanal" },
  { key: "all", label: "Tudo" },
  { key: "me", label: "Eu" },
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const { user } = useUser();
  const displayNameOverride = useLearningStore((s) => s.displayNameOverride);
  const avatarEmoji = useLearningStore((s) => s.avatarEmoji);
  const userId = user?.id ?? "demo-user";
  const myDisplayName =
    displayNameOverride ?? user?.fullName ?? user?.firstName ?? "Você";

  const [activeTab, setActiveTab] = useState<TabKey>("weekly");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weekly, setWeekly] = useState<LeaderboardEntry[] | null>(null);
  const [allTime, setAllTime] = useState<LeaderboardEntry[] | null>(null);
  const [aroundMe, setAroundMe] = useState<AroundMeResult | null>(null);
  const [myStats, setMyStats] = useState<MyStats | null>(null);

  const loadTab = useCallback(
    async (tab: TabKey, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        if (tab === "weekly") {
          const res = await fetchWeekly();
          if (res === null) {
            setError("Não consegui carregar o ranking semanal.");
          }
          setWeekly(res ?? []);
        } else if (tab === "all") {
          const res = await fetchAllTime();
          if (res === null) {
            setError("Não consegui carregar o ranking completo.");
          }
          setAllTime(res ?? []);
        } else {
          // me: busca dois recursos em paralelo
          const [around, stats] = await Promise.all([
            fetchAroundMe(userId, 5),
            fetchMe(userId),
          ]);
          if (around === null && stats === null) {
            setError("Não consegui carregar suas estatísticas.");
          }
          setAroundMe(around);
          setMyStats(stats);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadTab(activeTab);
  }, [activeTab, loadTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadTab(activeTab, { silent: true });
  }, [activeTab, loadTab]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack(router)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={c.neutral.textPrimary}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Ranking</Text>
          <Text style={styles.headerSubtitle}>
            Compita com outros aprendizes
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((t) => {
          const active = t.key === activeTab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Tab ${t.label}`}
            >
              <Text
                style={[styles.tabText, active && styles.tabTextActive]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TabContent
        activeTab={activeTab}
        loading={loading}
        refreshing={refreshing}
        error={error}
        weekly={weekly}
        allTime={allTime}
        aroundMe={aroundMe}
        myStats={myStats}
        userId={userId}
        myDisplayName={myDisplayName}
        myAvatarEmoji={avatarEmoji}
        onRefresh={onRefresh}
        onRetry={() => void loadTab(activeTab)}
        onStartLesson={() => router.replace("/(tabs)/learn" as never)}
        c={c}
        styles={styles}
      />
    </SafeAreaView>
  );
}

interface TabContentProps {
  activeTab: TabKey;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  weekly: LeaderboardEntry[] | null;
  allTime: LeaderboardEntry[] | null;
  aroundMe: AroundMeResult | null;
  myStats: MyStats | null;
  userId: string;
  myDisplayName: string;
  myAvatarEmoji: string;
  onRefresh: () => void;
  onRetry: () => void;
  onStartLesson: () => void;
  c: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function TabContent(props: TabContentProps) {
  const {
    activeTab,
    loading,
    refreshing,
    error,
    weekly,
    allTime,
    aroundMe,
    myStats,
    userId,
    myDisplayName,
    myAvatarEmoji,
    onRefresh,
    onRetry,
    onStartLesson,
    c,
    styles,
  } = props;

  if (loading && !refreshing) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={c.primary.purple} />
        <Text style={styles.centerCaption}>Carregando ranking…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerWrap}>
        <Ionicons
          name="cloud-offline-outline"
          size={56}
          color={c.semantic.error}
        />
        <Text style={styles.centerTitle}>Algo deu errado</Text>
        <Text style={styles.centerBody}>{error}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.primaryBtnText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (activeTab === "me") {
    // Tab "Eu" tem um header de stats + a lista around me.
    const above = aroundMe?.above ?? [];
    const me = aroundMe?.me ?? null;
    const below = aroundMe?.below ?? [];
    const empty = above.length === 0 && !me && below.length === 0;

    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary.purple}
          />
        }
      >
        {/* Cards de stats pessoais */}
        <View style={styles.statsRow}>
          <StatCard
            label="Posição semanal"
            value={
              myStats?.weekly_rank
                ? `#${myStats.weekly_rank}`
                : "—"
            }
            icon="calendar-outline"
            color={c.primary.purple}
            styles={styles}
            c={c}
          />
          <StatCard
            label="Posição total"
            value={
              myStats?.all_time_rank
                ? `#${myStats.all_time_rank}`
                : "—"
            }
            icon="trophy-outline"
            color={c.semantic.warning}
            styles={styles}
            c={c}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="XP na semana"
            value={`${myStats?.weekly_xp ?? 0}`}
            icon="flash-outline"
            color={c.primary.blue}
            styles={styles}
            c={c}
          />
          <StatCard
            label="Sequência"
            value={`${myStats?.streak ?? 0}d`}
            icon="flame-outline"
            color={c.semantic.streak}
            styles={styles}
            c={c}
          />
        </View>

        {empty ? (
          <EmptyState
            onStartLesson={onStartLesson}
            styles={styles}
            c={c}
          />
        ) : (
          <View style={styles.listCard}>
            <Text style={styles.listCardTitle}>Vizinhos no ranking</Text>
            {above.map((entry) => (
              <Row
                key={entry.user_id}
                entry={entry}
                isMe={entry.user_id === userId}
                styles={styles}
                c={c}
              />
            ))}
            {me ? (
              <Row entry={me} isMe styles={styles} c={c} />
            ) : (
              <Row
                entry={{
                  rank: 0,
                  user_id: userId,
                  display_name: myDisplayName,
                  avatar_emoji: myAvatarEmoji,
                  xp: 0,
                  lessons_completed: 0,
                  streak: 0,
                }}
                isMe
                placeholderMe
                styles={styles}
                c={c}
              />
            )}
            {below.map((entry) => (
              <Row
                key={entry.user_id}
                entry={entry}
                isMe={entry.user_id === userId}
                styles={styles}
                c={c}
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // Tabs "weekly" e "all" — lista única
  const data = activeTab === "weekly" ? (weekly ?? []) : (allTime ?? []);

  if (data.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary.purple}
          />
        }
      >
        <EmptyState
          onStartLesson={onStartLesson}
          styles={styles}
          c={c}
        />
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.user_id}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={c.primary.purple}
        />
      }
      renderItem={({ item }) => (
        <Row
          entry={item}
          isMe={item.user_id === userId}
          styles={styles}
          c={c}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
    />
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  styles,
  c,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  styles: ReturnType<typeof createStyles>;
  c: ThemeColors;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: c.neutral.surface }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({
  entry,
  isMe,
  placeholderMe,
  styles,
  c,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
  placeholderMe?: boolean;
  styles: ReturnType<typeof createStyles>;
  c: ThemeColors;
}) {
  const rankColor =
    entry.rank === 1
      ? "#f4c430" // gold
      : entry.rank === 2
        ? "#c0c0c0" // silver
        : entry.rank === 3
          ? "#cd7f32" // bronze
          : c.neutral.textSecondary;

  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <View style={[styles.rankBadge, { borderColor: rankColor }]}>
        <Text style={[styles.rankText, { color: rankColor }]}>
          {entry.rank > 0 ? `#${entry.rank}` : "—"}
        </Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>{entry.avatar_emoji || "🦊"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {entry.display_name}
          {isMe ? "  (você)" : ""}
        </Text>
        <Text style={styles.rowCaption} numberOfLines={1}>
          {placeholderMe
            ? "Sem dados ainda — termina uma lição pra entrar no ranking"
            : `${entry.lessons_completed} lições · ${entry.streak}d sequência`}
        </Text>
      </View>
      <View style={styles.xpWrap}>
        <Text style={styles.xpValue}>{entry.xp}</Text>
        <Text style={styles.xpLabel}>XP</Text>
      </View>
    </View>
  );
}

function EmptyState({
  onStartLesson,
  styles,
  c,
}: {
  onStartLesson: () => void;
  styles: ReturnType<typeof createStyles>;
  c: ThemeColors;
}) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="trophy-outline" size={56} color={c.primary.purple} />
      <Text style={styles.centerTitle}>Sem ranking ainda</Text>
      <Text style={styles.centerBody}>
        Seja o primeiro! Termina uma lição pra aparecer aqui.
      </Text>
      <Pressable
        style={styles.primaryBtn}
        onPress={onStartLesson}
        accessibilityRole="button"
        accessibilityLabel="Começar uma lição"
      >
        <Ionicons name="play" size={16} color="#fff" />
        <Text style={styles.primaryBtnText}>Começar lição</Text>
      </Pressable>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
    },
    headerCenter: { flex: 1, alignItems: "center" },
    headerSpacer: { width: 24 },
    headerTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 16,
      color: c.neutral.textPrimary,
    },
    headerSubtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    tabsRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.neutral.border,
      alignItems: "center",
    },
    tabActive: {
      backgroundColor: c.primary.purple,
      borderColor: c.primary.purple,
    },
    tabText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    tabTextActive: { color: "#fff" },
    scroll: {
      padding: 18,
      paddingTop: 4,
      paddingBottom: 60,
      gap: 12,
    },
    centerWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      gap: 12,
    },
    centerTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 18,
      color: c.neutral.textPrimary,
      marginTop: 6,
      textAlign: "center",
    },
    centerBody: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
      textAlign: "center",
      maxWidth: 320,
      lineHeight: 19,
    },
    centerCaption: {
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      color: c.neutral.textSecondary,
      marginTop: 8,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.primary.purple,
    },
    primaryBtnText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
    },
    statCard: {
      flex: 1,
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.neutral.elevated,
      borderWidth: 1,
      borderColor: c.neutral.border,
      alignItems: "flex-start",
      gap: 6,
    },
    statIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
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
    listCard: {
      backgroundColor: c.neutral.elevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.neutral.border,
      padding: 6,
      marginTop: 8,
    },
    listCardTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 12,
      color: c.neutral.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.neutral.elevated,
      borderWidth: 1,
      borderColor: c.neutral.border,
      ...cardShadow({ opacity: 0.04, radius: 4, y: 1 }),
    },
    rowMe: {
      backgroundColor: c.primary.purple + "22", // semi-transparent purple
      borderColor: c.primary.purple,
    },
    rowSeparator: { height: 8 },
    rankBadge: {
      minWidth: 44,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    rankText: {
      fontFamily: "Poppins-Bold",
      fontSize: 13,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.neutral.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarEmoji: { fontSize: 22 },
    rowName: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    rowCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    xpWrap: {
      alignItems: "flex-end",
      minWidth: 56,
    },
    xpValue: {
      fontFamily: "Poppins-Bold",
      fontSize: 16,
      color: c.primary.purple,
    },
    xpLabel: {
      fontFamily: "Poppins-Medium",
      fontSize: 10,
      color: c.neutral.textSecondary,
      letterSpacing: 0.6,
    },
    emptyWrap: {
      paddingTop: 60,
      paddingBottom: 40,
      alignItems: "center",
      gap: 10,
    },
  });
}
