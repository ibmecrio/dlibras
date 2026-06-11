// Dashboard "Modo Professor" — visão pra docentes/escolas acompanharem alunos.
//
// Status: BETA — dados mockados inline. A estrutura está pronta pra um futuro
// backend real (ex.: /api/teacher/classroom/:id/students); por enquanto a
// proposta é validar UX, fluxo e métricas que fazem sentido pro professor.
//
// O que mostra:
//   - 3 cards de KPI (alunos ativos, lições concluídas, XP médio)
//   - Lista da turma com indicador de atividade (verde/amarelo/vermelho)
//   - Top 5 letras com mais erros (heatmap simples)
//   - Gráfico de atividade semanal (BarChart de gifted-charts)
//
// Wire de navegação: registrada no AppStack em app/_layout.tsx
// e linkada a partir do profile via router.push("/teacher-dashboard").

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { safeBack } from "@/lib/navigation";

type ActivityStatus = "active" | "idle" | "abandoned";

interface MockStudent {
  id: string;
  name: string;
  avatarEmoji: string;
  weeklyXp: number;
  lessonsCompleted: number;
  lastActivityHours: number; // horas desde última atividade
  status: ActivityStatus;
}

interface ErrorLetter {
  letter: string;
  accuracyPct: number; // 0-100, menor = mais erros
  attempts: number;
}

// --- Mock data ---------------------------------------------------------------
// Em produção isso virá de um endpoint /api/teacher/classroom/:id/...

const MOCK_STUDENTS: MockStudent[] = [
  {
    id: "s1",
    name: "Mariana Souza",
    avatarEmoji: "🦊",
    weeklyXp: 248,
    lessonsCompleted: 14,
    lastActivityHours: 2,
    status: "active",
  },
  {
    id: "s2",
    name: "Lucas Oliveira",
    avatarEmoji: "🐼",
    weeklyXp: 196,
    lessonsCompleted: 11,
    lastActivityHours: 6,
    status: "active",
  },
  {
    id: "s3",
    name: "Beatriz Lima",
    avatarEmoji: "🦋",
    weeklyXp: 182,
    lessonsCompleted: 10,
    lastActivityHours: 18,
    status: "active",
  },
  {
    id: "s4",
    name: "Pedro Henrique",
    avatarEmoji: "🐯",
    weeklyXp: 154,
    lessonsCompleted: 9,
    lastActivityHours: 26,
    status: "active",
  },
  {
    id: "s5",
    name: "Júlia Almeida",
    avatarEmoji: "🦄",
    weeklyXp: 142,
    lessonsCompleted: 8,
    lastActivityHours: 50,
    status: "active",
  },
  {
    id: "s6",
    name: "Rafael Costa",
    avatarEmoji: "🐢",
    weeklyXp: 96,
    lessonsCompleted: 5,
    lastActivityHours: 96, // ~4 dias
    status: "idle",
  },
  {
    id: "s7",
    name: "Sofia Mendes",
    avatarEmoji: "🐧",
    weeklyXp: 60,
    lessonsCompleted: 3,
    lastActivityHours: 120, // ~5 dias
    status: "idle",
  },
  {
    id: "s8",
    name: "Thiago Ribeiro",
    avatarEmoji: "🐶",
    weeklyXp: 12,
    lessonsCompleted: 1,
    lastActivityHours: 192, // ~8 dias
    status: "abandoned",
  },
];

const MOCK_ERROR_LETTERS: ErrorLetter[] = [
  { letter: "P", accuracyPct: 42, attempts: 64 },
  { letter: "Q", accuracyPct: 48, attempts: 51 },
  { letter: "T", accuracyPct: 54, attempts: 58 },
  { letter: "R", accuracyPct: 58, attempts: 72 },
  { letter: "S", accuracyPct: 61, attempts: 69 },
];

// Atividade semanal — XP total da turma por dia
const MOCK_WEEKLY_ACTIVITY: { value: number; label: string }[] = [
  { value: 320, label: "Dom" },
  { value: 480, label: "Seg" },
  { value: 560, label: "Ter" },
  { value: 420, label: "Qua" },
  { value: 610, label: "Qui" },
  { value: 720, label: "Sex" },
  { value: 540, label: "Sáb" },
];

const CLASSROOM_NAME = "Turma A — 3º ano";
const STAT_ACTIVE_STUDENTS = 24;
const STAT_WEEKLY_LESSONS = 87;
const STAT_AVG_XP = 142;

// -----------------------------------------------------------------------------

function formatLastActivity(hours: number): string {
  if (hours < 1) return "há minutos";
  if (hours < 24) return `há ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `há ${days}d`;
}

function statusColor(status: ActivityStatus, c: ThemeColors): string {
  if (status === "active") return c.semantic.success;
  if (status === "idle") return c.semantic.warning;
  return c.semantic.error;
}

function statusLabel(status: ActivityStatus): string {
  if (status === "active") return "Ativo";
  if (status === "idle") return "Inativo";
  return "Abandonou";
}

export default function TeacherDashboardScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const weeklyChartData = useMemo(
    () =>
      MOCK_WEEKLY_ACTIVITY.map((d, i, arr) => ({
        ...d,
        frontColor:
          i === arr.length - 1 ? c.primary.deepPurple : c.primary.purple,
      })),
    [c],
  );
  const maxWeekly = useMemo(
    () => Math.max(...MOCK_WEEKLY_ACTIVITY.map((d) => d.value), 100),
    [],
  );

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
          <Text style={styles.headerTitle}>Modo Professor</Text>
          <Text style={styles.headerSubtitle}>Beta · dados de exemplo</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            // Placeholder — export CSV vai virar ação real quando tiver backend
            console.warn("[teacher] export CSV ainda não implementado");
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Exportar relatório"
        >
          <Ionicons
            name="download-outline"
            size={22}
            color={c.neutral.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner beta */}
        <View style={styles.betaBanner}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={c.primary.purple}
          />
          <Text style={styles.betaText}>
            Recurso em desenvolvimento. Dados mostrados são exemplos pra
            validar o fluxo com professores.
          </Text>
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="Alunos ativos"
            value={`${STAT_ACTIVE_STUDENTS}`}
            sub="esta semana"
            icon="people-outline"
            color={c.primary.purple}
            styles={styles}
            c={c}
          />
          <KpiCard
            label="Lições"
            value={`${STAT_WEEKLY_LESSONS}`}
            sub="concluídas"
            icon="checkmark-done-outline"
            color={c.semantic.success}
            styles={styles}
            c={c}
          />
          <KpiCard
            label="XP médio"
            value={`${STAT_AVG_XP}`}
            sub="por aluno"
            icon="flash-outline"
            color={c.primary.blue}
            styles={styles}
            c={c}
          />
        </View>

        {/* Turma */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{CLASSROOM_NAME}</Text>
              <Text style={styles.cardCaption}>
                {MOCK_STUDENTS.length} alunos
              </Text>
            </View>
            <View style={styles.legendRow}>
              <LegendDot
                color={c.semantic.success}
                label="Ativo"
                styles={styles}
              />
              <LegendDot
                color={c.semantic.warning}
                label="Inativo"
                styles={styles}
              />
              <LegendDot
                color={c.semantic.error}
                label="Abandonou"
                styles={styles}
              />
            </View>
          </View>
          {MOCK_STUDENTS.map((student, idx) => (
            <View
              key={student.id}
              style={[
                styles.studentRow,
                idx === MOCK_STUDENTS.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.studentAvatar}>
                <Text style={styles.studentEmoji}>{student.avatarEmoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.studentNameRow}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {student.name}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusColor(student.status, c) },
                    ]}
                    accessibilityLabel={`Status: ${statusLabel(student.status)}`}
                  />
                </View>
                <Text style={styles.studentCaption} numberOfLines={1}>
                  {student.lessonsCompleted} lições ·{" "}
                  {formatLastActivity(student.lastActivityHours)}
                </Text>
              </View>
              <View style={styles.studentXpWrap}>
                <Text style={styles.studentXpValue}>{student.weeklyXp}</Text>
                <Text style={styles.studentXpLabel}>XP</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Letras com mais erros */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Letras mais difíceis</Text>
              <Text style={styles.cardCaption}>
                Onde a turma erra mais
              </Text>
            </View>
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={c.semantic.error}
            />
          </View>
          {MOCK_ERROR_LETTERS.map((entry) => (
            <View key={entry.letter} style={styles.errorLetterRow}>
              <View style={styles.errorLetterBadge}>
                <Text style={styles.errorLetterText}>{entry.letter}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.accuracyTrack}>
                  <View
                    style={[
                      styles.accuracyFill,
                      {
                        width: `${entry.accuracyPct}%` as `${number}%`,
                        backgroundColor:
                          entry.accuracyPct < 50
                            ? c.semantic.error
                            : entry.accuracyPct < 65
                              ? c.semantic.warning
                              : c.semantic.success,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.errorLetterCaption}>
                  {entry.accuracyPct}% acerto · {entry.attempts} tentativas
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Atividade da semana */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Atividade da semana</Text>
              <Text style={styles.cardCaption}>
                XP somado da turma por dia
              </Text>
            </View>
          </View>
          <BarChart
            data={weeklyChartData}
            barWidth={22}
            spacing={18}
            barBorderRadius={6}
            frontColor={c.primary.purple}
            yAxisColor="transparent"
            xAxisColor={c.neutral.border}
            xAxisLabelTextStyle={styles.axisLabel}
            yAxisTextStyle={styles.axisLabel}
            noOfSections={4}
            maxValue={maxWeekly}
            disablePress
          />
        </View>

        <Text style={styles.footer}>
          Em breve: criar turma, convidar alunos por código e exportar CSV.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
  styles,
  c,
}: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  styles: ReturnType<typeof createStyles>;
  c: ThemeColors;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: c.neutral.surface }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function LegendDot({
  color,
  label,
  styles,
}: {
  color: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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
    scroll: {
      padding: 18,
      paddingTop: 8,
      paddingBottom: 60,
      gap: 14,
    },
    betaBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.primary.purple,
    },
    betaText: {
      flex: 1,
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textPrimary,
      lineHeight: 16,
    },
    kpiRow: {
      flexDirection: "row",
      gap: 10,
    },
    kpiCard: {
      flex: 1,
      padding: 12,
      borderRadius: 16,
      backgroundColor: c.neutral.elevated,
      borderWidth: 1,
      borderColor: c.neutral.border,
      gap: 4,
    },
    kpiIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    kpiValue: {
      fontFamily: "Poppins-Bold",
      fontSize: 22,
    },
    kpiLabel: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.neutral.textPrimary,
    },
    kpiSub: {
      fontFamily: "Poppins-Regular",
      fontSize: 10,
      color: c.neutral.textSecondary,
    },
    card: {
      backgroundColor: c.neutral.elevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.neutral.border,
      padding: 14,
      gap: 4,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 10,
      gap: 8,
    },
    cardTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
      color: c.neutral.textPrimary,
    },
    cardCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
    },
    legendRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
      maxWidth: 180,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontFamily: "Poppins-Medium",
      fontSize: 10,
      color: c.neutral.textSecondary,
    },
    studentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.neutral.border,
    },
    studentAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.neutral.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    studentEmoji: { fontSize: 20 },
    studentNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    studentName: {
      flex: 1,
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    studentCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    studentXpWrap: {
      alignItems: "flex-end",
      minWidth: 50,
    },
    studentXpValue: {
      fontFamily: "Poppins-Bold",
      fontSize: 14,
      color: c.primary.purple,
    },
    studentXpLabel: {
      fontFamily: "Poppins-Medium",
      fontSize: 10,
      color: c.neutral.textSecondary,
      letterSpacing: 0.4,
    },
    errorLetterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    errorLetterBadge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.primary.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    errorLetterText: {
      fontFamily: "Poppins-Bold",
      fontSize: 16,
      color: "#fff",
    },
    accuracyTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.neutral.surface,
      overflow: "hidden",
    },
    accuracyFill: {
      height: 8,
      borderRadius: 4,
    },
    errorLetterCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 4,
    },
    axisLabel: {
      color: c.neutral.textSecondary,
      fontSize: 10,
      fontFamily: "Poppins-Regular",
    },
    footer: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      textAlign: "center",
      marginTop: 4,
      lineHeight: 16,
    },
  });
}
