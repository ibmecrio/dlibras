// Toca um chime curto (~220ms) quando o aluno acerta a letra.
//
// expo-av crasha no web no SDK 54 (`requireNativeComponent` problemas + deprecated).
// Solução: usar HTMLAudioElement direto no web e expo-av só no nativo, com
// lazy require pra evitar parse-time errors em ambientes que não suportam.
// O Profile tem toggle pra desativar — esse arquivo confia que o caller já checou.

import { Platform } from "react-native";

const CHIME_URI = "/assets/assets/audio/match-chime.wav";

// Cache de instância pra evitar leak no web
let webAudio: HTMLAudioElement | null = null;

// Native — só importa expo-av no platform nativo
let nativeSound: unknown = null;
let nativeLoadingPromise: Promise<unknown> | null = null;
let audioModeConfigured = false;

async function playWeb(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (!webAudio) {
      webAudio = new window.Audio(CHIME_URI);
      webAudio.volume = 0.55;
    }
    webAudio.currentTime = 0;
    await webAudio.play().catch(() => {});
  } catch {
    // ignore
  }
}

async function playNative(): Promise<void> {
  if (nativeSound) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = nativeSound as any;
      await s.setPositionAsync?.(0);
      await s.playAsync?.();
    } catch {
      // ignore
    }
    return;
  }
  if (nativeLoadingPromise) {
    await nativeLoadingPromise;
    return playNative();
  }
  nativeLoadingPromise = (async () => {
    try {
      // Lazy require — only at runtime on iOS/Android
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Audio } = require("expo-av");
      if (!audioModeConfigured) {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
        } catch {
          // ignore
        }
        audioModeConfigured = true;
      }
      const asset = require("../assets/audio/match-chime.wav");
      const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.55 });
      nativeSound = sound;
      return sound;
    } catch {
      return null;
    } finally {
      nativeLoadingPromise = null;
    }
  })();
  await nativeLoadingPromise;
  if (nativeSound) await playNative();
}

export async function playMatchChime(): Promise<void> {
  if (Platform.OS === "web") {
    await playWeb();
  } else {
    await playNative();
  }
}

export async function preloadChime(): Promise<void> {
  if (Platform.OS === "web") {
    if (!webAudio && typeof window !== "undefined") {
      webAudio = new window.Audio(CHIME_URI);
      webAudio.volume = 0.55;
    }
  } else {
    // dispara o loading sem bloquear
    void playNative();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Tons sintéticos pra wrong/celebration — gerados em runtime via Web Audio
// API (web) ou expo-av oscillator não existe; no native a gente toca um
// "pop" curto usando expo-haptics + voz curta de fallback.
// ─────────────────────────────────────────────────────────────────────────

let webAudioCtx: AudioContext | null = null;

function ensureWebCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (webAudioCtx) return webAudioCtx;
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext })
      .AudioContext;
    if (!Ctx) return null;
    webAudioCtx = new Ctx();
    return webAudioCtx;
  } catch {
    return null;
  }
}

// Tom rápido com decay. Volume baixo pra não estourar fone de ouvido.
function tone(freq: number, durationMs: number, type: OscillatorType = "sine", volume = 0.18): void {
  const ctx = ensureWebCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // ignore
  }
}

// "Wrong" — pitch descendente rápido (Sol5 → Mi5).
export async function playWrongChime(): Promise<void> {
  if (Platform.OS === "web") {
    tone(440, 140, "sawtooth", 0.12);
    setTimeout(() => tone(310, 180, "sawtooth", 0.12), 100);
    return;
  }
  // Native fallback: warning haptic (vibração) — som curto via expo-av seria
  // overkill aqui. Já temos chime de acerto via wav.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Haptics = require("expo-haptics");
    await Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // ignore
  }
}

// "Celebration" — três tons ascendentes (Dó-Mi-Sol-Dó) tipo o Mario power up.
export async function playCelebration(): Promise<void> {
  if (Platform.OS === "web") {
    tone(523, 110, "triangle", 0.16);
    setTimeout(() => tone(659, 110, "triangle", 0.16), 100);
    setTimeout(() => tone(784, 110, "triangle", 0.16), 200);
    setTimeout(() => tone(1046, 220, "triangle", 0.18), 300);
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Haptics = require("expo-haptics");
    await Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    // Bate o chime existente — som mais quente que o haptic só.
    await playMatchChime();
  } catch {
    // ignore
  }
}
