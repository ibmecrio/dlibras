// Modal pra editar nome + avatar emoji. Persiste no store.

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { cardShadow } from "@/lib/styles";
import { useLearningStore } from "@/store/learningStore";

const EMOJI_CHOICES = [
  "🦊","🐱","🐶","🐼","🦁","🐯","🐰","🐻","🐨","🐸",
  "🐵","🦝","🐺","🦄","🐲","🐧","🦉","🦋","🐢","🐬",
  "👧","👦","🧒","👩","👨","🧑","👩‍🎓","👨‍🎓","🧑‍🎓","🤓",
];

interface Props {
  visible: boolean;
  initialName: string;
  initialEmoji: string;
  onClose: () => void;
}

export function EditProfileModal({
  visible,
  initialName,
  initialEmoji,
  onClose,
}: Props) {
  const c = useThemeColors();
  const styles = createStyles(c);
  const setDisplayName = useLearningStore((s) => s.setDisplayName);
  const setAvatarEmoji = useLearningStore((s) => s.setAvatarEmoji);
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setEmoji(initialEmoji);
    }
  }, [visible, initialName, initialEmoji]);

  function save() {
    setDisplayName(name.trim() || null);
    setAvatarEmoji(emoji);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          onPress={onClose}
        >
          <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop} />
        </Pressable>

        <Animated.View entering={FadeInDown.duration(280)} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Editar perfil</Text>

          {/* Avatar preview */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigEmoji}>{emoji}</Text>
            </View>
          </View>

          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            placeholderTextColor={c.neutral.textSecondary}
            style={styles.input}
            maxLength={32}
            accessibilityLabel="Editar nome"
          />

          <Text style={styles.label}>Avatar</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
          >
            {EMOJI_CHOICES.map((e) => {
              const active = e === emoji;
              return (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={({ pressed }) => [
                    styles.emojiOption,
                    active && styles.emojiOptionActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Avatar ${e}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={save}
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Ionicons name="save-outline" size={16} color="#fff" />
              <Text style={styles.btnPrimaryText}>Salvar</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: {
      backgroundColor: c.neutral.elevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 28,
      gap: 8,
      maxWidth: 600,
      alignSelf: "center",
      width: "100%",
      ...cardShadow({ opacity: 0.16, radius: 16, y: -4, elevation: 12 }),
    },
    handle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.neutral.border,
    },
    title: {
      fontFamily: "Poppins-Bold",
      fontSize: 18,
      color: c.neutral.textPrimary,
      textAlign: "center",
      marginVertical: 6,
    },
    avatarWrap: { alignItems: "center", marginBottom: 4 },
    avatarBig: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.neutral.surface,
      borderWidth: 2,
      borderColor: c.primary.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarBigEmoji: { fontSize: 56 },
    label: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.neutral.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 6,
    },
    input: {
      backgroundColor: c.neutral.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: "Poppins-Regular",
      fontSize: 15,
      color: c.neutral.textPrimary,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    emojiOption: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.neutral.surface,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    emojiOptionActive: {
      backgroundColor: c.primary.purple,
      borderColor: c.primary.purple,
    },
    emojiText: { fontSize: 24 },
    actions: { flexDirection: "row", gap: 10, marginTop: 12 },
    btnGhost: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.neutral.border,
      alignItems: "center",
      justifyContent: "center",
    },
    btnGhostText: {
      color: c.neutral.textPrimary,
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
    },
    btnPrimary: {
      flex: 1.2,
      flexDirection: "row",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.primary.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
    },
  });
}
