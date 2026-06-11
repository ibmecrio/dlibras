import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { ThemeColors, useThemeColors } from "@/constants/theme";

// Objetivos de Desenvolvimento Sustentável (ODS / SDG da ONU) que esse
// projeto endereça. Importante numa defesa de TCC — DLibras é um aplicativo
// de inclusão digital pra pessoas surdas e ouvintes que querem aprender Libras.
const SDGS = [
  {
    id: 4,
    title: "Educação de qualidade",
    description:
      "Garantir acesso equitativo a aprendizagem ao longo da vida — incluindo Libras como segunda língua oficial.",
    color: "#C5192D",
    url: "https://brasil.un.org/pt-br/sdgs/4",
  },
  {
    id: 10,
    title: "Redução das desigualdades",
    description:
      "Promover inclusão social, econômica e política independente de deficiência. Cerca de 10 milhões de surdos no Brasil — Libras é direito constitucional desde 2002.",
    color: "#DD1367",
    url: "https://brasil.un.org/pt-br/sdgs/10",
  },
];

export function SdgBanner() {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <View>
      <Text style={styles.kicker}>IMPACTO SOCIAL</Text>
      <Text style={styles.title}>Objetivos de Desenvolvimento Sustentável</Text>
      <Text style={styles.subtitle}>
        DLibras endereça 2 dos 17 ODS da ONU.
      </Text>

      <View style={styles.list}>
        {SDGS.map((sdg) => (
          <Pressable
            key={sdg.id}
            onPress={() => Linking.openURL(sdg.url)}
            style={styles.row}
            accessibilityRole="link"
            accessibilityLabel={`ODS ${sdg.id}: ${sdg.title}`}
          >
            <View style={[styles.badge, { backgroundColor: sdg.color }]}>
              <Text style={styles.badgeNumber}>{sdg.id}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{sdg.title}</Text>
              <Text style={styles.rowDesc}>{sdg.description}</Text>
            </View>
            <Ionicons
              name="open-outline"
              size={16}
              color={c.neutral.textSecondary}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    kicker: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 10,
      letterSpacing: 1.4,
      color: c.primary.purple,
      marginBottom: 4,
    },
    title: {
      fontFamily: "Poppins-Bold",
      fontSize: 16,
      color: c.neutral.textPrimary,
    },
    subtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
      marginTop: 2,
      marginBottom: 14,
    },
    list: { gap: 10 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
    },
    badge: {
      width: 48,
      height: 48,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeNumber: {
      fontFamily: "Poppins-Bold",
      fontSize: 22,
      color: "#fff",
    },
    rowTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    rowDesc: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
  });
}
