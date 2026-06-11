import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth";

const clerkEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function AuthLayout() {
  // Em demo mode não existe ClerkProvider — qualquer hook do Clerk crasharia.
  // O wrapper @/lib/auth retorna um usuário fake "Estudante DLibras", então
  // ler isSignedIn é seguro nas duas modalidades.
  const { isSignedIn, isLoaded } = useAuth();

  // Sem Clerk, o fluxo de sign-in/sign-up não faz sentido — manda pro app.
  if (!clerkEnabled) {
    return <Redirect href="/(tabs)" />;
  }

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
