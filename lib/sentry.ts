// Sentry wrapper opt-in — init só se EXPO_PUBLIC_SENTRY_DSN estiver definido.
// Hoje é placeholder: chama console.warn quando capturaria evento.
// Pra ativar:
//   1. Cria projeto em sentry.io (React Native — Expo)
//   2. Coloca DSN em .env: EXPO_PUBLIC_SENTRY_DSN=https://...@oN.ingest.sentry.io/M
//   3. pnpm add @sentry/react-native @sentry/expo
//   4. Descomenta a importação real abaixo e a inicialização

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const ENABLED = !!SENTRY_DSN;

// Quando ativar (passo 4 acima):
// import * as Sentry from "@sentry/react-native";
// if (ENABLED) {
//   Sentry.init({
//     dsn: SENTRY_DSN,
//     tracesSampleRate: 0.1,
//     environment: __DEV__ ? "development" : "production",
//   });
// }

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!ENABLED) {
    if (__DEV__) console.warn("[sentry] captureException (placeholder):", err, context);
    return;
  }
  // Sentry.captureException(err, { extra: context });
}

export function captureMessage(msg: string, level: "info" | "warning" | "error" = "info"): void {
  if (!ENABLED) {
    if (__DEV__) console.log(`[sentry] ${level}: ${msg}`);
    return;
  }
  // Sentry.captureMessage(msg, level);
}

export function setUser(user: { id: string; email?: string } | null): void {
  if (!ENABLED) return;
  // Sentry.setUser(user);
}

export function isEnabled(): boolean {
  return ENABLED;
}
