// Pequeno helper pra evitar o warning "GO_BACK was not handled by any navigator"
// que ocorre quando o usuário entra direto numa rota (sign-up via URL no web,
// deep link, etc.) e aperta o chevron back. router.back() não tem o que fazer.
//
// Uso:
//   const router = useRouter();
//   <Pressable onPress={() => safeBack(router)}>...</Pressable>
//
// Se o histórico estiver vazio, navega pro fallback (default "/").

import type { Href, Router } from "expo-router";

export function safeBack(router: Router, fallback: Href = "/" as Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
