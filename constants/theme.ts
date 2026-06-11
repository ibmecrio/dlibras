// Design tokens com suporte a light/dark mode.
//
// `colors` segue exportado como o tema light pra StyleSheets estáticos
// — telas que ainda não migraram pra `useThemeColors()` continuam funcionando.
// Telas/components com necessidade de dark mode importam o hook e geram
// estilos via `useMemo(() => createStyles(themeColors), [themeColors])`.

import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

import { useLearningStore } from "@/store/learningStore";

export type ThemeColors = {
  primary: {
    purple: string;
    deepPurple: string;
    blue: string;
    green: string;
  };
  semantic: {
    success: string;
    warning: string;
    streak: string;
    error: string;
    info: string;
  };
  neutral: {
    textPrimary: string;
    textSecondary: string;
    border: string;
    surface: string;
    background: string;
    elevated: string;
    overlay: string;
  };
};

export const lightColors: ThemeColors = {
  primary: {
    purple: "#6c4ef5",
    deepPurple: "#5b3bf6",
    blue: "#4d88ff",
    green: "#21c16b",
  },
  semantic: {
    success: "#21c16b",
    warning: "#ffcb00",
    streak: "#ff8a00",
    error: "#ff4d4f",
    info: "#4d88ff",
  },
  neutral: {
    textPrimary: "#001328",
    textSecondary: "#6b7280",
    border: "#e5e7eb",
    surface: "#f6f7fb",
    background: "#ffffff",
    elevated: "#ffffff",
    overlay: "rgba(0, 0, 0, 0.55)",
  },
};

export const darkColors: ThemeColors = {
  primary: {
    purple: "#8b73ff",
    deepPurple: "#7a5cff",
    blue: "#6ba0ff",
    green: "#3cd87f",
  },
  semantic: {
    success: "#3cd87f",
    warning: "#ffd64a",
    streak: "#ffa441",
    error: "#ff6b6d",
    info: "#6ba0ff",
  },
  neutral: {
    // Fundo levemente azulado pra remeter ao roxo do brand sem ficar puro preto.
    textPrimary: "#f3f4f8",
    textSecondary: "#9ca3af",
    border: "#2a2d3a",
    surface: "#1c1f2b",
    background: "#11131c",
    elevated: "#1c1f2b",
    overlay: "rgba(0, 0, 0, 0.7)",
  },
};

// Mantido pra retro-compat — código antigo `import { colors } from "@/constants/theme"`
// segue funcionando, sempre na variante light. Novas telas devem usar o hook.
export const colors = lightColors;

// Hook para consumir cores em telas/components.
// Respeita o override (light/dark) do usuário se setado no profile;
// caso contrário segue o tema do sistema operacional.
export function useThemeColors(): ThemeColors {
  return useIsDark() ? darkColors : lightColors;
}

export function useIsDark(): boolean {
  // SSG do Expo Web Export pre-renderiza assumindo light theme. Se o user
  // tiver OS em dark, o primeiro paint cliente seria 'dark' enquanto o HTML
  // server tem 'light' — isso dispara React error #418 (hydration mismatch).
  // Fix: gate via 'mounted' garante que SSR + 1o paint cliente === light,
  // depois useEffect dispara re-render com o tema real.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const scheme = useColorScheme();
  const override = useLearningStore((s) => s.themeOverride);

  if (!mounted) return false; // light theme durante hidratação
  if (override === "light") return false;
  if (override === "dark") return true;
  return scheme === "dark";
}

export const fontFamily = {
  regular: "Poppins-Regular",
  medium: "Poppins-Medium",
  semiBold: "Poppins-SemiBold",
  bold: "Poppins-Bold",
} as const;

export const fontSize = {
  h1: 32,
  h2: 24,
  h3: 20,
  h4: 16,
  bodyLg: 16,
  bodyMd: 14,
  bodySm: 13,
  caption: 11,
} as const;

export const lineHeight = {
  h1: 38,
  h2: 31,
  h3: 26,
  h4: 22,
  bodyLg: 26,
  bodyMd: 22,
  bodySm: 21,
  caption: 15,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
} as const;

// textStyles seguem com cor light por compat. Para variar com tema,
// component pode sobrescrever a cor consumindo useThemeColors().
export const textStyles = {
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.h1,
    color: lightColors.neutral.textPrimary,
  },
  h2: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semiBold,
    lineHeight: lineHeight.h2,
    color: lightColors.neutral.textPrimary,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    fontWeight: fontWeight.semiBold,
    lineHeight: lineHeight.h3,
    color: lightColors.neutral.textPrimary,
  },
  h4: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.h4,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.h4,
    color: lightColors.neutral.textPrimary,
  },
  bodyLg: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodyLg,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.bodyLg,
    color: lightColors.neutral.textPrimary,
  },
  bodyMd: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodyMd,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.bodyMd,
    color: lightColors.neutral.textPrimary,
  },
  bodySm: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySm,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.bodySm,
    color: lightColors.neutral.textPrimary,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.caption,
    color: lightColors.neutral.textSecondary,
  },
} as const;
