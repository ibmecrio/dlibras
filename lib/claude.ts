// Cliente Claude (Anthropic) — pra features de texto AI no app.
//
// LIMITAÇÃO: Claude NÃO tem Realtime Voice API. Pra voz da Bia em tempo real
// (lesson screen voice mode) continue usando OpenAI Realtime via vision-agent.
//
// O que dá pra fazer com Claude aqui:
// - Chat de texto no glossário ("explica o sinal de AMOR")
// - Análise de progresso ("você está indo bem em consoantes mas tropeça em vogais")
// - Sugestões de próximas lições
//
// Como usar:
//   import { claudeChat } from "@/lib/claude";
//   const response = await claudeChat([{ role: "user", content: "Como faz o sinal de A?" }]);

// Metro só inclui no bundle vars que começam com EXPO_PUBLIC_.
// Sem o prefixo, process.env.ANTHROPIC_API_KEY é undefined em runtime.
const ANTHROPIC_API_KEY =
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;

// USE_PROXY=true → chama nosso FastAPI em vez de api.anthropic.com.
// Em prod, a key fica server-side; o client nem precisa de EXPO_PUBLIC_ANTHROPIC_API_KEY.
const USE_PROXY = process.env.EXPO_PUBLIC_USE_PROXY === "true";
const PROXY_SECRET = process.env.EXPO_PUBLIC_PROXY_SECRET;
// Haiku 4.5 é o modelo mais econômico da família atual (≈ $0.80/$4 por
// 1M tokens input/output, ~5× mais barato que Sonnet 4.6). Pra um chat
// curto da Bia (~280 tokens output) custa fração de centavo por mensagem.
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  text: string;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Envia mensagens pro Claude e retorna a resposta de texto.
 * Falha silenciosa se ANTHROPIC_API_KEY não estiver configurado.
 */
export async function claudeChat(
  messages: ClaudeMessage[],
  options?: {
    system?: string;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<ClaudeResponse | null> {
  if (!USE_PROXY && !ANTHROPIC_API_KEY) {
    console.warn("[claude] ANTHROPIC_API_KEY missing — skipping");
    return null;
  }
  try {
    // Se USE_PROXY: chama nosso server (sem key no client).
    // Caso contrário: direto na Anthropic com a key.
    const { LIBRAS_API_URL } = await import("./apiUrl");
    const url = USE_PROXY
      ? `${LIBRAS_API_URL}/api/anthropic/messages`
      : "https://api.anthropic.com/v1/messages";
    const headers: Record<string, string> = USE_PROXY
      ? {
          "Content-Type": "application/json",
          ...(PROXY_SECRET ? { Authorization: `Bearer ${PROXY_SECRET}` } : {}),
        }
      : {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: options?.maxTokens ?? 512,
        temperature: options?.temperature ?? 0.7,
        system:
          options?.system ??
          [
            "Você é a Bia, professora calorosa de Libras (Língua Brasileira de Sinais).",
            "Português brasileiro coloquial, como uma amiga explicando.",
            "Resposta em 2-3 frases curtas no MÁXIMO — vai virar voz, frase longa cansa.",
            "Quando ensinar um sinal: descreva POSIÇÃO (palma virada pra onde, dedos abertos/fechados/dobrados, polegar onde) e MOVIMENTO (só se tiver — alfabeto estático não tem).",
            "VARIE o fechamento — NUNCA repita a mesma frase final. Pode terminar com 'tenta aí', 'faz comigo', 'mostra aí', 'agora tu', 'pronto', ou só com a dica em si. Às vezes nem termina com nada, só explica.",
            "NÃO se apresente ('oi, sou a bia') se já estamos no meio de uma conversa. Só apresenta na PRIMEIRA mensagem.",
            "Foque em Libras: alfabeto manual, sinais básicos e palavras comuns.",
            "Se não souber um sinal: 'não tenho certeza desse sinal' — NUNCA invente.",
            "Sem markdown, sem asteriscos, sem listas — texto puro pra voz.",
          ].join(" "),
        messages,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[claude] ${res.status} ${text.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const textBlock = data.content?.find(
      (b: { type: string }) => b.type === "text",
    );
    return {
      text: textBlock?.text ?? "",
      usage: data.usage,
    };
  } catch (err) {
    console.warn("[claude] network error", err);
    return null;
  }
}

/** Quick helper pra perguntar UMA coisa ao Claude e receber texto. */
export async function askClaude(question: string): Promise<string | null> {
  const res = await claudeChat([{ role: "user", content: question }]);
  return res?.text ?? null;
}
