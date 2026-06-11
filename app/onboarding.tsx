import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { posthog } from "@/lib/posthog";
import { cardShadow } from "@/lib/styles";

export default function OnboardingScreen() {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.logoRow}>
          <Image source={images.mascotLogo} style={styles.logo} />
          <Text style={styles.brand}>DLibras</Text>
        </View>

        {/* Hero heading */}
        <Text style={styles.h1}>
          {"Aprenda Libras\n"}
          <Text style={styles.h1Accent}>com a câmera.</Text>
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Faça o sinal, a câmera reconhece e o professor de IA te guia letra
          por letra.
        </Text>

        {/* Mascot illustration with bubbles */}
        <View style={styles.heroWrap}>
          <Image
            source={images.mascotWelcome}
            style={styles.hero}
            resizeMode="contain"
          />

          <View style={[styles.bubble, styles.bubbleA]}>
            <Text style={styles.bubbleText}>🤚 A</Text>
          </View>

          <View style={[styles.bubble, styles.bubbleB]}>
            <Text style={styles.bubbleText}>✋ B</Text>
          </View>

          <View style={[styles.bubble, styles.bubbleY]}>
            <Text style={[styles.bubbleText, { color: c.semantic.error }]}>
              🤟 Y
            </Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          testID="get-started-button"
          accessibilityRole="button"
          accessibilityLabel="Começar"
          onPress={() => {
            posthog.capture("onboarding_get_started_tapped");
            router.push("/(auth)/sign-up");
          }}
        >
          <Text style={styles.ctaText}>Começar</Text>
          <Ionicons
            name="chevron-forward"
            size={22}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.neutral.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
    },
    logo: {
      width: 40,
      height: 40,
    },
    brand: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 20,
      color: c.neutral.textPrimary,
    },
    h1: {
      fontFamily: "Poppins-Bold",
      fontSize: 32,
      lineHeight: 38,
      color: c.neutral.textPrimary,
      marginTop: 28,
    },
    h1Accent: {
      color: c.primary.purple,
    },
    subtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 14,
      lineHeight: 22,
      color: c.neutral.textSecondary,
      marginTop: 10,
    },
    heroWrap: {
      flex: 1,
      marginTop: 12,
      minHeight: 240,
      position: "relative",
    },
    hero: {
      flex: 1,
      width: "100%",
    },
    bubble: {
      position: "absolute",
      backgroundColor: c.neutral.elevated,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: c.neutral.border,
      ...cardShadow({ opacity: 0.08, radius: 10, y: 2, elevation: 4 }),
    },
    bubbleA: {
      left: 0,
      top: "35%",
    },
    bubbleB: {
      right: 0,
      top: "10%",
    },
    bubbleY: {
      right: 20,
      top: "60%",
    },
    bubbleText: {
      fontFamily: "Poppins-Medium",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary.purple,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 16,
      marginBottom: 24,
    },
    ctaText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 16,
      color: "#fff",
    },
  });
}
