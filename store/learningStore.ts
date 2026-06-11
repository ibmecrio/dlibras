import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { computeUnlocked } from "@/data/achievements";

export type Locale = "pt-BR" | "en" | "es";
export type LibrasModel = "knn" | "svm" | "mlp" | "rf" | "lr" | "ensemble";

export interface BiaChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface BiaConversation {
  id: string;
  title: string; // primeira pergunta do user (truncada) ou "Nova conversa"
  messages: BiaChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// xpHistory é o ground truth: mapa de "YYYY-MM-DD" → XP ganho naquele dia.
// xpToday e streak são DERIVADOS dele, pra evitar inconsistência entre o que
// o header mostra (xpToday) e o que o gráfico do perfil mostra.
type XpByDate = Record<string, number>;

function formatDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return formatDayKey(new Date());
}

// Streak = nº de dias consecutivos com XP > 0 terminando hoje (ou ontem,
// se a pessoa ainda não fez nada hoje — o streak só quebra quando passa
// um dia INTEIRO sem XP).
function computeStreak(history: XpByDate): number {
  const today = todayKey();
  const todayHasXp = (history[today] ?? 0) > 0;
  const todayMs = new Date(`${today}T00:00:00`).getTime();
  let cursor = todayHasXp ? 0 : 1;
  let count = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(todayMs - cursor * 86400000);
    const key = formatDayKey(d);
    if ((history[key] ?? 0) > 0) {
      count += 1;
      cursor += 1;
    } else {
      break;
    }
  }
  return count;
}

interface LearningState {
  xpToday: number;
  dailyGoal: number;
  streak: number;
  completedLessonIds: string[];
  xpHistory: XpByDate;
  audioFeedbackEnabled: boolean;
  librasDemoVisited: boolean;
  unlockedAchievements: string[];
  // IDs de achievements desbloqueados nesta sessão e ainda não exibidos —
  // o profile/home consome e limpa via clearJustUnlocked() pra animar uma
  // celebração só uma vez por unlock.
  justUnlocked: string[];
  // Bypass de Clerk em dev — quando true, useAuth/useUser caem num user fake
  // mesmo com Clerk habilitado. Usado pra contornar Turnstile / client_trust
  // que travam o sign-in no web.
  devBypassAuth: boolean;
  // i18n
  locale: Locale;
  // Push notif preferences
  notifEnabled: boolean;
  notifHour: number; // 0-23
  notifMinute: number; // 0-59
  // Modelo Libras Vision preferido (server-side decide se aceita)
  librasModel: LibrasModel;
  // Histórico de conversas com a Bia (mais recente primeiro)
  biaConversations: BiaConversation[];
  currentBiaConversationId: string | null;
  // Hearts (vidas) — Duolingo style. 5 max, perde 1 em erro, regen 1 a cada 30min.
  hearts: number;
  // Timestamp do último heart perdido — pra calcular quanto tempo falta pro regen
  heartsUpdatedAt: number;
  unlimitedHearts: boolean; // pra TCC/demo: pode ligar e nunca perde
  // Mapa letra → { correct, wrong } pra heatmap no profile
  letterStats: Record<string, { correct: number; wrong: number }>;
  // Profile customization (não vem do Clerk)
  displayNameOverride: string | null;
  avatarEmoji: string;
  // Theme override (auto/light/dark)
  themeOverride: "system" | "light" | "dark";
  // Glossário favorites
  favoriteLetters: string[];
  // Última data em que a celebração de meta diária rolou (YYYY-MM-DD)
  lastDailyGoalCelebrated: string | null;
  addXP: (amount: number) => void;
  completeLesson: (lessonId: string) => void;
  resetProgress: () => void;
  refreshDerived: () => void;
  setAudioFeedbackEnabled: (enabled: boolean) => void;
  markLibrasDemoVisited: () => void;
  clearJustUnlocked: () => void;
  setDevBypassAuth: (enabled: boolean) => void;
  setLocale: (locale: Locale) => void;
  setNotifEnabled: (enabled: boolean) => void;
  setNotifTime: (hour: number, minute: number) => void;
  setLibrasModel: (m: LibrasModel) => void;
  loseHeart: () => void;
  refreshHearts: () => void; // recalcula regen baseado no tempo decorrido
  refillHearts: () => void; // dev/demo helper — enche os 5
  toggleUnlimitedHearts: () => void;
  registerLetterResult: (letter: string, correct: boolean) => void;
  // Bia chat history actions
  startNewBiaConversation: () => string;
  setCurrentBiaConversation: (id: string | null) => void;
  appendBiaMessage: (conversationId: string, message: BiaChatMessage) => void;
  deleteBiaConversation: (conversationId: string) => void;
  clearAllBiaConversations: () => void;
  // Profile + theme + favorites + celebration
  setDisplayName: (name: string | null) => void;
  setAvatarEmoji: (emoji: string) => void;
  setThemeOverride: (theme: "system" | "light" | "dark") => void;
  toggleFavoriteLetter: (letter: string) => void;
  markDailyGoalCelebrated: () => void;
}

// Aplica computeUnlocked na state atual e retorna o delta (newly unlocked IDs).
// Atualiza a lista persistida e a fila justUnlocked.
function recomputeAchievements(
  state: Pick<
    LearningState,
    "completedLessonIds" | "xpHistory" | "streak" | "librasDemoVisited" | "unlockedAchievements"
  >,
): Pick<LearningState, "unlockedAchievements" | "justUnlocked"> {
  const next = computeUnlocked({
    completedLessonIds: state.completedLessonIds,
    xpHistory: state.xpHistory,
    streak: state.streak,
    librasDemoVisited: state.librasDemoVisited,
  });
  const prev = new Set(state.unlockedAchievements);
  const delta = next.filter((id) => !prev.has(id));
  return { unlockedAchievements: next, justUnlocked: delta };
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set, get) => ({
      xpToday: 0,
      dailyGoal: 20,
      streak: 0,
      completedLessonIds: [],
      xpHistory: seedHistory(),
      audioFeedbackEnabled: true,
      librasDemoVisited: false,
      unlockedAchievements: [],
      justUnlocked: [],
      devBypassAuth: false,
      locale: "pt-BR" as Locale,
      notifEnabled: false,
      notifHour: 20,
      notifMinute: 0,
      librasModel: "knn" as LibrasModel,
      biaConversations: [],
      currentBiaConversationId: null,
      hearts: 5,
      heartsUpdatedAt: Date.now(),
      unlimitedHearts: false,
      letterStats: {},
      displayNameOverride: null,
      avatarEmoji: "🦊",
      themeOverride: "system" as "system" | "light" | "dark",
      favoriteLetters: [],
      lastDailyGoalCelebrated: null,
      addXP: (amount) =>
        set((state) => {
          const key = todayKey();
          const nextHistory = {
            ...state.xpHistory,
            [key]: (state.xpHistory[key] ?? 0) + amount,
          };
          const nextStreak = computeStreak(nextHistory);
          const achievements = recomputeAchievements({
            completedLessonIds: state.completedLessonIds,
            xpHistory: nextHistory,
            streak: nextStreak,
            librasDemoVisited: state.librasDemoVisited,
            unlockedAchievements: state.unlockedAchievements,
          });
          return {
            xpHistory: nextHistory,
            xpToday: nextHistory[key],
            streak: nextStreak,
            unlockedAchievements: achievements.unlockedAchievements,
            justUnlocked: [
              ...state.justUnlocked,
              ...achievements.justUnlocked,
            ],
          };
        }),
      completeLesson: (lessonId) =>
        set((state) => {
          const completed = state.completedLessonIds.includes(lessonId)
            ? state.completedLessonIds
            : [...state.completedLessonIds, lessonId];
          const achievements = recomputeAchievements({
            completedLessonIds: completed,
            xpHistory: state.xpHistory,
            streak: state.streak,
            librasDemoVisited: state.librasDemoVisited,
            unlockedAchievements: state.unlockedAchievements,
          });
          return {
            completedLessonIds: completed,
            unlockedAchievements: achievements.unlockedAchievements,
            justUnlocked: [
              ...state.justUnlocked,
              ...achievements.justUnlocked,
            ],
          };
        }),
      resetProgress: () => {
        const emptyHistory: XpByDate = {};
        set({
          xpToday: 0,
          completedLessonIds: [],
          streak: 0,
          xpHistory: emptyHistory,
          librasDemoVisited: false,
          unlockedAchievements: [],
          justUnlocked: [],
        });
      },
      refreshDerived: () => {
        const history = get().xpHistory;
        set({
          xpToday: history[todayKey()] ?? 0,
          streak: computeStreak(history),
        });
      },
      setAudioFeedbackEnabled: (enabled) =>
        set({ audioFeedbackEnabled: enabled }),
      markLibrasDemoVisited: () =>
        set((state) => {
          if (state.librasDemoVisited) return {};
          const achievements = recomputeAchievements({
            completedLessonIds: state.completedLessonIds,
            xpHistory: state.xpHistory,
            streak: state.streak,
            librasDemoVisited: true,
            unlockedAchievements: state.unlockedAchievements,
          });
          return {
            librasDemoVisited: true,
            unlockedAchievements: achievements.unlockedAchievements,
            justUnlocked: [
              ...state.justUnlocked,
              ...achievements.justUnlocked,
            ],
          };
        }),
      clearJustUnlocked: () => set({ justUnlocked: [] }),
      setDevBypassAuth: (enabled) => set({ devBypassAuth: enabled }),
      setLocale: (locale) => set({ locale }),
      setNotifEnabled: (enabled) => set({ notifEnabled: enabled }),
      setNotifTime: (hour, minute) => set({ notifHour: hour, notifMinute: minute }),
      setLibrasModel: (librasModel) => set({ librasModel }),
      startNewBiaConversation: () => {
        const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          biaConversations: [
            {
              id,
              title: "Nova conversa",
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...state.biaConversations,
          ],
          currentBiaConversationId: id,
        }));
        return id;
      },
      setCurrentBiaConversation: (id) =>
        set({ currentBiaConversationId: id }),
      appendBiaMessage: (conversationId, message) =>
        set((state) => {
          const list = state.biaConversations.map((c) => {
            if (c.id !== conversationId) return c;
            const messages = [...c.messages, message];
            // Atualiza o título se ainda é "Nova conversa" e a msg é do user
            const title =
              c.title === "Nova conversa" && message.role === "user"
                ? message.content.slice(0, 48) +
                  (message.content.length > 48 ? "…" : "")
                : c.title;
            return { ...c, messages, title, updatedAt: Date.now() };
          });
          return { biaConversations: list };
        }),
      deleteBiaConversation: (conversationId) =>
        set((state) => ({
          biaConversations: state.biaConversations.filter(
            (c) => c.id !== conversationId,
          ),
          currentBiaConversationId:
            state.currentBiaConversationId === conversationId
              ? null
              : state.currentBiaConversationId,
        })),
      clearAllBiaConversations: () =>
        set({ biaConversations: [], currentBiaConversationId: null }),
      loseHeart: () =>
        set((state) => {
          if (state.unlimitedHearts) return {};
          if (state.hearts <= 0) return {};
          return { hearts: state.hearts - 1, heartsUpdatedAt: Date.now() };
        }),
      refreshHearts: () =>
        set((state) => {
          if (state.unlimitedHearts) return { hearts: 5 };
          if (state.hearts >= 5) return {};
          const elapsed = Date.now() - (state.heartsUpdatedAt || Date.now());
          const REGEN_MS = 30 * 60 * 1000;
          const regened = Math.floor(elapsed / REGEN_MS);
          if (regened <= 0) return {};
          const next = Math.min(5, state.hearts + regened);
          // Mantém o "rastro" do progresso pro próximo regen
          const remainder = elapsed - regened * REGEN_MS;
          return {
            hearts: next,
            heartsUpdatedAt: Date.now() - remainder,
          };
        }),
      refillHearts: () => set({ hearts: 5, heartsUpdatedAt: Date.now() }),
      toggleUnlimitedHearts: () =>
        set((state) => ({
          unlimitedHearts: !state.unlimitedHearts,
          hearts: !state.unlimitedHearts ? 5 : state.hearts,
        })),
      registerLetterResult: (letter, correct) =>
        set((state) => {
          const key = letter.toUpperCase();
          const prev = state.letterStats[key] ?? { correct: 0, wrong: 0 };
          return {
            letterStats: {
              ...state.letterStats,
              [key]: {
                correct: prev.correct + (correct ? 1 : 0),
                wrong: prev.wrong + (correct ? 0 : 1),
              },
            },
          };
        }),
      setDisplayName: (name: string | null) =>
        set({ displayNameOverride: name?.trim() ? name.trim() : null }),
      setAvatarEmoji: (avatarEmoji: string) => set({ avatarEmoji }),
      setThemeOverride: (themeOverride: "system" | "light" | "dark") =>
        set({ themeOverride }),
      toggleFavoriteLetter: (letter: string) =>
        set((state) => {
          const k = letter.toUpperCase();
          const has = state.favoriteLetters.includes(k);
          return {
            favoriteLetters: has
              ? state.favoriteLetters.filter((l) => l !== k)
              : [...state.favoriteLetters, k],
          };
        }),
      markDailyGoalCelebrated: () => set({ lastDailyGoalCelebrated: todayKey() }),
    }),
    {
      name: "learning-storage",
      version: 7,
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as Partial<LearningState>;
        const xpHistory = p.xpHistory ?? seedHistory();
        const completedLessonIds = p.completedLessonIds ?? [];
        const librasDemoVisited = p.librasDemoVisited ?? false;
        const streak = computeStreak(xpHistory);
        const unlocked = computeUnlocked({
          completedLessonIds,
          xpHistory,
          streak,
          librasDemoVisited,
        });
        return {
          xpToday: xpHistory[todayKey()] ?? 0,
          dailyGoal: p.dailyGoal ?? 20,
          streak,
          completedLessonIds,
          xpHistory,
          audioFeedbackEnabled: p.audioFeedbackEnabled ?? true,
          librasDemoVisited,
          unlockedAchievements: unlocked,
          justUnlocked: [],
          locale: p.locale ?? "pt-BR",
          notifEnabled: p.notifEnabled ?? false,
          notifHour: p.notifHour ?? 20,
          notifMinute: p.notifMinute ?? 0,
          librasModel: p.librasModel ?? "knn",
          biaConversations: p.biaConversations ?? [],
          currentBiaConversationId: p.currentBiaConversationId ?? null,
          hearts: p.hearts ?? 5,
          heartsUpdatedAt: p.heartsUpdatedAt ?? Date.now(),
          unlimitedHearts: p.unlimitedHearts ?? false,
          letterStats: p.letterStats ?? {},
          displayNameOverride: p.displayNameOverride ?? null,
          avatarEmoji: p.avatarEmoji ?? "🦊",
          themeOverride: p.themeOverride ?? "system",
          favoriteLetters: p.favoriteLetters ?? [],
          lastDailyGoalCelebrated: p.lastDailyGoalCelebrated ?? null,
        } as unknown as LearningState;
      },
      // No rehydrate, recomputa derivados (xpToday/streak/achievements) a partir
      // do xpHistory + completedLessonIds, que são as únicas fontes de verdade.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.xpToday = state.xpHistory[todayKey()] ?? 0;
        state.streak = computeStreak(state.xpHistory);
        state.unlockedAchievements = computeUnlocked({
          completedLessonIds: state.completedLessonIds,
          xpHistory: state.xpHistory,
          streak: state.streak,
          librasDemoVisited: state.librasDemoVisited,
        });
        state.justUnlocked = [];
      },
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// Histórico seed: simula uma semana de uso pra demo não parecer vazia.
// O dia de hoje começa em 0 — só conta XP real ganho no app.
function seedHistory(): XpByDate {
  const out: XpByDate = {};
  const now = Date.now();
  const seeds = [10, 25, 18, 30, 22, 12, 0];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    out[formatDayKey(d)] = seeds[6 - i];
  }
  return out;
}

// Helper reutilizado pelo Perfil — pega os 7 últimos dias na ordem.
export function lastSevenDays(
  history: XpByDate,
): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    out.push({
      value: history[formatDayKey(d)] ?? 0,
      label: dayLabels[d.getDay()],
    });
  }
  return out;
}
