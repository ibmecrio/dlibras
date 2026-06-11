// Indicador de hearts (vidas) no header. Pressionável → abre modal com
// status do regen + opção "Hearts ilimitados" (toggle pra dev/demo).
//
// Visual: 5 corações alinhados, os "vazios" ficam outline cinza, os "cheios"
// vermelhos. Quando hearts < 5 mostra contador de tempo pro próximo regen.

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { useLearningStore } from "@/store/learningStore";

const REGEN_MS = 30 * 60 * 1000;

export function HeartsDisplay() {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const hearts = useLearningStore((s) => s.hearts);
  const updatedAt = useLearningStore((s) => s.heartsUpdatedAt);
  const unlimited = useLearningStore((s) => s.unlimitedHearts);
  const refreshHearts = useLearningStore((s) => s.refreshHearts);
  const refill = useLearningStore((s) => s.refillHearts);
  const toggleUnlimited = useLearningStore((s) => s.toggleUnlimitedHearts);
  const [showModal, setShowModal] = useState(false);

  // Polling a cada 30s pra recalcular hearts (regen é cumulativo, não precisa
  // ser exato — só queremos que apareça eventualmente).
  useEffect(() => {
    refreshHearts();
    const id = setInterval(refreshHearts, 30 * 1000);
    return () => clearInterval(id);
  }, [refreshHearts]);

  const timeToNext = useMemo(() => {
    if (unlimited) return null;
    if (hearts >= 5) return null;
    const elapsed = Date.now() - updatedAt;
    const remaining = REGEN_MS - (elapsed % REGEN_MS);
    const mins = Math.ceil(remaining / 60000);
    return `${mins}m`;
  }, [hearts, updatedAt, unlimited]);

  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={
          unlimited
            ? "Hearts ilimitados ativos"
            : `${hearts} de 5 hearts`
        }
      >
        <Ionicons
          name={unlimited ? "infinite" : hearts > 0 ? "heart" : "heart-outline"}
          size={18}
          color={c.semantic.error}
        />
        <Text style={styles.count}>
          {unlimited ? "∞" : hearts}
        </Text>
      </Pressable>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable
          onPress={() => setShowModal(false)}
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <SafeAreaView style={{ flex: 1 }} />
        </Pressable>
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={styles.sheet}
        >
          <Text style={styles.sheetTitle}>Hearts</Text>
          <View style={styles.heartsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Ionicons
                key={i}
                name={i < hearts || unlimited ? "heart" : "heart-outline"}
                size={32}
                color={i < hearts || unlimited ? c.semantic.error : c.neutral.border}
              />
            ))}
          </View>
          <Text style={styles.sheetBody}>
            {unlimited
              ? "Modo ilimitado ativo — você nunca perde hearts. Bom pra demo/TCC."
              : timeToNext
                ? `Próximo heart em ~${timeToNext}. Regen automático a cada 30 minutos.`
                : "Hearts cheios! Continue praticando."}
          </Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Hearts ilimitados</Text>
              <Text style={styles.toggleCaption}>
                Pra apresentação / não perde quando erra
              </Text>
            </View>
            <Switch
              value={unlimited}
              onValueChange={toggleUnlimited}
              trackColor={{ false: c.neutral.border, true: c.primary.purple }}
              thumbColor="#fff"
            />
          </View>

          {hearts < 5 && !unlimited && (
            <Pressable
              onPress={() => {
                refill();
                setShowModal(false);
              }}
              style={styles.refillBtn}
              accessibilityRole="button"
            >
              <Ionicons name="heart" size={16} color="#fff" />
              <Text style={styles.refillBtnText}>Reabastecer hearts</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setShowModal(false)}
            style={styles.closeBtn}
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>Fechar</Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    count: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 14,
      color: c.semantic.error,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.neutral.elevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 22,
      paddingBottom: 32,
      gap: 12,
    },
    sheetTitle: {
      fontFamily: "Poppins-Bold",
      fontSize: 18,
      color: c.neutral.textPrimary,
      textAlign: "center",
    },
    heartsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginVertical: 4,
    },
    sheetBody: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
      textAlign: "center",
      lineHeight: 18,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: c.neutral.border,
    },
    toggleLabel: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
      color: c.neutral.textPrimary,
    },
    toggleCaption: {
      fontFamily: "Poppins-Regular",
      fontSize: 11,
      color: c.neutral.textSecondary,
      marginTop: 1,
    },
    refillBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.semantic.error,
    },
    refillBtnText: {
      color: "#fff",
      fontFamily: "Poppins-SemiBold",
      fontSize: 13,
    },
    closeBtn: {
      paddingVertical: 12,
      alignItems: "center",
    },
    closeBtnText: {
      color: c.neutral.textSecondary,
      fontFamily: "Poppins-Medium",
      fontSize: 13,
    },
  });
}
