import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { ThemeColors, useThemeColors } from "@/constants/theme";

interface Props {
  visible: boolean;
  email: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  error?: string;
}

export default function VerificationModal({
  visible,
  email,
  onClose,
  onVerify,
  onResend,
  error,
}: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setCode("");
      setIsSubmitting(false);
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  useEffect(() => {
    if (error) {
      setCode("");
      setIsSubmitting(false);
    }
  }, [error]);

  const handleCodeChange = async (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !isSubmitting) {
      setIsSubmitting(true);
      await onVerify(digits);
    }
  };

  const handleResend = async () => {
    setCode("");
    await onResend();
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Fechar verificação"
          >
            <Ionicons name="close" size={22} color={c.neutral.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.title}>Confira seu email</Text>
          <Text style={styles.subtitle}>
            Enviamos um código de 6 dígitos pra{"\n"}
            <Text style={styles.emailText}>{email || "seu email"}</Text>
          </Text>

          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            style={styles.boxesRow}
            accessibilityRole="text"
            accessibilityLabel="Digite o código de 6 dígitos"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  code[i]
                    ? styles.boxFilled
                    : i === code.length
                      ? styles.boxActive
                      : styles.boxEmpty,
                ]}
              >
                <Text style={styles.boxText}>{code[i] ?? ""}</Text>
              </View>
            ))}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.hiddenInput}
            editable={!isSubmitting}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={handleResend}
            accessibilityRole="button"
            accessibilityLabel="Reenviar código"
          >
            <Text style={styles.resendText}>
              Não recebeu?{" "}
              <Text style={styles.resendLink}>Reenviar</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      backgroundColor: c.neutral.elevated,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 40,
      alignItems: "center",
    },
    closeBtn: { position: "absolute", top: 16, right: 20, padding: 4 },
    title: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 22,
      color: c.neutral.textPrimary,
      marginBottom: 8,
      textAlign: "center",
    },
    subtitle: {
      fontFamily: "Poppins-Regular",
      fontSize: 14,
      color: c.neutral.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 32,
    },
    emailText: { fontFamily: "Poppins-Medium", color: c.neutral.textPrimary },
    boxesRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    box: {
      width: 48,
      height: 56,
      borderWidth: 1.5,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    boxEmpty: {
      borderColor: c.neutral.border,
      backgroundColor: c.neutral.elevated,
    },
    boxActive: {
      borderColor: c.primary.purple,
      backgroundColor: c.neutral.elevated,
    },
    boxFilled: {
      borderColor: c.primary.purple,
      backgroundColor:
        c.neutral.background === "#ffffff" ? "#f5f2ff" : c.neutral.surface,
    },
    boxText: {
      fontFamily: "Poppins-SemiBold",
      fontSize: 20,
      color: c.neutral.textPrimary,
    },
    hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
    errorText: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.semantic.error,
      textAlign: "center",
      marginBottom: 8,
    },
    resendBtn: { paddingVertical: 4, marginTop: 8 },
    resendText: {
      fontFamily: "Poppins-Regular",
      fontSize: 13,
      color: c.neutral.textSecondary,
    },
    resendLink: { fontFamily: "Poppins-Medium", color: c.primary.purple },
  });
}
