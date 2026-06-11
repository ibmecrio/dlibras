// i18n leve sem dep externa. Map de strings + useT() hook.
//
// Como usar:
//   const t = useT();
//   <Text>{t("home.greeting", { name: "Anderson" })}</Text>
//
// Por que rolar próprio:
//   - i18next + react-i18next custam ~80kb no bundle só pra um app com
//     ~150 strings totais
//   - precisamos só de: lookup por chave, interpolação simples, idioma
//     persistido no Zustand store
//   - Libras já é a "língua" do conteúdo — pt-BR/en/es é só pra UI chrome

import { useLearningStore } from "@/store/learningStore";

export type Locale = "pt-BR" | "en" | "es";
export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

type Dict = Record<string, string>;
type Locales = Record<Locale, Dict>;

// Strings — chave em dot-notation. Adiciona novas conforme o usuário pedir.
// Mantém pt-BR como fonte da verdade; en/es são traduções.
const dict: Locales = {
  "pt-BR": {
    "common.cancel": "Cancelar",
    "common.confirm": "Confirmar",
    "common.close": "Fechar",
    "common.save": "Salvar",
    "common.back": "Voltar",
    "common.loading": "Carregando…",
    "common.offline": "Sem conexão",
    "common.online": "Online",

    "tab.home": "Início",
    "tab.learn": "Aprender",
    "tab.teacher": "Professor IA",
    "tab.glossary": "Glossário",
    "tab.profile": "Perfil",

    "home.greeting": "Olá, {name}! 👋",
    "home.dailyGoal": "Meta diária",
    "home.continueLearning": "Continue aprendendo",
    "home.streak.title": "Sequência de {n} {unit}",
    "home.streak.day": "dia",
    "home.streak.days": "dias",
    "home.streak.start": "Você ainda não começou uma sequência. Complete uma lição hoje pra iniciar!",
    "home.streak.keep": "Você está há {n} {unit} mantendo o ritmo! Volta amanhã pra somar +1.",
    "home.streak.cta": "Bora praticar",
    "home.notif.title": "Notificações",
    "home.notif.body": "Notificações push de lembrete diário disponíveis nos ajustes.",

    "profile.signOut": "Sair da conta",
    "profile.signOut.confirm": "Sair da conta?",
    "profile.signOut.body": "Você precisará entrar de novo na próxima vez.",
    "profile.reset": "Resetar progresso (demo)",
    "profile.reset.confirm": "Resetar todo o progresso?",
    "profile.reset.body": "Isso apaga XP, sequência, lições concluídas e conquistas. Não dá pra desfazer.",
    "profile.install.title": "Instalar como app (PWA)",
    "profile.install.installed": "Instalado como app",
    "profile.language": "Idioma",
    "profile.notifications": "Lembrete diário",
    "profile.notifications.caption": "Receba um lembrete pra praticar",
    "profile.audio": "Som de acerto",
    "profile.audio.caption": "Toca um chime curto quando a letra é detectada",

    "lesson.complete": "Lição completa!",
    "lesson.xpGained": "+{xp} XP — voltando ao mapa…",
    "lesson.target": "Mostre a letra",
    "lesson.detected": "Detectado",

    "bia.thinking": "Bia está pensando…",
    "bia.placeholder": "Pergunta sobre Libras ou segure o mic 🎤",
    "bia.newChat": "Nova conversa",
    "bia.history": "Conversas anteriores",
    "bia.empty": "Tire dúvidas sobre Libras comigo. Pergunte sobre letras, sinais ou qualquer coisa.",
  },
  en: {
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.close": "Close",
    "common.save": "Save",
    "common.back": "Back",
    "common.loading": "Loading…",
    "common.offline": "Offline",
    "common.online": "Online",

    "tab.home": "Home",
    "tab.learn": "Learn",
    "tab.teacher": "AI Teacher",
    "tab.glossary": "Glossary",
    "tab.profile": "Profile",

    "home.greeting": "Hi, {name}! 👋",
    "home.dailyGoal": "Daily goal",
    "home.continueLearning": "Continue learning",
    "home.streak.title": "{n}-{unit} streak",
    "home.streak.day": "day",
    "home.streak.days": "days",
    "home.streak.start": "You haven't started a streak yet. Complete a lesson today to start!",
    "home.streak.keep": "You're {n} {unit} into your streak! Come back tomorrow for +1.",
    "home.streak.cta": "Let's practice",
    "home.notif.title": "Notifications",
    "home.notif.body": "Daily reminder push notifications are available in settings.",

    "profile.signOut": "Sign out",
    "profile.signOut.confirm": "Sign out?",
    "profile.signOut.body": "You'll need to sign in again next time.",
    "profile.reset": "Reset progress (demo)",
    "profile.reset.confirm": "Reset all progress?",
    "profile.reset.body": "This erases XP, streak, completed lessons and achievements. Can't undo.",
    "profile.install.title": "Install as app (PWA)",
    "profile.install.installed": "Installed",
    "profile.language": "Language",
    "profile.notifications": "Daily reminder",
    "profile.notifications.caption": "Get a reminder to practice",
    "profile.audio": "Match chime",
    "profile.audio.caption": "Plays a short chime when a letter is detected",

    "lesson.complete": "Lesson complete!",
    "lesson.xpGained": "+{xp} XP — back to map…",
    "lesson.target": "Show the letter",
    "lesson.detected": "Detected",

    "bia.thinking": "Bia is thinking…",
    "bia.placeholder": "Ask about Libras or hold the mic 🎤",
    "bia.newChat": "New chat",
    "bia.history": "Past chats",
    "bia.empty": "Ask me anything about Libras. Letters, signs, anything.",
  },
  es: {
    "common.cancel": "Cancelar",
    "common.confirm": "Confirmar",
    "common.close": "Cerrar",
    "common.save": "Guardar",
    "common.back": "Volver",
    "common.loading": "Cargando…",
    "common.offline": "Sin conexión",
    "common.online": "En línea",

    "tab.home": "Inicio",
    "tab.learn": "Aprender",
    "tab.teacher": "Profe IA",
    "tab.glossary": "Glosario",
    "tab.profile": "Perfil",

    "home.greeting": "¡Hola, {name}! 👋",
    "home.dailyGoal": "Meta diaria",
    "home.continueLearning": "Continúa aprendiendo",
    "home.streak.title": "Racha de {n} {unit}",
    "home.streak.day": "día",
    "home.streak.days": "días",
    "home.streak.start": "Aún no tienes racha. ¡Completa una lección hoy para empezar!",
    "home.streak.keep": "¡Llevas {n} {unit} de racha! Vuelve mañana para +1.",
    "home.streak.cta": "Vamos a practicar",
    "home.notif.title": "Notificaciones",
    "home.notif.body": "Las notificaciones push de recordatorio diario están en ajustes.",

    "profile.signOut": "Cerrar sesión",
    "profile.signOut.confirm": "¿Cerrar sesión?",
    "profile.signOut.body": "Tendrás que volver a entrar la próxima vez.",
    "profile.reset": "Reiniciar progreso (demo)",
    "profile.reset.confirm": "¿Reiniciar todo el progreso?",
    "profile.reset.body": "Esto borra XP, racha, lecciones y logros. No se puede deshacer.",
    "profile.install.title": "Instalar como app (PWA)",
    "profile.install.installed": "Instalada",
    "profile.language": "Idioma",
    "profile.notifications": "Recordatorio diario",
    "profile.notifications.caption": "Recibe un recordatorio para practicar",
    "profile.audio": "Sonido de acierto",
    "profile.audio.caption": "Suena un chime corto cuando se detecta una letra",

    "lesson.complete": "¡Lección completa!",
    "lesson.xpGained": "+{xp} XP — volviendo al mapa…",
    "lesson.target": "Muestra la letra",
    "lesson.detected": "Detectado",

    "bia.thinking": "Bia está pensando…",
    "bia.placeholder": "Pregunta sobre Libras o mantén el mic 🎤",
    "bia.newChat": "Nuevo chat",
    "bia.history": "Conversaciones",
    "bia.empty": "Pregúntame sobre Libras. Letras, signos, lo que quieras.",
  },
};

function interp(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// Lookup com fallback pra pt-BR e depois pra chave em si.
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const localeDict = dict[locale];
  const fromLocale = localeDict?.[key];
  const fromPt = dict["pt-BR"][key];
  return interp(fromLocale ?? fromPt ?? key, vars);
}

export function useLocale(): Locale {
  return useLearningStore((s) => s.locale);
}

export type TFunction = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

export function useT(): TFunction {
  const locale = useLocale();
  return (key, vars) => translate(locale, key, vars);
}
