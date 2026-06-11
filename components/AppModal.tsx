// Modal mobile-first reutilizável.
//
// Design:
//   - Bottom sheet (sobe de baixo) — padrão iOS/Android
//   - Backdrop escuro com fade
//   - No web fica centralizado com max-width pra não esticar
//   - Tap fora fecha (não bloqueia o user)
//
// Variantes:
//   - <AppModal kind="info">      → 1 botão "Fechar"
//   - <AppModal kind="confirm">   → 2 botões "Cancelar" + "Confirmar"
//
// Substitui:
//   - window.confirm() do browser (cara feia + não-brand)
//   - Alert.alert() do RN (visual genérico, comportamento estranho no web)

import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import {
  Modal,
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

import { ThemeColors, fontFamily, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";

type Kind = "info" | "confirm";

interface AppModalProps {
  visible: boolean;
  kind?: Kind;
  title: string;
  body?: string;
  // Botão principal — confirm OK / info Fechar
  primaryLabel?: string;
  // Botão secundário (só confirm)
  secondaryLabel?: string;
  // Cor do botão primário ("danger" pra red, "default" pra roxo)
  variant?: "default" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose: () => void;
}

export function AppModal({
  visible,
  kind = "info",
  title,
  body,
  primaryLabel,
  secondaryLabel,
  variant = "default",
  icon,
  onPrimary,
  onSecondary,
  onClose,
}: AppModalProps) {
  const c = useThemeColors();
  const styles = createStyles(c);
  const sheetY = useSharedValue(60);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      sheetY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
      fade.value = withTiming(1, { duration: 220 });
    } else {
      sheetY.value = 60;
      fade.value = 0;
    }
  }, [visible, sheetY, fade]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const primaryColor =
    variant === "danger" ? c.semantic.error : c.primary.purple;

  function handlePrimary() {
    onPrimary?.();
    onClose();
  }
  function handleSecondary() {
    onSecondary?.();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Fechar modal"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Handle visual (linha no topo do sheet) */}
          <View style={styles.handle} />

          {icon && (
            <View style={styles.iconWrap}>
              <Ionicons name={icon} size={28} color={primaryColor} />
            </View>
          )}

          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          {body ? (
            <Text style={styles.body}>{body}</Text>
          ) : null}

          <View style={styles.actions}>
            {kind === "confirm" && (
              <Pressable
                onPress={handleSecondary}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={secondaryLabel ?? "Cancelar"}
              >
                <Text style={styles.btnSecondaryText}>
                  {secondaryLabel ?? "Cancelar"}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handlePrimary}
              style={({ pressed }) => [
                styles.btnPrimary,
                { backgroundColor: primaryColor },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel ?? (kind === "info" ? "Fechar" : "Confirmar")}
            >
              <Text style={styles.btnPrimaryText}>
                {primaryLabel ?? (kind === "info" ? "Fechar" : "Confirmar")}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
    },
    sheet: {
      width: "100%",
      maxWidth: Platform.OS === "web" ? 480 : "100%",
      backgroundColor: c.neutral.elevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      // No web (desktop) o sheet flutua centralizado — adiciona radius
      // também embaixo pra parecer um card.
      ...(Platform.OS === "web"
        ? {
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            marginBottom: 24,
          }
        : {}),
      paddingTop: 12,
      paddingHorizontal: 22,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      gap: 12,
      ...cardShadow({ opacity: 0.18, radius: 16, y: -4, elevation: 12 }),
    },
    handle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.neutral.border,
      marginBottom: 4,
    },
    iconWrap: {
      alignSelf: "center",
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.neutral.surface,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    title: {
      fontFamily: fontFamily.bold,
      fontSize: 18,
      color: c.neutral.textPrimary,
      textAlign: "center",
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: 14,
      color: c.neutral.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 6,
    },
    btnPrimary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: {
      color: "#fff",
      fontFamily: fontFamily.semiBold,
      fontSize: 14,
    },
    btnSecondary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      backgroundColor: "transparent",
    },
    btnSecondaryText: {
      color: c.neutral.textPrimary,
      fontFamily: fontFamily.semiBold,
      fontSize: 14,
    },
  });
}
