// Fila offline pra requisições write (POST/PUT/PATCH) que falham por falta
// de rede ou indisponibilidade do server.
//
// Estratégia:
//   - Persiste cada request no AsyncStorage (key `dlibras_offline_queue`).
//   - `processQueue` itera e tenta reenviar; em sucesso remove, em falha
//     incrementa retry; quando retries > maxRetries, descarta + console.warn.
//   - `startQueueWorker` reage a `online`/`offline` (web) ou faz polling
//     leve no `/health` do Libras API (native) — mesmas heurísticas do
//     `lib/network.ts`, só que sem hook (precisa rodar fora do React tree).
//   - Backoff exponencial: 2^retries * 1000ms entre tentativas dentro de
//     uma mesma rodada de `processQueue`.
//
// Sem deps novas: usa AsyncStorage (já tem) e o fetch nativo.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { LIBRAS_API_URL } from "@/lib/apiUrl";

const STORAGE_KEY = "dlibras_offline_queue";
const DEFAULT_MAX_RETRIES = 5;
const ONLINE_POLL_INTERVAL_MS = 8000;
const QUEUE_TICK_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;

export interface QueuedRequest {
  id: string;
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers: Record<string, string>;
  body: string; // JSON stringified
  createdAt: number;
  retries: number;
  maxRetries: number;
}

// ─────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Sanitize: filtra entradas malformadas em vez de explodir tudo
    return parsed.filter(isQueuedRequest);
  } catch (e) {
    console.warn("[offlineQueue] readQueue failed:", e);
    return [];
  }
}

async function writeQueue(items: QueuedRequest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("[offlineQueue] writeQueue failed:", e);
  }
}

function isQueuedRequest(value: unknown): value is QueuedRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.url === "string" &&
    (v.method === "POST" || v.method === "PUT" || v.method === "PATCH") &&
    typeof v.headers === "object" &&
    typeof v.body === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.retries === "number" &&
    typeof v.maxRetries === "number"
  );
}

function generateId(): string {
  // ID curto pra não inchar o storage. Suficiente pra desambiguar entradas
  // dentro da fila local.
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export async function queueRequest(
  req: Omit<QueuedRequest, "id" | "createdAt" | "retries">,
): Promise<void> {
  const queue = await readQueue();
  const full: QueuedRequest = {
    ...req,
    maxRetries: req.maxRetries ?? DEFAULT_MAX_RETRIES,
    id: generateId(),
    createdAt: Date.now(),
    retries: 0,
  };
  queue.push(full);
  await writeQueue(queue);
}

export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// Lock simples pra evitar duas chamadas de processQueue rodando em paralelo
// (worker + chamada manual). AsyncStorage não é transacional, então quem
// chegar segundo só retorna sem fazer nada.
let processing = false;

export async function processQueue(): Promise<{
  sent: number;
  failed: number;
}> {
  if (processing) return { sent: 0, failed: 0 };
  processing = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return { sent: 0, failed: 0 };

    const remaining: QueuedRequest[] = [];
    let sent = 0;
    let failed = 0;

    for (const item of queue) {
      // Backoff entre tentativas dentro do mesmo tick — só pra dar respiro
      // ao server quando muita coisa acumulou. Não bloqueia a UI porque
      // processQueue roda fora do path crítico.
      if (item.retries > 0) {
        const wait = Math.min(
          MAX_BACKOFF_MS,
          Math.pow(2, item.retries) * 1000,
        );
        await sleep(wait);
      }

      const ok = await tryFetch(item);
      if (ok) {
        sent++;
        continue;
      }

      // Falhou: incrementa retry. Se passou do limite, descarta + warn.
      const nextRetries = item.retries + 1;
      if (nextRetries > item.maxRetries) {
        console.warn(
          `[offlineQueue] desistindo de ${item.method} ${item.url} ` +
            `após ${item.retries} tentativas (id=${item.id})`,
        );
        failed++;
        continue;
      }
      remaining.push({ ...item, retries: nextRetries });
      failed++;
    }

    await writeQueue(remaining);
    return { sent, failed };
  } finally {
    processing = false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────────────

export function startQueueWorker(): () => void {
  // Não dá pra usar `useIsOnline` aqui (é hook). Reimplementamos a mesma
  // lógica mas em modo "subscriber" — funciona fora do React tree.
  let cancelled = false;
  const cleanups: (() => void)[] = [];

  const onMaybeOnline = () => {
    void processQueue();
  };

  // Tick periódico — backstop pra quando os eventos online não dispararem
  // (ex.: a rede oscilou rápido demais ou o server tava down, não a rede).
  const tickId = setInterval(() => {
    if (cancelled) return;
    void processQueue();
  }, QUEUE_TICK_INTERVAL_MS);
  cleanups.push(() => clearInterval(tickId));

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const handler = () => onMaybeOnline();
    window.addEventListener("online", handler);
    cleanups.push(() => window.removeEventListener("online", handler));
  } else {
    // Native: polling leve no /health. Detectar a borda offline→online
    // e disparar processQueue.
    let lastOnline = true;
    const pollId = setInterval(() => {
      if (cancelled) return;
      void checkHealth().then((online) => {
        if (online && !lastOnline) {
          onMaybeOnline();
        }
        lastOnline = online;
      });
    }, ONLINE_POLL_INTERVAL_MS);
    cleanups.push(() => clearInterval(pollId));
  }

  // Tentativa inicial — se ainda tinha coisa na fila do app anterior,
  // já tenta enviar quando o worker liga.
  void processQueue();

  return () => {
    cancelled = true;
    for (const fn of cleanups) fn();
  };
}

// ─────────────────────────────────────────────────────────────────────
// Wrap utility — usa em vez de fetch() quando você quer fila automática.
// Pra GET ou métodos read, segue o caminho normal (sem enfileirar).
// ─────────────────────────────────────────────────────────────────────

export async function fetchWithQueue(
  url: string,
  opts: RequestInit,
): Promise<Response | null> {
  try {
    const res = await fetch(url, opts);
    if (res.ok) return res;
    throw new Error(`HTTP ${res.status}`);
  } catch {
    const method = (opts.method ?? "GET").toUpperCase();
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      await queueRequest({
        url,
        method,
        headers: normalizeHeaders(opts.headers),
        body: typeof opts.body === "string" ? opts.body : "",
        maxRetries: DEFAULT_MAX_RETRIES,
      });
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────

async function tryFetch(item: QueuedRequest): Promise<boolean> {
  try {
    const res = await fetch(item.url, {
      method: item.method,
      headers: item.headers,
      body: item.body,
    });
    if (res.ok) return true;
    // 4xx (exceto 408/429) provavelmente nunca vai dar OK — descarta direto
    // pra não ficar gastando retry à toa. 5xx e 408/429 são retryable.
    if (res.status >= 400 && res.status < 500) {
      if (res.status !== 408 && res.status !== 429) {
        console.warn(
          `[offlineQueue] ${item.method} ${item.url} respondeu ${res.status} — ` +
            "descartando (não-retryable).",
        );
        return true; // "sucesso" no sentido de remover da fila
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${LIBRAS_API_URL}/health`, {
      signal: controller.signal,
      method: "GET",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHeaders(
  headers: HeadersInit | undefined,
): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const [k, v] of headers) out[k] = v;
    return out;
  }
  // Já é Record<string, string>
  return { ...(headers as Record<string, string>) };
}
