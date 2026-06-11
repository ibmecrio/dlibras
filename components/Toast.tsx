// Toast/snackbar leve com fila + provider.
//
// Uso:
//   const toast = useToast();
//   toast.show({ message: "+5 XP", kind: "xp" });
//   toast.show({ message: "Erro ao salvar", kind: "error" });
//
// Substitui Alert() throwaway com algo menos intrusivo, animado, e
// consistente com o resto do tema (dark/light, Poppins, cardShadow).

import { Ionicons } from "@expo/vector-icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  SlideInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeColors, fontFamily, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastKind = "success" | "error" | "info" | "xp";

export type ToastOptions = {
  message: string;
  kind?: ToastKind;
  /** Override do auto-dismiss em ms. Default depende do kind. */
  durationMs?: number;
};

type ToastItem = ToastOptions & {
  id: string;
  kind: ToastKind;
  durationMs: number;
};

type ToastApi = {
  show: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast() precisa de <ToastProvider> em volta do componente.",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3;
const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 2500,
  xp: 2500,
  info: 2500,
  error: 4000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Counter pra IDs únicos sem depender de crypto.randomUUID (que não existe
  // no Hermes mais antigo).
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((opts: ToastOptions) => {
    counter.current += 1;
    const kind: ToastKind = opts.kind ?? "info";
    const durationMs = opts.durationMs ?? DEFAULT_DURATION[kind];
    const id = `toast-${counter.current}-${Date.now()}`;
    const item: ToastItem = {
      ...opts,
      id,
      kind,
      durationMs,
    };
    setToasts((prev) => {
      // Mantém só os últimos MAX_VISIBLE — derruba os mais antigos.
      const next = [...prev, item];
      if (next.length > MAX_VISIBLE) {
        return next.slice(next.length - MAX_VISIBLE);
      }
      return next;
    });
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

const TAB_BAR_HEIGHT = 64;

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  // Empilha acima da tab bar; em telas sem tab bar fica só acima da safe area.
  const bottom = insets.bottom + TAB_BAR_HEIGHT + 12;

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.viewport, { bottom }]}
      accessibilityLiveRegion="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const c = useThemeColors();
  const styles = useMemo(() => createCardStyles(c), [c]);
  const { color, iconName } = useMemo(
    () => resolveKind(item.kind, c),
    [item.kind, c],
  );

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => clearTimeout(timer);
  }, [item.id, item.durationMs, onDismiss]);

  return (
    <Animated.View
      entering={
        item.kind === "xp"
          ? SlideInDown.springify().damping(16).mass(0.6)
          : FadeInDown.duration(220)
      }
      exiting={FadeOutDown.duration(180)}
      style={styles.wrap}
    >
      <Pressable
        onPress={() => onDismiss(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Fechar notificação: ${item.message}`}
        style={({ pressed }) => [
          styles.card,
          { borderLeftColor: color },
          pressed && styles.cardPressed,
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
          <Ionicons name={iconName} size={18} color="#fff" />
        </View>
        <Text style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveKind(
  kind: ToastKind,
  c: ThemeColors,
): { color: string; iconName: React.ComponentProps<typeof Ionicons>["name"] } {
  switch (kind) {
    case "success":
      return { color: c.semantic.success, iconName: "checkmark-circle" };
    case "error":
      return { color: c.semantic.error, iconName: "alert-circle" };
    case "xp":
      return { color: c.primary.purple, iconName: "sparkles" };
    case "info":
    default:
      return { color: c.primary.purple, iconName: "information-circle" };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 1000,
  },
});

function createCardStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: "100%",
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.neutral.elevated,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderLeftWidth: 4,
      ...cardShadow({ opacity: 0.14, radius: 12, y: 4, elevation: 6 }),
    },
    cardPressed: {
      opacity: 0.85,
    },
    iconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    message: {
      flex: 1,
      fontFamily: fontFamily.medium,
      fontSize: 13,
      lineHeight: 18,
      color: c.neutral.textPrimary,
    },
  });
}
