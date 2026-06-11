// Heatmap A-Z mostrando proficiência por letra.
// Verde escuro = muitos acertos, cinza = não praticada, vermelho = errou mais que acertou.

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { useLearningStore } from "@/store/learningStore";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function colorFor(
  stats: { correct: number; wrong: number } | undefined,
  c: ThemeColors,
): { bg: string; fg: string; label: string } {
  if (!stats || stats.correct + stats.wrong === 0) {
    return {
      bg: c.neutral.surface,
      fg: c.neutral.textSecondary,
      label: "—",
    };
  }
  const total = stats.correct + stats.wrong;
  const accuracy = stats.correct / total;
  if (accuracy >= 0.8) {
    return { bg: c.semantic.success, fg: "#fff", label: `${stats.correct}` };
  }
  if (accuracy >= 0.5) {
    return { bg: c.semantic.warning, fg: "#001328", label: `${stats.correct}/${total}` };
  }
  return { bg: c.semantic.error, fg: "#fff", label: `${stats.correct}/${total}` };
}

export function LetterHeatmap() {
  const c = useThemeColors();
  const letterStats = useLearningStore((s) => s.letterStats);
  const styles = useMemo(() => createStyles(c), [c]);

  const summary = useMemo(() => {
    const practiced = Object.keys(letterStats).length;
    const mastered = Object.values(letterStats).filter(
      (s) => s.correct + s.wrong > 0 && s.correct / (s.correct + s.wrong) >= 0.8,
    ).length;
    return { practiced, mastered };
  }, [letterStats]);

  return (
    <View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.practiced}</Text>
          <Text style={styles.summaryLabel}>letras vistas</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: c.semantic.success }]}>
            {summary.mastered}
          </Text>
          <Text style={styles.summaryLabel}>dominadas</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {ALPHABET.map((letter) => {
          const stats = letterStats[letter];
          const { bg, fg, label } = colorFor(stats, c);
          return (
            <View
              key={letter}
              style={[styles.cell, { backgroundColor: bg }]}
              accessibilityLabel={
                stats
                  ? `${letter}: ${stats.correct} acertos, ${stats.wrong} erros`
                  : `${letter}: não praticada`
              }
            >
              <Text style={[styles.cellLetter, { color: fg }]}>{letter}</Text>
              <Text style={[styles.cellLabel, { color: fg }]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendDot color={c.semantic.success} label="≥ 80% acerto" />
        <LegendDot color={c.semantic.warning} label="50-79%" />
        <LegendDot color={c.semantic.error} label="< 50%" />
        <LegendDot color={c.neutral.surface} label="não vista" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const c = useThemeColors();
  return (
    <View style={legendStyles.row}>
      <View style={[legendStyles.dot, { backgroundColor: color }]} />
      <Text style={[legendStyles.text, { color: c.neutral.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontFamily: "Poppins-Regular", fontSize: 10 },
});

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      marginBottom: 10,
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
    },
    summaryDivider: {
      width: 1,
      height: 24,
      backgroundColor: c.neutral.border,
    },
    summaryValue: {
      fontFamily: "Poppins-Bold",
      fontSize: 18,
      color: c.neutral.textPrimary,
    },
    summaryLabel: {
      fontFamily: "Poppins-Regular",
      fontSize: 10,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      justifyContent: "center",
    },
    cell: {
      width: 32,
      height: 38,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    cellLetter: {
      fontFamily: "Poppins-Bold",
      fontSize: 12,
    },
    cellLabel: {
      fontFamily: "Poppins-Regular",
      fontSize: 8,
      marginTop: -2,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
      marginTop: 12,
    },
  });
}
