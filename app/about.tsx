// Tela "Sobre / Créditos" do DLibras.
//
// É um app de TCC voltado a inclusão digital e ensino de Libras
// (Brazilian Sign Language). Esta tela junta informações institucionais
// — projeto, tecnologias, ODS, equipe, contato e licença.
//
// Wire de navegação: registrada no AppStack em `app/_layout.tsx`.
// O ponto de entrada (botão no perfil) é adicionado pelo usuário depois.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { ThemeColors, useThemeColors } from "@/constants/theme";
import { useT } from "@/lib/i18n";
import { safeBack } from "@/lib/navigation";

const APP_VERSION = "v1.0.0";
const REPO_URL = "https://github.com/ibmecrio/dlibras";
const CONTACT_EMAIL = "aquilesguerretta@gmail.com";

// Stack tecnológica — exibida como chips. Mantemos o array centralizado
// pra ficar fácil de atualizar conforme o projeto evolui.
const TECH_CHIPS: { label: string; group: "frontend" | "backend" | "ai" }[] = [
  { label: "Expo", group: "frontend" },
  { label: "React Native", group: "frontend" },
  { label: "Reanimated", group: "frontend" },
  { label: "Zustand", group: "frontend" },
  { label: "FastAPI", group: "backend" },
  { label: "MediaPipe", group: "backend" },
  { label: "KNN", group: "backend" },
  { label: "Claude", group: "ai" },
  { label: "ElevenLabs", group: "ai" },
  { label: "AssemblyAI", group: "ai" },
];

const SDGS = [
  {
    id: 4,
    title: "Educação de qualidade",
    description:
      "Acesso equitativo a aprendizagem ao longo da vida — incluindo Libras como segunda língua.",
    color: "#C5192D",
  },
  {
    id: 10,
    title: "Redução das desigualdades",
    description:
      "Promover inclusão social independente de deficiência. Libras é direito constitucional desde 2002.",
    color: "#DD1367",
  },
];

const TEAM = [
  {
    name: "Anderson Lima",
    role: "Desenvolvedor",
    initials: "AL",
  },
  {
    name: "Prof. Pedro Pinto",
    role: "Orientador",
    initials: "PP",
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const t = useT();

  async function openExternal(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch {
      // Em web/iOS algumas URLs podem falhar silenciosamente — não há
      // muito o que fazer aqui além de absorver. A UI já mostra o link.
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header com botão de voltar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeBack(router)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={c.neutral.textPrimary}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Sobre o DLibras</Text>
          <Text style={styles.headerSubtitle}>Créditos & informações</Text>
        </View>
        {/* Espaçador pra manter o título centralizado */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: ícone + título + versão + tagline */}
        <View style={styles.hero}>
          <Image
            source={images.mascotLogo}
            style={styles.heroImage}
            resizeMode="contain"
            accessibilityLabel="Logo do DLibras"
          />
          <Text style={styles.heroTitle}>DLibras</Text>
          <Text style={styles.heroVersion}>{APP_VERSION}</Text>
          <Text style={styles.heroTagline}>
            Aprenda Língua Brasileira de Sinais com a câmera do seu celular.
          </Text>
        </View>

        {/* Sobre o projeto */}
        <View style={styles.card}>
          <Text style={styles.kicker}>SOBRE O PROJETO</Text>
          <Text style={styles.cardTitle}>Um TCC com propósito</Text>
          <Text style={styles.paragraph}>
            DLibras é o projeto de conclusão de curso desenvolvido no IBMEC RJ.
            A proposta é unir tecnologia e impacto social: usar visão
            computacional pra reconhecer letras do alfabeto manual da Libras em
            tempo real e oferecer uma jornada de aprendizado leve, no estilo
            Duolingo, mas focada em acessibilidade.
          </Text>
          <Text style={styles.paragraph}>
            O Brasil tem cerca de 10 milhões de pessoas surdas. Libras é língua
            oficial desde 2002, mas ainda falta material acessível pra quem
            quer aprender. DLibras é uma pequena contribuição nessa direção.
          </Text>
        </View>

        {/* Tecnologias */}
        <View style={styles.card}>
          <Text style={styles.kicker}>STACK</Text>
          <Text style={styles.cardTitle}>Tecnologias</Text>
          <Text style={styles.paragraphMuted}>
            Frontend mobile, backend de visão e camada de IA conversacional.
          </Text>
          <View style={styles.chipsRow}>
            {TECH_CHIPS.map((chip) => (
              <View
                key={chip.label}
                style={[styles.chip, styles[`chip_${chip.group}`]]}
              >
                <Text
                  style={[
                    styles.chipText,
                    styles[`chipText_${chip.group}`],
                  ]}
                >
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.divider} />
          <Text style={styles.smallNote}>
            Visão: KNN sobre landmarks de mão extraídos pelo MediaPipe para
            letras estáticas (21 de 26). Letras com movimento (J, Z) usam
            heurística de trajetória.
          </Text>
        </View>

        {/* ODS */}
        <View style={styles.card}>
          <Text style={styles.kicker}>IMPACTO SOCIAL</Text>
          <Text style={styles.cardTitle}>ODS da ONU</Text>
          <Text style={styles.paragraphMuted}>
            DLibras endereça 2 dos 17 Objetivos de Desenvolvimento Sustentável.
          </Text>
          <View style={styles.sdgList}>
            {SDGS.map((sdg) => (
              <View key={sdg.id} style={styles.sdgRow}>
                <View style={[styles.sdgBadge, { backgroundColor: sdg.color }]}>
                  <Text style={styles.sdgNumber}>{sdg.id}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sdgTitle}>{sdg.title}</Text>
                  <Text style={styles.sdgDesc}>{sdg.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Equipe */}
        <View style={styles.card}>
          <Text style={styles.kicker}>EQUIPE</Text>
          <Text style={styles.cardTitle}>Quem fez</Text>
          <View style={styles.teamList}>
            {TEAM.map((member) => (
              <View key={member.name} style={styles.teamRow}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamInitials}>{member.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{member.name}</Text>
                  <Text style={styles.teamRole}>{member.role}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.smallNote}>
            Faculdade: IBMEC RJ — Curso de graduação.
          </Text>
        </View>

        {/* Contato */}
        <View style={styles.card}>
          <Text style={styles.kicker}>CONTATO</Text>
          <Text style={styles.cardTitle}>Fale com a gente</Text>

          <Pressable
            style={styles.contactRow}
            onPress={() => openExternal(`mailto:${CONTACT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={`Enviar email para ${CONTACT_EMAIL}`}
          >
            <View style={styles.contactIcon}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={c.primary.purple}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>{CONTACT_EMAIL}</Text>
            </View>
            <Ionicons
              name="open-outline"
              size={16}
              color={c.neutral.textSecondary}
            />
          </Pressable>

          <Pressable
            style={styles.contactRow}
            onPress={() => openExternal(REPO_URL)}
            accessibilityRole="link"
            accessibilityLabel="Abrir repositório no GitHub"
          >
            <View style={styles.contactIcon}>
              <Ionicons
                name="logo-github"
                size={18}
                color={c.primary.purple}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>GitHub</Text>
              <Text style={styles.contactValue}>{REPO_URL}</Text>
            </View>
            <Ionicons
              name="open-outline"
              size={16}
              color={c.neutral.textSecondary}
            />
          </Pressable>

          <Pressable
            style={styles.primaryButton}
            onPress={() => openExternal(REPO_URL)}
            accessibilityRole="button"
            accessibilityLabel="Abrir repositório do DLibras no GitHub"
          >
            <Ionicons name="logo-github" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>Abrir GitHub</Text>
          </Pressable>
        </View>

        {/* Licença */}
        <View style={styles.card}>
          <Text style={styles.kicker}>LICENÇA</Text>
          <View style={styles.licenseRow}>
            <View style={styles.licenseBadge}>
              <Text style={styles.licenseBadgeText}>MIT</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.licenseTitle}>MIT License</Text>
              <Text style={styles.licenseDesc}>
                Código aberto. Você pode usar, copiar, modificar e distribuir
                — basta manter o aviso de copyright.
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Feito com {Platform.OS === "ios" ? "♥" : "♥"} no Rio de Janeiro
        </Text>
        <Text style={styles.footerSub}>
          © 2026 DLibras · Anderson Lima
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.neutral.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
    },
    headerCenter: { flex: 1, alignItems: "center" },
    headerSpacer: { width: 24 },
    headerTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 16,
      color: c.neutral.textPrimary,
    },
    headerSubtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    scroll: {
      padding: 18,
      paddingTop: 8,
      paddingBottom: 60,
      gap: 16,
    },
    hero: {
      alignItems: "center",
      paddingVertical: 18,
      paddingHorizontal: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
      gap: 6,
    },
    heroImage: {
      width: 96,
      height: 96,
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 28,
      color: c.neutral.textPrimary,
    },
    heroVersion: {
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      color: c.primary.purple,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: c.neutral.surface,
      overflow: "hidden",
    },
    heroTagline: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 19,
      maxWidth: 320,
    },
    card: {
      backgroundColor: c.neutral.elevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.neutral.border,
      padding: 16,
      gap: 8,
    },
    kicker: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 10,
      letterSpacing: 1.4,
      color: c.primary.purple,
    },
    cardTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 16,
      color: c.neutral.textPrimary,
    },
    paragraph: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      lineHeight: 20,
      color: c.neutral.textPrimary,
      marginTop: 4,
    },
    paragraphMuted: {
      fontFamily: "Poppins-Regular",
      fontSize: 12,
      lineHeight: 18,
      color: c.neutral.textSecondary,
      marginTop: 2,
      marginBottom: 4,
    },
    smallNote: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      lineHeight: 16,
      color: c.neutral.textSecondary,
      marginTop: 6,
    },
    divider: {
      height: 1,
      backgroundColor: c.neutral.border,
      marginVertical: 8,
    },
    // Chips de tecnologia agrupados por categoria (visual sutil).
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    chip_frontend: {
      borderColor: c.primary.purple,
      backgroundColor: c.neutral.surface,
    },
    chip_backend: {
      borderColor: c.primary.blue,
      backgroundColor: c.neutral.surface,
    },
    chip_ai: {
      borderColor: c.semantic.success,
      backgroundColor: c.neutral.surface,
    },
    chipText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
    },
    chipText_frontend: { color: c.primary.purple },
    chipText_backend: { color: c.primary.blue },
    chipText_ai: { color: c.semantic.success },
    // ODS
    sdgList: { gap: 8, marginTop: 6 },
    sdgRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 6,
    },
    sdgBadge: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    sdgNumber: {
      fontFamily: "Poppins-Bold",
      fontSize: 20,
      color: "#fff",
    },
    sdgTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    sdgDesc: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    // Equipe
    teamList: { gap: 4, marginTop: 6 },
    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    teamAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    teamInitials: {
      fontFamily: "Poppins-Bold",
      fontSize: 14,
      color: "#fff",
    },
    teamName: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    teamRole: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    // Contato
    contactRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.neutral.border,
    },
    contactIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.neutral.surface,
    },
    contactLabel: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 12,
      color: c.neutral.textPrimary,
    },
    contactValue: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: c.primary.purple,
      marginTop: 12,
    },
    primaryButtonText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: "#fff",
    },
    // Licença
    licenseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 6,
    },
    licenseBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: c.primary.purple,
    },
    licenseBadgeText: {
      fontFamily: "Poppins-Bold",
      fontSize: 12,
      color: "#fff",
      letterSpacing: 0.6,
    },
    licenseTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    licenseDesc: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    // Footer
    footer: {
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      color: c.neutral.textSecondary,
      textAlign: "center",
      marginTop: 10,
    },
    footerSub: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      textAlign: "center",
      marginTop: 2,
    },
  });
}
