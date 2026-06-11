// Notificações locais (lembrete diário) via expo-notifications.
//
// LIMITES:
//   - Expo Go SDK 53+ NÃO suporta notificações remotas, mas LOCAIS rolam
//     em iOS (precisa permissão) e Android.
//   - Pra produção (push remoto), precisa EAS Build + servidor de notificações.
//   - No web não dá pra agendar notificação fechada — só com Service Worker
//     + Notifications API + tab aberta. Mostra um aviso.
//
// API:
//   await ensureNotifPermission();
//   await scheduleDailyReminder({ hour: 20, minute: 0 });
//   await cancelAllReminders();

import { Platform } from "react-native";

interface ScheduleOptions {
  hour: number; // 0-23
  minute: number; // 0-59
}

const NOTIFICATION_IDENTIFIER = "dlibras-daily-reminder";

// Carrega expo-notifications dinamicamente — só importa quando alguém
// chama uma das funções (assim o module load não crasha em ambientes
// sem ele).
async function getNotifications() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications");
  } catch {
    return null;
  }
}

export async function ensureNotifPermission(): Promise<{
  granted: boolean;
  reason?: string;
}> {
  if (Platform.OS === "web") {
    // Web API de notificação — não funciona com tab fechada, mas o
    // usuário pode receber alerta enquanto navega.
    if (typeof window === "undefined" || !("Notification" in window)) {
      return { granted: false, reason: "Navegador sem suporte a notificações." };
    }
    if (window.Notification.permission === "granted") return { granted: true };
    if (window.Notification.permission === "denied") {
      return {
        granted: false,
        reason: "Permissão negada. Habilite nas configurações do navegador.",
      };
    }
    const perm = await window.Notification.requestPermission();
    return {
      granted: perm === "granted",
      reason: perm === "granted" ? undefined : "Você negou a permissão.",
    };
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return {
      granted: false,
      reason: "expo-notifications não disponível neste build (precisa EAS Build).",
    };
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return { granted: true };
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    return {
      granted: res.granted,
      reason: res.granted
        ? undefined
        : "Permissão negada. Habilite em Ajustes → Notificações → Expo Go.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { granted: false, reason: msg };
  }
}

// Agenda lembrete diário no horário escolhido. Cancela qualquer agendado
// anteriormente pra não duplicar.
export async function scheduleDailyReminder(
  opts: ScheduleOptions,
): Promise<boolean> {
  if (Platform.OS === "web") {
    // No web não dá pra agendar pra horário futuro sem Service Worker rodando.
    // Salvamos a preferência no store, mas o disparo só rola se a tab tiver
    // aberta no horário (caller verifica e dispara).
    return true;
  }
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    await Notifications.cancelScheduledNotificationAsync?.(
      NOTIFICATION_IDENTIFIER,
    ).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDENTIFIER,
      content: {
        title: "Hora de praticar Libras! 🦊",
        body: "A Bia tá te esperando. Que tal 5 minutinhos?",
        sound: "default",
      },
      trigger: {
        type: "calendar",
        hour: opts.hour,
        minute: opts.minute,
        repeats: true,
      },
    });
    return true;
  } catch (err) {
    console.warn("[notif] schedule failed", err);
    return false;
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync?.(
      NOTIFICATION_IDENTIFIER,
    );
  } catch {
    // ignore
  }
}

// Dispara IMEDIATAMENTE — useful pro botão "Testar notificação" no profile.
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (window.Notification.permission !== "granted") {
      const { granted } = await ensureNotifPermission();
      if (!granted) return false;
    }
    new window.Notification("Hora de praticar Libras! 🦊", {
      body: "A Bia tá te esperando. Que tal 5 minutinhos?",
    });
    return true;
  }
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Hora de praticar Libras! 🦊",
        body: "A Bia tá te esperando. Que tal 5 minutinhos?",
      },
      trigger: null, // imediato
    });
    return true;
  } catch {
    return false;
  }
}
