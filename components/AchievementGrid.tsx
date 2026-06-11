import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ACHIEVEMENTS } from "@/data/achievements";

import { ThemeColors, useThemeColors } from "@/constants/theme";

interface AchievementGridProps {
  unlocked: string[];
}

// Grid 3-colunas com todas as conquistas. Locked aparecem cinza com ícone fade;
// unlocked usam a cor da conquista. Mostra contador (X/Y) no header.
export function AchievementGrid({ unlocked }: AchievementGridProps) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const unlockedSet = new Set(unlocked);

  return (
    <View>
      <View style={styles.summary}>
        <Text style={styles.summaryNumber}>
          {unlocked.length}
          <Text style={styles.summaryDenom}>/{ACHIEVEMENTS.length}</Text>
        </Text>
        <Text style={styles.summaryLabel}>conquistas</Text>
      </View>

      <View style={styles.grid}>
        {ACHIEVEMENTS.map((a) => {
          const isUnlocked = unlockedSet.has(a.id);
          return (
            <View key={a.id} style={styles.badgeWrap}>
              <View
                style={[
                  styles.badgeCircle,
                  {
                    backgroundColor: isUnlocked
                      ? a.color
                      : c.neutral.surface,
                    borderColor: isUnlocked ? a.color : c.neutral.border,
                  },
                ]}
              >
                <Ionicons
                  name={isUnlocked ? a.icon : "lock-closed"}
                  size={26}
                  color={isUnlocked ? "#fff" : c.neutral.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.badgeTitle,
                  {
                    color: isUnlocked
                      ? c.neutral.textPrimary
                      : c.neutral.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {a.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    summary: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      marginBottom: 12,
    },
    summaryNumber: {
      fontFamily: "Poppins-Bold",
      fontSize: 28,
      color: c.primary.purple,
    },
    summaryDenom: {
      fontFamily: "Poppins-Regular",
      fontSize: 16,
      color: c.neutral.textSecondary,
    },
    summaryLabel: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    badgeWrap: {
      width: "30%",
      alignItems: "center",
      marginBottom: 8,
    },
    badgeCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    badgeTitle: {
      fontFamily: "Poppins-Medium",
      fontSize: 11,
      textAlign: "center",
    },
  });
}
