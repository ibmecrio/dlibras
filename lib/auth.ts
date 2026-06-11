// Auth wrapper que lida com 3 modos:
// 1. Demo (sem chave Clerk): retorna fake user direto.
// 2. Clerk normal: delega pros hooks @clerk/expo.
// 3. Clerk + devBypassAuth ativo: retorna fake user mesmo com Clerk —
//    usado quando Turnstile/client_trust travam o login no web em dev.

import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from "@clerk/expo";

import { useLearningStore } from "@/store/learningStore";

const clerkEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const DEMO_USER = {
  id: "demo-user",
  firstName: "Anderson",
  lastName: "DLibras",
  fullName: "Anderson DLibras",
  imageUrl: "",
  primaryEmailAddress: { emailAddress: "andersonodev@gmail.com" },
} as const;

const DEMO_AUTH = {
  isSignedIn: true,
  isLoaded: true,
  userId: DEMO_USER.id,
  sessionId: "demo-session",
  signOut: async () => {
    useLearningStore.getState().setDevBypassAuth(false);
  },
  getToken: async () => null,
};

const DEMO_USER_RESULT = {
  isSignedIn: true,
  isLoaded: true,
  user: DEMO_USER,
};

// Sempre chamamos os 2 hooks pra respeitar Rules of Hooks. O fake/real
// é escolhido com base no estado (clerkEnabled + devBypassAuth).
// Em demo mode (sem ClerkProvider) os hooks Clerk são swapped no module load.

function useAuthSmart() {
  const bypass = useLearningStore((s) => s.devBypassAuth);
  // Em demo (sem Clerk), useClerkAuth crasharia — nesse caso já retornamos
  // o fake na função `useAuth` exportada antes mesmo desse hook rodar.
  const clerk = useClerkAuth();
  if (bypass) return DEMO_AUTH as unknown as ReturnType<typeof useClerkAuth>;
  return clerk;
}

function useUserSmart() {
  const bypass = useLearningStore((s) => s.devBypassAuth);
  const clerk = useClerkUser();
  if (bypass)
    return DEMO_USER_RESULT as unknown as ReturnType<typeof useClerkUser>;
  return clerk;
}

function useAuthDemo() {
  return DEMO_AUTH;
}

function useUserDemo() {
  return DEMO_USER_RESULT;
}

// Selecionado uma vez no module load — se Clerk está desabilitado, fake.
// Se Clerk está habilitado, smart-hook respeita o bypass flag.
export const useAuth: typeof useClerkAuth = (
  clerkEnabled
    ? useAuthSmart
    : (useAuthDemo as unknown as typeof useClerkAuth)
);

export const useUser: typeof useClerkUser = (
  clerkEnabled
    ? useUserSmart
    : (useUserDemo as unknown as typeof useClerkUser)
);
