import { useAuth } from "@/lib/auth";
import { Redirect, useRouter } from "expo-router";
import { useEffect } from "react";

import { BootSplash } from "@/components/BootSplash";

const clerkEnabled = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function Index() {
  if (!clerkEnabled) {
    return <DemoBoot />;
  }
  return <ClerkGate />;
}

// In demo mode the splash + a client-side router.replace avoids the white
// flash that <Redirect> produces during SSR (which renders nothing).
function DemoBoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(tabs)");
  }, [router]);
  return <BootSplash subtitle="Carregando seu mapa de lições…" />;
}

function ClerkGate() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <BootSplash subtitle="Verificando seu acesso…" />;
  }

  if (!isSignedIn) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
