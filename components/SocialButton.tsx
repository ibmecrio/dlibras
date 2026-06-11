import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ThemeColors, useThemeColors } from "@/constants/theme";

interface Props {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}

export default function SocialButton({ icon, label, onPress }: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 10,
    },
    iconWrap: {
      width: 24,
      alignItems: "center",
    },
    label: {
      flex: 1,
      textAlign: "center",
      fontFamily: "Poppins-Medium",
      fontSize: 14,
      color: c.neutral.textPrimary,
    },
  });
}
