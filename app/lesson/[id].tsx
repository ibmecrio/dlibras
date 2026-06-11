// Router fino entre os 2 modos da lição.
//
// Demo mode: só LibrasCamera detectando sinais — não precisa de nenhuma
// chave externa. Funciona offline-ish (precisa só da Libras Vision API).
//
// Voice mode (modo professor): Bia ensina cada letra via Claude + ElevenLabs
// e responde perguntas via AssemblyAI (push-to-talk). Roda em web e mobile
// via HTTP. Exige EXPO_PUBLIC_ANTHROPIC_API_KEY.
//
// Mesmo com voice mode ligado, lições de motion (unit-3) seguem em demo —
// gravação 1.5s + Bia falando se atrapalham mutuamente.

import { useLocalSearchParams } from "expo-router";

import { LESSONS } from "@/data/lessons";

import DemoLessonScreen from "./_demo-mode";
import VoiceLessonScreen from "./_voice-mode";

const voiceModeEnabled = !!process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

export default function LessonRouter() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = LESSONS.find((l) => l.id === id);

  // Motion lessons (unit-3) sempre usam demo — não tem Bia interferindo na
  // gravação de 1.5s, e o aluno precisa do feedback de movimento puro.
  const isMotion = lesson?.unitId === "libras-unit-3";

  if (voiceModeEnabled && !isMotion) {
    return <VoiceLessonScreen />;
  }
  return <DemoLessonScreen />;
}
