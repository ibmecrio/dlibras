// TabBar estilo Duolingo simplificada — sem indicador flutuante (era causa
// de desalinhamento). Cada tab tem um "chip" interno: ativo = chip roxo
// com ícone branco; inativo = transparente com ícone cinza. Label sempre
// visível pra não causar jump de layout.

import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useMemo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeColors, fontFamily, useThemeColors } from "@/constants/theme";
import { useT } from "@/lib/i18n";
import { cardShadow } from "@/lib/styles";

const TAB_HEIGHT = 64;

type TabConfig = {
  i18nKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabConfig[] = [
  { i18nKey: "tab.home", icon: "home-outline", activeIcon: "home" },
  { i18nKey: "tab.learn", icon: "book-outline", activeIcon: "book" },
  { i18nKey: "tab.teacher", icon: "sparkles-outline", activeIcon: "sparkles" },
  { i18nKey: "tab.glossary", icon: "library-outline", activeIcon: "library" },
  { i18nKey: "tab.profile", icon: "person-outline", activeIcon: "person" },
];

// Remove o focus ring cyan do browser em Pressables. Aplicado por tab.
const noWebOutline =
  Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const t = useT();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 8 }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[index];
        const label = t(tab.i18nKey);
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tab,
              noWebOutline as object,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isFocused }}
          >
            <TabChip isFocused={isFocused} c={c}>
              <Ionicons
                name={isFocused ? tab.activeIcon : tab.icon}
                size={20}
                color={isFocused ? "#fff" : c.neutral.textSecondary}
              />
            </TabChip>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                isFocused && {
                  color: c.primary.purple,
                  fontFamily: fontFamily.semiBold,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Chip que enche de roxo quando ativo. Animação suave de cor + escala.
function TabChip({
  isFocused,
  c,
  children,
}: {
  isFocused: boolean;
  c: ThemeColors;
  children: React.ReactNode;
}) {
  const t = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    t.value = withTiming(isFocused ? 1 : 0, {
      duration: 200,
      easing: Easing.inOut(Easing.quad),
    });
  }, [isFocused, t]);

  const animStyle = useAnimatedStyle(() => {
    // Cresce levemente quando vira ativo (1 → 1.06 → 1, sutil).
    return {
      transform: [{ scale: 1 + 0.06 * t.value }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.chip,
        animStyle,
        {
          backgroundColor: isFocused ? c.primary.purple : "transparent",
        },
        isFocused &&
          cardShadow({
            color: c.primary.purple,
            opacity: 0.3,
            radius: 8,
            y: 4,
            elevation: 4,
          }),
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: c.neutral.background,
      borderTopWidth: 1,
      borderTopColor: c.neutral.border,
      ...cardShadow({ opacity: 0.06, radius: 8, y: -3, elevation: 8 }),
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 8,
      paddingBottom: 4,
      height: TAB_HEIGHT,
      gap: 2,
      ...((Platform.OS === "web" ? { cursor: "pointer" } : {}) as object),
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: 10,
      color: c.neutral.textSecondary,
      marginTop: 2,
    },
  });
}
