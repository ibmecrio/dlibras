import { useSignIn, useSSO } from "@clerk/expo";
import { AntDesign, FontAwesome, Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { type Href, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SocialButton from "@/components/SocialButton";
import VerificationModal from "@/components/VerificationModal";
import { images } from "@/constants/images";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { safeBack } from "@/lib/navigation";
import { posthog } from "@/lib/posthog";
import { useLearningStore } from "@/store/learningStore";

WebBrowser.maybeCompleteAuthSession();

// SSO habilitado em todas as plataformas. No web usamos redirect flow
// (authenticateWithRedirect) — página inteira navega pro Google e volta,
// sem popup, o que elimina o bug de COOP (window.closed bloqueado).
// No native continua o startSSOFlow com browser session normal.
const ssoAvailable = true;

type SSOStrategy = "oauth_google" | "oauth_facebook" | "oauth_apple";

// Conta dev pré-criada via Clerk Backend API — dados auto-preenchidos só
// em __DEV__. Em produção campos voltam vazios.
// Clerk não permite desabilitar HIBP (pwned passwords) via Backend API —
// só via Dashboard. Por isso usamos uma senha forte que não está em data
// breach. Se quiser usar senha fraca, vá no Dashboard → User & Auth →
// Password → desabilitar "Reject compromised passwords".
const ADMIN_EMAIL_DEV = "andersonodev@gmail.com";
const ADMIN_PASSWORD_DEV = "DLibras@Anderson2026!Seguro";

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const setDevBypassAuth = useLearningStore((s) => s.setDevBypassAuth);

  const [email, setEmail] = useState(__DEV__ ? ADMIN_EMAIL_DEV : "");
  const [password, setPassword] = useState(__DEV__ ? ADMIN_PASSWORD_DEV : "");
  const [showPassword, setShowPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [authError, setAuthError] = useState("");

  const isLoading = fetchStatus === "fetching";
  const canSubmit = !!email && !isLoading;

  // Login via senha — fluxo correto Clerk:
  //   1. signIn.create({ identifier }) — descobre quais fatores são aceitos
  //   2. signIn.password({ password }) — tenta autenticar com a senha
  //   3. se status == complete → finalize
  // Em web bypassa Turnstile porque password sign-in não dispara captcha.
  //
  // O `useFormValues` permite forçar email/senha — bypassa o autofill do
  // browser quando você quer logar como o admin dev mesmo que Chrome esteja
  // sugerindo um user antigo.
  const handleSignInWithPassword = async (
    overrideEmail?: string,
    overridePassword?: string,
  ) => {
    const useEmail = overrideEmail ?? email;
    const usePassword = overridePassword ?? password;
    setAuthError("");
    posthog.capture("sign_in_submitted", { method: "password" });

    const { error: createError } = await signIn.create({ identifier: useEmail });
    if (createError) {
      posthog.capture("$exception", {
        $exception_list: [
          { type: createError.name ?? "SignInCreateError", value: createError.message },
        ],
        $exception_source: "sign-in-create",
      });
      setAuthError(createError.message ?? "Email não encontrado.");
      return;
    }

    const { error: pwError } = await signIn.password({ password: usePassword });
    if (pwError) {
      posthog.capture("$exception", {
        $exception_list: [
          { type: pwError.name ?? "SignInPasswordError", value: pwError.message },
        ],
        $exception_source: "sign-in-password",
      });
      setAuthError(pwError.message ?? "Senha incorreta.");
      return;
    }

    if (signIn.status === "complete") {
      posthog.capture("sign_in_completed", { method: "password" });
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          router.replace(decorateUrl("/") as Href);
        },
      });
    } else {
      setAuthError(
        `Login não concluído (status: ${signIn.status ?? "desconhecido"}). Verifique se o Clerk Dashboard tem 'Password' habilitado como first-factor.`,
      );
    }
  };

  // Botão de bypass-de-autofill: ignora os campos do form e usa os
  // defaults hardcoded. Resolve o caso em que o Chrome injeta credenciais
  // velhas (de um sign-up anterior) no email/senha.
  const handleLoginAsAdminDev = () => {
    setEmail(ADMIN_EMAIL_DEV);
    setPassword(ADMIN_PASSWORD_DEV);
    void handleSignInWithPassword(ADMIN_EMAIL_DEV, ADMIN_PASSWORD_DEV);
  };

  const handleSignIn = async () => {
    // Se tem senha preenchida tenta password primeiro; senão cai no email-code.
    if (password) {
      await handleSignInWithPassword();
      return;
    }
    setAuthError("");
    posthog.capture("sign_in_submitted", { method: "code" });
    const { error: createError } = await signIn.create({ identifier: email });
    if (createError) {
      posthog.capture("$exception", {
        $exception_list: [
          { type: createError.name ?? "SignInCreateError", value: createError.message },
        ],
        $exception_source: "sign-in-create",
      });
      setAuthError("Não consegui iniciar o login. Tente de novo.");
      return;
    }
    const { error } = await signIn.emailCode.sendCode({ emailAddress: email });
    if (error) {
      posthog.capture("$exception", {
        $exception_list: [{ type: error.name ?? "SignInError", value: error.message }],
        $exception_source: "sign-in",
      });
      setAuthError("Não consegui enviar seu código. Tente de novo.");
      return;
    }
    setShowVerification(true);
  };

  const handleVerify = async (code: string) => {
    const { error } = await signIn.emailCode.verifyCode({ code });
    if (error) {
      posthog.capture("$exception", {
        $exception_list: [{ type: error.name ?? "VerificationError", value: error.message }],
        $exception_source: "sign-in-verification",
      });
      return;
    }
    if (signIn.status === "complete") {
      posthog.capture("sign_in_completed", { method: "code" });
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          router.replace(decorateUrl("/") as Href);
        },
      });
    }
  };

  const handleResend = async () => {
    await signIn.emailCode.sendCode({ emailAddress: email });
  };

  const handleSSO = async (strategy: SSOStrategy) => {
    posthog.capture("sign_in_sso_started", { strategy });
    setAuthError("");

    // WEB: redirect flow — a página atual navega pro provedor OAuth e o
    // Clerk volta pra /sso-callback. Sem popup => sem bug de COOP.
    if (Platform.OS === "web") {
      try {
        // O tipo de @clerk/expo (SignInFutureResource) não declara
        // authenticateWithRedirect, mas no WEB o runtime delega pro clerk-js
        // que TEM o método. Cast é seguro porque esse branch só roda no web.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (signIn as any)?.authenticateWithRedirect({
          strategy,
          redirectUrl: "/sso-callback",
          redirectUrlComplete: "/",
        });
        // navegação acontece — código abaixo nunca roda no web
        return;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown SSO redirect error";
        console.error("SSO redirect failed", err);
        posthog.capture("sign_in_sso_failed", { strategy, error: message });
        setAuthError("Não consegui continuar com login social. Tente de novo.");
        return;
      }
    }

    // NATIVE: browser session via startSSOFlow (funciona normal no celular)
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL("/"),
      });
      if (createdSessionId && setActive) {
        posthog.capture("sign_in_completed", { method: strategy });
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown SSO sign-in error";
      console.error("SSO sign-in failed", err);
      posthog.capture("sign_in_sso_failed", { strategy, error: message });
      setAuthError("Não consegui continuar com login social. Tente de novo.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => safeBack(router)}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="chevron-back" size={24} color={c.neutral.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.h1}>Bem-vindo de volta!</Text>
          <Text style={styles.subtitle}>Continue sua jornada em Libras ✨</Text>

          <View style={styles.mascotWrap}>
            <Image source={images.mascotAuth} style={styles.mascot} resizeMode="contain" />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={c.neutral.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
          {errors.fields.identifier ? (
            <Text style={styles.errorText}>{errors.fields.identifier.message}</Text>
          ) : null}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Senha {__DEV__ ? "(dev)" : "(opcional)"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={__DEV__ ? "Admin1234!Senha" : "Use código por email ou senha"}
                placeholderTextColor={c.neutral.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { flex: 1 }]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                <Ionicons
                  name={showPassword ? "eye" : "eye-outline"}
                  size={20}
                  color={c.neutral.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {errors.global?.[0] ? (
            <Text style={styles.errorText}>{errors.global[0].message}</Text>
          ) : null}
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TouchableOpacity
            style={[styles.cta, !canSubmit && styles.ctaDisabled]}
            activeOpacity={0.85}
            onPress={handleSignIn}
            disabled={!canSubmit}
            testID="sign-in-button"
            accessibilityRole="button"
            accessibilityLabel="Entrar"
          >
            <Text style={styles.ctaText}>
              {isLoading
                ? password
                  ? "Entrando…"
                  : "Enviando código…"
                : password
                  ? "Entrar"
                  : "Enviar código por email"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bypassBtn}
            onPress={() => {
              posthog.capture("dev_bypass_auth_activated");
              setDevBypassAuth(true);
              router.replace("/(tabs)");
            }}
            accessibilityRole="button"
            accessibilityLabel="Bypass Clerk e entrar como admin dev"
          >
            <Ionicons name="bug" size={18} color="#1a1300" />
            <Text style={styles.bypassBtnText}>
              Entrar como Admin (pula Clerk)
            </Text>
          </TouchableOpacity>
          <View style={styles.devHint}>
            <Text style={styles.devHintText}>
              💡 Clerk no web trava por causa do Turnstile/client_trust. Use o
              botão amarelo acima pra entrar direto. No celular o login real
              funciona.
            </Text>
          </View>

          {ssoAvailable && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou continue com</Text>
                <View style={styles.dividerLine} />
              </View>

              <SocialButton
                icon={<AntDesign name="google" size={20} color="#DB4437" />}
                label="Continuar com Google"
                onPress={() => handleSSO("oauth_google")}
              />
              <SocialButton
                icon={<FontAwesome name="facebook" size={20} color="#1877F2" />}
                label="Continuar com Facebook"
                onPress={() => handleSSO("oauth_facebook")}
              />
              <SocialButton
                icon={<AntDesign name="apple" size={20} color="#000" />}
                label="Continuar com Apple"
                onPress={() => handleSSO("oauth_apple")}
              />
            </>
          )}

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Não tem uma conta? </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/sign-up")}
              accessibilityRole="link"
              accessibilityLabel="Criar conta"
            >
              <Text style={styles.footerLink}>Criar conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <VerificationModal
        visible={showVerification}
        email={email}
        onClose={() => setShowVerification(false)}
        onVerify={handleVerify}
        onResend={handleResend}
        error={errors.fields.code?.message || errors.global?.[0]?.message || ""}
      />
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 },
    backBtn: { width: 40, height: 40, justifyContent: "center", marginTop: 4 },
    h1: {
      fontFamily: "Poppins-Bold",
      fontSize: 28,
      lineHeight: 34,
      color: c.neutral.textPrimary,
      marginTop: 8,
    },
    subtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 14,
      color: c.neutral.textSecondary,
      marginTop: 6,
    },
    mascotWrap: { alignItems: "center", marginTop: 20, marginBottom: 20 },
    mascot: { width: 140, height: 140 },
    inputContainer: {
      borderWidth: 1,
      borderColor: c.neutral.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 10,
      marginBottom: 10,
      backgroundColor: c.neutral.elevated,
    },
    inputLabel: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginBottom: 2,
    },
    input: {
      fontFamily: "Poppins-Regular",
      fontSize: 14,
      color: c.neutral.textPrimary,
      padding: 0,
    },
    errorText: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.semantic.error,
      marginTop: -4,
      marginBottom: 6,
    },
    cta: {
      backgroundColor: c.primary.purple,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { color: "#fff", fontFamily: "Poppins-SemiBold", fontSize: 15 },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginVertical: 20,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.neutral.border },
    dividerText: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      color: c.neutral.textSecondary,
    },
    footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
    footerText: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
    },
    footerLink: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.primary.purple,
    },
    devHint: {
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    devHintText: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
    },
    bypassBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.semantic.warning,
      borderRadius: 14,
      paddingVertical: 14,
      marginTop: 14,
    },
    bypassBtnText: {
      color: "#1a1300",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
  });
}
