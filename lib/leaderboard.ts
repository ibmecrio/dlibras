// Cliente para os endpoints /api/leaderboard/* do FastAPI.
//
// Convenções:
//   - Bearer token (EXPO_PUBLIC_PROXY_SECRET) — mesmo padrão dos outros proxies IA
//   - Retorna `null` em erro (com console.warn) — call sites tratam fallback
//   - Mantém zero dependência de Clerk (user_id pode vir do store/auth wrapper,
//     em demo mode ou em modo Clerk real)
//
// Endpoints assumidos (a serem implementados no FastAPI):
//   POST /api/leaderboard/users/upsert    → cria/atualiza perfil leaderboard
//   POST /api/leaderboard/scores          → submete XP/lições/streak após sessão
//   GET  /api/leaderboard/weekly          → top da semana
//   GET  /api/leaderboard/all-time        → ranking acumulado
//   GET  /api/leaderboard/around/:user_id → 5 acima + you + 5 abaixo
//   GET  /api/leaderboard/me/:user_id     → estatísticas do user (rank, xp etc.)
//
// Em modo demo (sem API) tudo retorna null — a screen lida com empty state.

import { LIBRAS_API_URL } from "./apiUrl";

const PROXY_SECRET = process.env.EXPO_PUBLIC_PROXY_SECRET;

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  xp: number;
  lessons_completed: number;
  streak: number;
}

export interface MyStats {
  total_xp: number;
  weekly_xp: number;
  weekly_rank: number | null;
  all_time_rank: number | null;
  streak: number;
}

export interface AroundMeResult {
  above: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  below: LeaderboardEntry[];
}

export interface UpsertUserPayload {
  user_id: string;
  display_name: string;
  avatar_emoji: string;
}

export interface SubmitScorePayload {
  user_id: string;
  xp_delta: number;
  lessons_completed: number;
  streak: number;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
  if (PROXY_SECRET) {
    headers.Authorization = `Bearer ${PROXY_SECRET}`;
  }
  return headers;
}

async function safeFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[leaderboard] ${res.status} ${url} ${text.slice(0, 160)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[leaderboard] network error ${url}`, err);
    return null;
  }
}

/** Cria ou atualiza o perfil de leaderboard do user. */
export async function upsertUser(
  payload: UpsertUserPayload,
): Promise<{ ok: true } | null> {
  return safeFetch(`${LIBRAS_API_URL}/api/leaderboard/users/upsert`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
}

/** Submete delta de pontuação (XP/lessons/streak) após uma sessão. */
export async function submitScore(
  payload: SubmitScorePayload,
): Promise<{ ok: true } | null> {
  return safeFetch(`${LIBRAS_API_URL}/api/leaderboard/scores`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
}

/** Top semanal — array já ordenado por rank ascendente. */
export async function fetchWeekly(
  limit = 50,
): Promise<LeaderboardEntry[] | null> {
  return safeFetch<LeaderboardEntry[]>(
    `${LIBRAS_API_URL}/api/leaderboard/weekly?limit=${limit}`,
    { headers: buildHeaders() },
  );
}

/** Ranking acumulado de todos os tempos. */
export async function fetchAllTime(
  limit = 50,
): Promise<LeaderboardEntry[] | null> {
  return safeFetch<LeaderboardEntry[]>(
    `${LIBRAS_API_URL}/api/leaderboard/all-time?limit=${limit}`,
    { headers: buildHeaders() },
  );
}

/** Janela centrada no user: 5 acima + you + 5 abaixo. */
export async function fetchAroundMe(
  userId: string,
  radius = 5,
): Promise<AroundMeResult | null> {
  return safeFetch<AroundMeResult>(
    `${LIBRAS_API_URL}/api/leaderboard/around/${encodeURIComponent(
      userId,
    )}?radius=${radius}`,
    { headers: buildHeaders() },
  );
}

/** Estatísticas pessoais do user — pra cards do topo da tab "Eu". */
export async function fetchMe(userId: string): Promise<MyStats | null> {
  return safeFetch<MyStats>(
    `${LIBRAS_API_URL}/api/leaderboard/me/${encodeURIComponent(userId)}`,
    { headers: buildHeaders() },
  );
}
