import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";

export type PathNodeState = "completed" | "current" | "locked";

interface PathNodeProps {
  // Letra/ícone exibido no centro do círculo (ex.: "A", "AMOR", "J", "🎯").
  label: string;
  // Descrição abaixo (título da lição).
  caption: string;
  state: PathNodeState;
  // Posição no zig-zag: "left" | "right" | "center" (esse último p/ início/fim).
  align: "left" | "right" | "center";
  // Index global pra cascata de animação.
  index: number;
  onPress: () => void;
}

// Nó do caminho de aprendizado — círculo grande à la Duolingo, alternando
// lados conforme o aluno desce a tela. Estado controla cor e clicabilidade.
export function PathNode({
  label,
  caption,
  state,
  align,
  index,
  onPress,
}: PathNodeProps) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (state !== "current") return;
    // Pulsa só no nó ativo pra chamar atenção do aluno
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [state, pulse]);

  // shadowOpacity é deprecated em web — animação fica só na scale.
  // O glow fica via boxShadow estático no createStyles, sem dependência
  // da Reanimated UI thread pra evitar warnings de deprecated style props.
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const isLocked = state === "locked";
  const circleColor =
    state === "completed"
      ? c.semantic.success
      : state === "current"
        ? c.primary.purple
        : c.neutral.surface;
  const borderColor =
    state === "completed"
      ? c.semantic.success
      : state === "current"
        ? c.primary.deepPurple
        : c.neutral.border;
  const textColor = isLocked ? c.neutral.textSecondary : "#fff";

  const alignStyle =
    align === "left"
      ? styles.alignLeft
      : align === "right"
        ? styles.alignRight
        : styles.alignCenter;

  return (
    <Animated.View
      entering={FadeIn.delay(index * 60).duration(340)}
      style={[styles.wrap, alignStyle]}
    >
      <Pressable
        onPress={onPress}
        disabled={isLocked}
        accessibilityRole="button"
        accessibilityLabel={`${caption}${
          state === "completed"
            ? " — concluída"
            : state === "current"
              ? " — disponível"
              : " — bloqueada"
        }`}
        accessibilityState={{ disabled: isLocked }}
        style={({ pressed }) => [
          pressed && !isLocked && styles.pressed,
        ]}
      >
        <Animated.View
          style={[
            styles.circle,
            cardShadow({ color: borderColor, opacity: 0.25, radius: 10, y: 6, elevation: 6 }),
            {
              backgroundColor: circleColor,
              borderColor,
            },
            state === "current" && pulseStyle,
          ]}
        >
          {state === "completed" ? (
            <Ionicons name="checkmark" size={32} color="#fff" />
          ) : state === "locked" ? (
            <Ionicons name="lock-closed" size={22} color={textColor} />
          ) : (
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {label}
            </Text>
          )}
        </Animated.View>
        <Text
          style={[
            styles.caption,
            { color: isLocked ? c.neutral.textSecondary : c.neutral.textPrimary },
          ]}
          numberOfLines={2}
        >
          {caption}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// Conector entre dois PathNodes — 3 bolinhas centralizadas em coluna,
// formando um "caminho" simples que liga visualmente os nós.
// fromAlign/toAlign são intencionalmente IGNORADOS — tentativas anteriores
// de criar diagonal davam dots flutuando no vácuo. Coluna central funciona
// pra qualquer combinação de alinhamentos.
export function PathConnector({
  active,
}: {
  // Mantidas na assinatura pra compat de chamadas antigas — não usadas.
  fromAlign?: "left" | "right" | "center";
  toAlign?: "left" | "right" | "center";
  active: boolean;
}) {
  const c = useThemeColors();
  const dotColor = active ? c.primary.purple : c.neutral.border;
  return (
    <View style={connectorStyles.wrap}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[connectorStyles.dot, { backgroundColor: dotColor }]}
        />
      ))}
    </View>
  );
}

const NODE_SIZE = 76;

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: "100%",
      alignItems: "center",
    },
    alignLeft: {
      alignItems: "flex-start",
      paddingLeft: 32,
    },
    alignRight: {
      alignItems: "flex-end",
      paddingRight: 32,
    },
    alignCenter: {
      alignItems: "center",
    },
    circle: {
      width: NODE_SIZE,
      height: NODE_SIZE,
      borderRadius: NODE_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      // shadow é aplicada inline com cor dinâmica no JSX (via cardShadow)
    },
    label: {
      fontFamily: "Poppins-Bold",
      fontSize: 24,
      paddingHorizontal: 6,
    },
    caption: {
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      marginTop: 8,
      maxWidth: 140,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
  });
}

const connectorStyles = StyleSheet.create({
  wrap: {
    height: 44,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
