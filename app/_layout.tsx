import "../global.css";

import { AchievementToast } from "@/components/AchievementToast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ToastProvider } from "@/components/Toast";
import { useIsDark } from "@/constants/theme";
import { posthog } from "@/lib/posthog";
import { useLanguageStore } from "@/store/languageStore";
import { ClerkProvider, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { Stack, useGlobalSearchParams, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PostHogProvider } from "posthog-react-native";
import { useEffect, useRef } from "react";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const clerkEnabled = !!publishableKey;

SplashScreen.preventAutoHideAsync();

function ClerkIdentifier() {
  const { isSignedIn, user, isLoaded } = useUser();
  const { selectedLanguage } = useLanguageStore();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    posthog.identify(user.id, {
      $set_once: { signup_date: new Date().toISOString() },
      $set: { preferred_language: selectedLanguage },
    });
    // user é checado por id na dep array — só re-roda quando troca de user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id, selectedLanguage]);

  return null;
}

function AppStack() {
  const isDark = useIsDark();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lesson/[id]" />
        <Stack.Screen name="libras-demo" />
        <Stack.Screen name="ask-bia" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="about" />
      </Stack>
      {/* Banner global de unlock — fica sobre qualquer screen. */}
      <AchievementToast />
      {/* Banner de offline — aparece no topo de qualquer tela quando sem conexão. */}
      <OfflineBanner />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
  });

  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const previousPathname = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      posthog.screen(pathname, {
        previous_screen: previousPathname.current ?? null,
        ...params,
      });
      previousPathname.current = pathname;
    }
  }, [pathname, params]);

  // Don't block the whole tree while fonts load — show the app with system fonts.
  // (Used to return null here, which painted a blank white screen on web.)

  return (
    <ErrorBoundary>
      <PostHogProvider
        client={posthog}
        autocapture={{
          captureScreens: true,
          captureTouches: true,
          propsToCapture: ["testID"],
          maxElementsCaptured: 20,
        }}
      >
        {clerkEnabled ? (
          <ClerkProvider
            publishableKey={publishableKey!}
            tokenCache={tokenCache}
          >
            <ClerkIdentifier />
            <ToastProvider>
              <AppStack />
            </ToastProvider>
          </ClerkProvider>
        ) : (
          <ToastProvider>
            <AppStack />
          </ToastProvider>
        )}
      </PostHogProvider>
    </ErrorBoundary>
  );
}
