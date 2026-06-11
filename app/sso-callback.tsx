// Callback do OAuth redirect flow (web).
//
// Quando o user clica "Continuar com Google" no web, o Clerk navega a página
// inteira pro Google e volta aqui com os tokens na URL. handleRedirectCallback
// troca os tokens por uma sessão ativa e seguimos pra home.
//
// Só relevante no web — no native o startSSOFlow cuida de tudo via browser
// session e nunca passa por essa rota.

import { useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useThemeColors } from "@/constants/theme";

export default function SSOCallbackScreen() {
  const { handleRedirectCallback } = useClerk();
  const router = useRouter();
  const c = useThemeColors();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    handleRedirectCallback({
      signInForceRedirectUrl: "/",
      signUpForceRedirectUrl: "/",
    })
      .then(() => {
        router.replace("/" as never);
      })
      .catch((err) => {
        console.warn("[sso-callback] failed", err);
        router.replace("/(auth)/sign-in" as never);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: c.neutral.background }]}>
      <ActivityIndicator size="large" color={c.primary.purple} />
      <Text style={[styles.text, { color: c.neutral.textSecondary }]}>
        Finalizando login…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  text: {
    fontFamily: "Poppins-Medium",
    fontSize: 14,
  },
});
