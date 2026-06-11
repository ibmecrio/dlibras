// Resolução dinâmica da URL da Libras Vision API.
//
// Por que dinâmica:
//   - IP da LAN do Mac muda toda vez que ele entra/sai de uma rede Wi-Fi
//   - Hardcodar EXPO_PUBLIC_LIBRAS_API_URL exigia editar .env + reiniciar
//     Metro toda vez → péssimo DX
//
// Estratégia por plataforma:
//   - WEB: usa window.location.hostname (o bundle veio de algum host;
//     a API tá no mesmo host só que em :8001)
//   - NATIVE (iOS/Android): usa o hostUri que o Expo Bundler passa pro
//     app (ex: "192.168.10.150:8081" → vira "192.168.10.150:8001")
//
// Override manual:
//   - Se EXPO_PUBLIC_LIBRAS_API_URL estiver definido no .env, vence tudo.
//     Útil pra apontar pra uma API em outro host (servidor remoto, ngrok).

import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = 8001;

function deriveHost(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.hostname) {
      return window.location.hostname;
    }
    return "localhost";
  }

  // Native: hostUri vem do Expo bundler — formato "ip:porta" ou "ip:porta/path".
  // Em Expo Go (LAN) é o IP da LAN do Mac. Em build prod é vazio → cai pra
  // localhost (que só funciona se a API tiver túnel/portfwd).
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Em alguns paths Constants.expoConfig é null mas manifest2 tem
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { developer?: { host?: string } } } } })
      .manifest2?.extra?.expoGo?.developer?.host ??
    "";

  if (hostUri) {
    const match = hostUri.match(/^([\w.-]+)/);
    if (match) return match[1];
  }

  // Última cartada: o `extra` que a gente preenche em app.config.js. Esse
  // pode ter sido setado manualmente.
  const fromExtra = (Constants.expoConfig?.extra as { librasApiUrl?: string })
    ?.librasApiUrl;
  if (fromExtra) {
    try {
      const u = new URL(fromExtra);
      return u.hostname;
    } catch {
      // ignore
    }
  }

  return "localhost";
}

export function getLibrasApiUrl(): string {
  // Override manual via env wins
  const fromEnv = process.env.EXPO_PUBLIC_LIBRAS_API_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  const host = deriveHost();
  return `http://${host}:${DEFAULT_PORT}`;
}

export function getLibrasWsUrl(): string {
  // Deriva o WS URL a partir do HTTP. Se HTTPS → WSS.
  const http = getLibrasApiUrl();
  const url = http.replace(/^https/i, "wss").replace(/^http/i, "ws");
  return `${url}/predict-ws`;
}

// Para uso em componentes que querem reagir a mudanças (raro — host
// só muda se o Expo for re-bundleado, o que reinicia tudo). Resolução
// na importação é fine por enquanto.
export const LIBRAS_API_URL = getLibrasApiUrl();
export const LIBRAS_WS_URL = getLibrasWsUrl();
