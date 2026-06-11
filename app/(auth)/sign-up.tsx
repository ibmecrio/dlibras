import { useSignUp, useSSO } from "@clerk/expo";
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

WebBrowser.maybeCompleteAuthSession();

// Em web, COOP (Cross-Origin-Opener-Policy) bloqueia o popup de OAuth do
// Clerk — startSSOFlow trava porque não detecta `window.closed`. No celular
// funciona normalmente. Escondemos os botões sociais no web pra não confundir.
const ssoAvailable = Platform.OS !== "web";

type SSOStrategy = "oauth_google" | "oauth_facebook" | "oauth_apple";

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [authError, setAuthError] = useState("");

  const isLoading = fetchStatus === "fetching";
  const canSubmit = !!email && !!password && !isLoading;

  const handleSignUp = async () => {
    setAuthError("");
    posthog.capture("sign_up_submitted", { method: "password" });
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) {
      posthog.capture("$exception", {
        $exception_list: [{ type: error.name ?? "SignUpError", value: error.message }],
        $exception_source: "sign-up",
      });
      setAuthError("Não consegui criar sua conta. Tente de novo.");
      return;
    }
    try {
      await signUp.verifications.sendEmailCode();
      setShowVerification(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Email code send failed";
      posthog.capture("$exception", {
        $exception_list: [
          { type: err instanceof Error ? err.name : "SignUpEmailCodeError", value: message },
        ],
        $exception_source: "sign-up-email-code",
      });
      setAuthError("Não consegui enviar o código de verificação. Tente de novo.");
    }
  };

  const handleVerify = async (code: string) => {
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      posthog.capture("$exception", {
        $exception_list: [{ type: error.name ?? "VerificationError", value: error.message }],
        $exception_source: "sign-up-verification",
      });
      return;
    }
    if (signUp.status === "complete") {
      posthog.capture("sign_up_completed", { method: "password" });
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          router.replace(decorateUrl("/") as Href);
        },
      });
    }
  };

  const handleResend = async () => {
    await signUp.verifications.sendEmailCode();
  };

  const handleSSO = async (strategy: SSOStrategy) => {
    posthog.capture("sign_up_sso_started", { strategy });
    setAuthError("");
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL("/"),
      });
      if (createdSessionId && setActive) {
        posthog.capture("sign_up_completed", { method: strategy });
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown SSO sign-up error";
      console.error("SSO sign-up failed", err);
      posthog.capture("sign_up_sso_failed", { strategy, error: message });
      setAuthError("Não consegui continuar com cadastro social. Tente de novo.");
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

          <Text style={styles.h1}>Criar sua conta</Text>
          <Text style={styles.subtitle}>Comece hoje sua jornada em Libras ✨</Text>

          <View style={styles.mascotWrap}>
            <Image
              source={images.mascotAuth}
              style={styles.mascot}
              resizeMode="contain"
            />
          </View>

          {/* Email */}
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
          {errors.fields.emailAddress ? (
            <Text style={styles.errorText}>{errors.fields.emailAddress.message}</Text>
          ) : null}

          {/* Senha */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={c.neutral.textSecondary}
                secureTextEntry={!showPassword}
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
          {errors.fields.password ? (
            <Text style={styles.errorText}>{errors.fields.password.message}</Text>
          ) : null}
          {errors.global?.[0] ? (
            <Text style={styles.errorText}>{errors.global[0].message}</Text>
          ) : null}
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TouchableOpacity
            style={[styles.cta, !canSubmit && styles.ctaDisabled]}
            activeOpacity={0.85}
            onPress={handleSignUp}
            disabled={!canSubmit}
            testID="sign-up-button"
            accessibilityRole="button"
            accessibilityLabel="Criar conta"
          >
            <Text style={styles.ctaText}>
              {isLoading ? "Criando conta…" : "Criar conta"}
            </Text>
          </TouchableOpacity>

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
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/sign-in")}
              accessibilityRole="link"
              accessibilityLabel="Entrar com conta existente"
            >
              <Text style={styles.footerLink}>Entrar</Text>
            </TouchableOpacity>
          </View>

          {/* Clerk bot-protection: só renderiza no nativo. Em web, o
              Cloudflare Turnstile costuma falhar (erro 600010) quando o
              domínio dev não está configurado no Clerk Dashboard, e
              bloqueia o sign-up. Em dev usamos email-code direto. */}
          {Platform.OS !== "web" && <View nativeID="clerk-captcha" />}
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
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      flexGrow: 1,
    },
    backBtn: {
      width: 40,
      height: 40,
      justifyContent: "center",
      marginTop: 4,
    },
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
    mascotWrap: {
      alignItems: "center",
      marginTop: 20,
      marginBottom: 20,
    },
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
    passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 18,
    },
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
  });
}
