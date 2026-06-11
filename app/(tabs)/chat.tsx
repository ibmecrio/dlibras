import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { speak as ttsSpeak } from "@/lib/voice";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeColors, useThemeColors } from "@/constants/theme";
import { LESSONS } from "@/data/lessons";
import { UNITS } from "@/data/units";
import { posthog } from "@/lib/posthog";
import { useLearningStore } from "@/store/learningStore";

// Tira duplicatas mas preserva ordem da primeira aparição — letras A, B, C
// devem aparecer antes de D, E, F mesmo que F apareça em alguma lição
// posterior só por causa de "PAI".
type Entry = {
  word: string;
  translation: string;
  pronunciation: string;
  emoji?: string;
  unitId: string;
};

function buildGlossary(): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const lesson of LESSONS) {
    for (const v of lesson.vocabulary) {
      const key = v.word.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        word: v.word,
        translation: v.translation,
        pronunciation: v.pronunciation,
        emoji: v.emoji,
        unitId: lesson.unitId,
      });
    }
  }
  return out;
}

const GLOSSARY = buildGlossary();

export default function ChatScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const favorites = useLearningStore((s) => s.favoriteLetters);
  const toggleFavorite = useLearningStore((s) => s.toggleFavoriteLetter);

  useEffect(() => {
    posthog.capture("glossary_viewed", { entry_count: GLOSSARY.length });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = GLOSSARY;
    if (unitFilter) result = result.filter((e) => e.unitId === unitFilter);
    if (favOnly)
      result = result.filter((e) =>
        favorites.includes(e.word.toUpperCase()),
      );
    if (q)
      result = result.filter(
        (e) =>
          e.word.toLowerCase().includes(q) ||
          e.translation.toLowerCase().includes(q) ||
          e.pronunciation.toLowerCase().includes(q),
      );
    // Favoritas no topo
    return [...result].sort((a, b) => {
      const aFav = favorites.includes(a.word.toUpperCase()) ? 1 : 0;
      const bFav = favorites.includes(b.word.toUpperCase()) ? 1 : 0;
      return bFav - aFav;
    });
  }, [query, unitFilter, favOnly, favorites]);

  function speak(entry: Entry) {
    posthog.capture("glossary_entry_spoken", { word: entry.word });
    try {
      void ttsSpeak(entry.word);
    } catch {}
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.neutral.background }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Glossário</Text>
        <Text style={styles.subtitle}>
          Como cada sinal é feito, em Libras. Toque pra ouvir a letra.
        </Text>

        {/* Atalho pra chat com IA (Bia via Claude) */}
        <Pressable
          onPress={() => router.push("/ask-bia" as never)}
          style={styles.biaCard}
          accessibilityRole="button"
          accessibilityLabel="Abrir chat com Bia"
        >
          <View style={styles.biaCardIcon}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.biaCardTitle}>Pergunte pra Bia 🦊</Text>
            <Text style={styles.biaCardSubtitle}>
              Tira-dúvidas em IA + resposta falada (Claude + voz)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
        {/* Filter chips: unidades + ⭐ favoritas */}
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setUnitFilter(null)}
            style={[styles.filterChip, !unitFilter && styles.filterChipActive]}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.filterChipText,
                !unitFilter && styles.filterChipTextActive,
              ]}
            >
              Tudo
            </Text>
          </Pressable>
          {UNITS.map((u) => {
            const active = unitFilter === u.id;
            return (
              <Pressable
                key={u.id}
                onPress={() => setUnitFilter(active ? null : u.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {u.title}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setFavOnly((v) => !v)}
            style={[styles.filterChip, favOnly && styles.filterChipActive]}
            accessibilityRole="button"
            accessibilityLabel="Mostrar só favoritas"
          >
            <Ionicons
              name={favOnly ? "star" : "star-outline"}
              size={12}
              color={favOnly ? "#fff" : c.semantic.warning}
            />
            <Text
              style={[
                styles.filterChipText,
                favOnly && styles.filterChipTextActive,
              ]}
            >
              {favorites.length > 0 ? favorites.length : ""}
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={c.neutral.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar letra ou descrição"
            placeholderTextColor={c.neutral.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
              accessibilityLabel="Limpar busca"
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={c.neutral.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.word}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="search-outline"
              size={48}
              color={c.neutral.textSecondary}
              style={{ opacity: 0.5 }}
            />
            <Text style={styles.emptyText}>
              Nada encontrado pra &ldquo;{query}&rdquo;.
            </Text>
            <Text style={[styles.emptyText, { fontSize: 12, opacity: 0.7 }]}>
              Tente buscar por uma letra (A, B, C…) ou palavra do gesto.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            // Cap em 12 itens pra cascata não ficar lenta em listas grandes —
            // 12*40 = 480ms é o limite de "fluidez percebida".
            entering={FadeInDown.delay(Math.min(index, 12) * 40).duration(320)}
          >
            <Pressable
              onPress={() => speak(item)}
              accessibilityRole="button"
              accessibilityLabel={`Ouvir letra ${item.word.toUpperCase()}: ${item.pronunciation}`}
              style={({ pressed }) => [
                styles.entryRow,
                pressed && styles.entryRowPressed,
              ]}
            >
              <View style={styles.letterBadge}>
                <Text style={styles.letterBadgeText}>
                  {item.emoji ?? item.word.toUpperCase().slice(0, 1)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryWord}>{item.word.toUpperCase()}</Text>
                <Text style={styles.entryPronunciation} numberOfLines={2}>
                  {item.pronunciation}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleFavorite(item.word)}
                hitSlop={6}
                style={styles.starBtn}
                accessibilityRole="button"
                accessibilityLabel={
                  favorites.includes(item.word.toUpperCase())
                    ? "Desfavoritar"
                    : "Favoritar"
                }
              >
                <Ionicons
                  name={
                    favorites.includes(item.word.toUpperCase())
                      ? "star"
                      : "star-outline"
                  }
                  size={18}
                  color={c.semantic.warning}
                />
              </Pressable>
              <Pressable
                onPress={() => router.push("/libras-demo" as never)}
                hitSlop={6}
                style={styles.starBtn}
                accessibilityRole="button"
                accessibilityLabel="Praticar essa letra na câmera"
              >
                <Ionicons
                  name="videocam-outline"
                  size={18}
                  color={c.primary.purple}
                />
              </Pressable>
            </Pressable>
          </Animated.View>
        )}
      />
    </SafeAreaView>
  );
}

function createStyles(c: ThemeColors) {
  const isDark = c.neutral.background !== "#ffffff";
  return StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  title: {
    fontFamily: "Poppins-Bold",
    fontSize: 26,
    color: c.neutral.textPrimary,
  },
  subtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: c.neutral.textSecondary,
  },
  biaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.primary.purple,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 12,
  },
  biaCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  biaCardTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 14,
    color: "#fff",
  },
  biaCardSubtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    marginTop: 1,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: c.neutral.surface,
    borderWidth: 1,
    borderColor: c.neutral.border,
    marginTop: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: c.neutral.textPrimary,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 8,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: c.neutral.elevated,
    borderWidth: 1,
    borderColor: c.neutral.border,
  },
  entryRowPressed: {
    backgroundColor: c.neutral.surface,
  },
  letterBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: isDark ? c.neutral.surface : "#F4F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  letterBadgeText: {
    fontFamily: "Poppins-Bold",
    fontSize: 22,
    color: c.primary.purple,
  },
  entryWord: {
    fontFamily: "Poppins-SemiBold",
    fontSize: 14,
    color: c.neutral.textPrimary,
  },
  entryPronunciation: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    color: c.neutral.textSecondary,
    marginTop: 1,
  },
  empty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Poppins-Regular",
    fontSize: 13,
    color: c.neutral.textSecondary,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.neutral.surface,
    borderWidth: 1,
    borderColor: c.neutral.border,
  },
  filterChipActive: {
    backgroundColor: c.primary.purple,
    borderColor: c.primary.purple,
  },
  filterChipText: {
    fontFamily: "Poppins-Medium",
    fontSize: 11,
    color: c.neutral.textPrimary,
  },
  filterChipTextActive: { color: "#fff" },
  starBtn: {
    padding: 4,
  },
  });
}
