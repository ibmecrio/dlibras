// Helpers de acessibilidade para `prefers-reduced-motion`.
//
// Web: usa `window.matchMedia("(prefers-reduced-motion: reduce)")` e escuta mudanças.
// Native: usa `AccessibilityInfo.isReduceMotionEnabled()` + listener nativo.
// Default seguro: `false` quando a plataforma/API não está disponível, para
// não desativar animações por engano.

import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function getInitialReducedMotion(): boolean {
  if (Platform.OS === "web") {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      try {
        return window.matchMedia(MEDIA_QUERY).matches;
      } catch {
        return false;
      }
    }
    return false;
  }
  // Em native começamos com `false` e ajustamos no efeito assíncrono.
  return false;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    getInitialReducedMotion()
  );

  useEffect(() => {
    let cancelled = false;

    if (Platform.OS === "web") {
      if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
      ) {
        return;
      }
      let mql: MediaQueryList;
      try {
        mql = window.matchMedia(MEDIA_QUERY);
      } catch {
        return;
      }
      const handleChange = (event: MediaQueryListEvent) => {
        if (!cancelled) setReduced(event.matches);
      };
      // Sincroniza estado caso o valor inicial tenha mudado entre render e efeito.
      setReduced(mql.matches);
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", handleChange);
        return () => {
          cancelled = true;
          mql.removeEventListener("change", handleChange);
        };
      }
      // Safari mais antigo só expõe addListener/removeListener.
      if (typeof mql.addListener === "function") {
        mql.addListener(handleChange);
        return () => {
          cancelled = true;
          mql.removeListener(handleChange);
        };
      }
      return () => {
        cancelled = true;
      };
    }

    // Native (iOS/Android): consulta inicial + listener de mudança.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduced(enabled);
      })
      .catch(() => {
        // Mantém default false em caso de erro.
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (!cancelled) setReduced(enabled);
      }
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}
