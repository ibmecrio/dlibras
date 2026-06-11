// Detecção de offline cross-platform.
//
// Web: navigator.onLine + eventos online/offline
// Native: @react-native-community/netinfo (opcional — não temos a dep instalada,
//   então usamos um polling leve: fetch HEAD pro Libras API a cada 8s).
// Fallback: sempre "online" e deixa as requisições falharem normalmente.

import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { LIBRAS_API_URL } from "@/lib/apiUrl";

const POLL_INTERVAL_MS = 8000;

export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      return navigator.onLine !== false;
    }
    return true;
  });

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      const onOn = () => setOnline(true);
      const onOff = () => setOnline(false);
      window.addEventListener("online", onOn);
      window.addEventListener("offline", onOff);
      return () => {
        window.removeEventListener("online", onOn);
        window.removeEventListener("offline", onOff);
      };
    }

    // Native: polling leve. Não precisa ser instantâneo, só evitar UI confusa.
    let cancelled = false;
    async function check() {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        await fetch(`${LIBRAS_API_URL}/health`, {
          signal: controller.signal,
          method: "GET",
        });
        clearTimeout(timer);
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }
    void check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return online;
}
