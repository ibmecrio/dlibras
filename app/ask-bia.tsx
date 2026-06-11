// Chat com a Bia — texto + push-to-talk + histórico persistido.
//
// Conversa atual + sidebar com conversas anteriores.
// Estado: Zustand (biaConversations + currentBiaConversationId).

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { claudeChat, type ClaudeMessage } from "@/lib/claude";
import { useT } from "@/lib/i18n";
import { safeBack } from "@/lib/navigation";
import { posthog } from "@/lib/posthog";
import {
  startRecording,
  stopAndTranscribe,
  type RecordingHandle,
} from "@/lib/stt";
import { speak as ttsSpeak, stopSpeaking } from "@/lib/voice";
import {
  type BiaChatMessage,
  useLearningStore,
} from "@/store/learningStore";

const SUGGESTIONS = [
  "Como faço o sinal da letra A?",
  "Qual a diferença entre M e N em Libras?",
  "Quais letras têm movimento em Libras?",
  "Me dá uma dica pra praticar o alfabeto.",
];

export default function AskBiaScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const t = useT();
  const audioEnabled = useLearningStore((s) => s.audioFeedbackEnabled);
  const conversations = useLearningStore((s) => s.biaConversations);
  const currentId = useLearningStore((s) => s.currentBiaConversationId);
  const startNew = useLearningStore((s) => s.startNewBiaConversation);
  const setCurrent = useLearningStore((s) => s.setCurrentBiaConversation);
  const append = useLearningStore((s) => s.appendBiaMessage);
  const deleteConv = useLearningStore((s) => s.deleteBiaConversation);
  const clearAll = useLearningStore((s) => s.clearAllBiaConversations);

  const currentConv = useMemo(
    () => conversations.find((cv) => cv.id === currentId),
    [conversations, currentId],
  );

  // Garante que sempre haja uma conversa ativa. Se não houver, cria.
  useEffect(() => {
    if (!currentId || !currentConv) {
      startNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const recordingRef = useRef<RecordingHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll quando msg nova chega
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(id);
  }, [currentConv?.messages.length]);

  async function handleMicPressIn() {
    if (loading || transcribing) return;
    stopSpeaking();
    setRecording(true);
    posthog.capture("bia_voice_record_start");
    const result = await startRecording();
    if (!result.ok) {
      setRecording(false);
      if (currentId) {
        append(currentId, {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `${result.reason}\n\nNo iPhone: Configurações → Privacidade e Segurança → Microfone → ativa "Expo Go".`,
          createdAt: Date.now(),
        });
      }
      return;
    }
    recordingRef.current = result.recording;
  }

  async function handleMicPressOut() {
    if (!recording || !recordingRef.current) {
      setRecording(false);
      return;
    }
    const rec = recordingRef.current;
    recordingRef.current = null;
    setRecording(false);
    setTranscribing(true);
    const text = await stopAndTranscribe(rec);
    setTranscribing(false);
    if (!text || !text.trim()) {
      if (currentId) {
        append(currentId, {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "Não captei sua voz. Fala mais perto do microfone e tenta de novo.",
          createdAt: Date.now(),
        });
      }
      return;
    }
    void send(text);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content) return;
    const convId = currentId ?? startNew();

    const userMsg: BiaChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      createdAt: Date.now(),
    };
    append(convId, userMsg);
    setInput("");
    setLoading(true);
    posthog.capture("bia_chat_message_sent", { length: content.length });

    // Monta histórico apenas dessa conversa pra mandar pro Claude
    const conv = useLearningStore
      .getState()
      .biaConversations.find((c) => c.id === convId);
    const history: ClaudeMessage[] = (conv?.messages ?? [])
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await claudeChat(history, { maxTokens: 280 });
    setLoading(false);

    if (!response) {
      append(convId, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "Desculpa, não consegui responder agora. Verifica se a ANTHROPIC_API_KEY está configurada.",
        createdAt: Date.now(),
      });
      return;
    }

    append(convId, {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: response.text,
      createdAt: Date.now(),
    });

    if (audioEnabled) {
      void ttsSpeak(response.text);
    }
  }

  function handleNewChat() {
    stopSpeaking();
    startNew();
    setShowHistory(false);
  }

  function handleSelectChat(id: string) {
    stopSpeaking();
    setCurrent(id);
    setShowHistory(false);
  }

  function handleDelete(id: string) {
    deleteConv(id);
    if (id === currentId) {
      // Cria uma nova conversa imediatamente pra não ficar em "limbo".
      startNew();
    }
  }

  const messages = currentConv?.messages ?? [];
  const hasUserMessage = messages.some((m) => m.role === "user");

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              stopSpeaking();
              safeBack(router);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Ionicons name="chevron-back" size={24} color={c.neutral.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Pergunte pra Bia</Text>
            <Text style={styles.headerSubtitle}>
              {conversations.length > 1
                ? `${conversations.length} conversas`
                : "Tira-dúvidas sobre Libras 🦊"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowHistory(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("bia.history")}
          >
            <Ionicons name="time-outline" size={22} color={c.neutral.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Chat */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={[styles.bubble, styles.bubbleBot]}>
              <View style={styles.botHeaderRow}>
                <Text style={styles.botName}>Bia</Text>
              </View>
              <Text style={styles.bubbleTextBot}>
                Oi! Eu sou a Bia 🦊 — {t("bia.empty")}
              </Text>
            </View>
          )}

          {messages.map((m) => (
            <Animated.View
              key={m.id}
              entering={
                m.role === "user"
                  ? FadeInDown.duration(220)
                  : FadeInUp.duration(280)
              }
              style={[
                styles.bubble,
                m.role === "user" ? styles.bubbleUser : styles.bubbleBot,
              ]}
            >
              {m.role === "assistant" && (
                <View style={styles.botHeaderRow}>
                  <Text style={styles.botName}>Bia</Text>
                  <Pressable
                    onPress={() => ttsSpeak(m.content)}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvir resposta da Bia"
                    hitSlop={6}
                  >
                    <Ionicons
                      name="volume-medium-outline"
                      size={16}
                      color={c.neutral.textSecondary}
                    />
                  </Pressable>
                </View>
              )}
              <Text
                style={[
                  styles.bubbleText,
                  m.role === "user" ? styles.bubbleTextUser : styles.bubbleTextBot,
                ]}
              >
                {m.content}
              </Text>
            </Animated.View>
          ))}

          {loading && (
            <View style={[styles.bubble, styles.bubbleBot, { flexDirection: "row", gap: 8 }]}>
              <ActivityIndicator size="small" color={c.primary.purple} />
              <Text style={styles.bubbleTextBot}>{t("bia.thinking")}</Text>
            </View>
          )}

          {!hasUserMessage && !loading && messages.length <= 1 && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsTitle}>Sugestões</Text>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  style={({ pressed }) => [
                    styles.suggestionPill,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="sparkles" size={14} color={c.primary.purple} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composer}>
          <Pressable
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
            disabled={loading || transcribing}
            accessibilityRole="button"
            accessibilityLabel="Falar com a Bia — segure pra gravar"
            style={[
              styles.micBtn,
              recording && styles.micBtnActive,
              (loading || transcribing) && { opacity: 0.5 },
            ]}
          >
            {transcribing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={recording ? "mic" : "mic-outline"}
                size={20}
                color="#fff"
              />
            )}
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={
              recording
                ? "🎤 Gravando… solte pra enviar"
                : transcribing
                  ? "Transcrevendo…"
                  : t("bia.placeholder")
            }
            placeholderTextColor={c.neutral.textSecondary}
            style={styles.composerInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => send(input)}
            blurOnSubmit
            returnKeyType="send"
            editable={!recording && !transcribing}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Enviar pergunta"
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Histórico modal */}
        <Modal
          visible={showHistory}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowHistory(false)}
        >
          <SafeAreaView style={styles.historyRoot}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>{t("bia.history")}</Text>
              <TouchableOpacity
                onPress={() => setShowHistory(false)}
                hitSlop={8}
                accessibilityLabel="Fechar histórico"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={c.neutral.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <Pressable
              onPress={handleNewChat}
              style={({ pressed }) => [
                styles.newChatBtn,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.newChatBtnText}>{t("bia.newChat")}</Text>
            </Pressable>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
              {conversations.length === 0 && (
                <Text style={styles.emptyHistory}>
                  Sem conversas ainda. Comece uma nova!
                </Text>
              )}
              {conversations.map((conv) => {
                const active = conv.id === currentId;
                const preview =
                  conv.messages[conv.messages.length - 1]?.content ?? "";
                return (
                  <Pressable
                    key={conv.id}
                    onPress={() => handleSelectChat(conv.id)}
                    style={({ pressed }) => [
                      styles.historyItem,
                      active && styles.historyItemActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.historyItemTitle,
                          active && { color: "#fff" },
                        ]}
                        numberOfLines={1}
                      >
                        {conv.title}
                      </Text>
                      {preview ? (
                        <Text
                          style={[
                            styles.historyItemPreview,
                            active && { color: "rgba(255,255,255,0.85)" },
                          ]}
                          numberOfLines={1}
                        >
                          {preview}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleDelete(conv.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Excluir conversa"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={active ? "#fff" : c.semantic.error}
                      />
                    </Pressable>
                  </Pressable>
                );
              })}

              {conversations.length > 1 && (
                <Pressable
                  onPress={clearAll}
                  style={styles.clearAllBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.clearAllBtnText}>
                    Apagar todas as conversas
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
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
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      gap: 10,
    },
    bubble: {
      maxWidth: "92%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: c.primary.purple,
    },
    bubbleBot: {
      alignSelf: "flex-start",
      backgroundColor: c.neutral.elevated,
      borderWidth: 1,
      borderColor: c.neutral.border,
    },
    botHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    botName: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.primary.purple,
      letterSpacing: 0.4,
    },
    bubbleText: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      lineHeight: 19,
    },
    bubbleTextUser: { color: "#fff" },
    bubbleTextBot: { color: c.neutral.textPrimary },
    suggestions: {
      marginTop: 10,
      gap: 8,
    },
    suggestionsTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 11,
      color: c.neutral.textSecondary,
      letterSpacing: 0.4,
    },
    suggestionPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
    },
    suggestionText: {
      fontFamily: "Poppins-Medium",
      fontSize: 12,
      color: c.neutral.textPrimary,
      flexShrink: 1,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: c.neutral.border,
      backgroundColor: c.neutral.background,
    },
    composerInput: {
      flex: 1,
      backgroundColor: c.neutral.surface,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontFamily: "Poppins-Regular",
      fontSize: 14,
      color: c.neutral.textPrimary,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary.purple,
      alignItems: "center",
      justifyContent: "center",
    },
    micBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.semantic.success,
      alignItems: "center",
      justifyContent: "center",
    },
    micBtnActive: {
      backgroundColor: c.semantic.error,
      transform: [{ scale: 1.08 }],
    },
    // Histórico
    historyRoot: {
      flex: 1,
      backgroundColor: c.neutral.background,
    },
    historyHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.neutral.border,
    },
    historyTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 18,
      color: c.neutral.textPrimary,
    },
    newChatBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 14,
      paddingVertical: 14,
      backgroundColor: c.primary.purple,
      borderRadius: 14,
    },
    newChatBtnText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
    },
    historyItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
    },
    historyItemActive: {
      backgroundColor: c.primary.purple,
      borderColor: c.primary.purple,
    },
    historyItemTitle: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    historyItemPreview: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 2,
    },
    emptyHistory: {
      textAlign: "center",
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
      padding: 24,
    },
    clearAllBtn: {
      marginTop: 16,
      paddingVertical: 12,
      alignItems: "center",
    },
    clearAllBtnText: {
      color: c.semantic.error,
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
    },
  });
}
