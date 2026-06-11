// Error boundary global para proteção contra crashes inesperados.
//
// Class component porque error boundaries do React continuam exigindo
// `componentDidCatch` + `getDerivedStateFromError`. O fallback usa cores
// hardcoded em vez do hook de tema — assim funciona mesmo se o erro veio
// de dentro do próprio sistema de tema/context.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { posthog } from "@/lib/posthog";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      posthog.capture("app_crashed", {
        error: error.message,
        componentStack: info.componentStack ?? null,
      });
    } catch {
      // Se até o PostHog falhar, não derruba o boundary — só engole.
    }
    if (__DEV__) {
      console.error("[ErrorBoundary] crash capturado:", error, info);
    }
  }

  handleReset = (): void => {
    // Reseta o estado interno; o parent re-renderiza a árvore.
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.mascot} accessibilityLabel="mascote triste">
            🐼
          </Text>
          <Text style={styles.title}>Algo deu errado</Text>
          <Text style={styles.subtitle}>
            Tivemos um probleminha por aqui. Pode tentar de novo?
          </Text>
          {this.state.errorMessage ? (
            <Text style={styles.errorDetail} numberOfLines={3}>
              {this.state.errorMessage}
            </Text>
          ) : null}
          <Pressable
            onPress={this.handleReset}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reiniciar app"
          >
            <Text style={styles.buttonText}>Reiniciar app</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

// Cores hardcoded — não dependem do tema para garantir que funcionem
// mesmo se o crash veio do próprio sistema de tema.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 32,
    gap: 16,
  },
  mascot: {
    fontSize: 72,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#001328",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
  },
  errorDetail: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    fontFamily: "monospace",
    marginTop: 4,
  },
  button: {
    marginTop: 16,
    backgroundColor: "#6c4ef5",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ErrorBoundary;
