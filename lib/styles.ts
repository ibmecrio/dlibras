import { Platform, ViewStyle } from "react-native";

// Helper unificado pra shadow cross-platform.
// React Native Web (0.21+) deprecou shadowColor/shadowOffset/etc — agora
// usa `boxShadow` (CSS). Mobile native segue com as props clássicas. Esse
// helper retorna o objeto certo por plataforma e elimina os 30+ warnings
// "shadow* style props are deprecated" que sujavam o console.
//
// Uso:
//   ...cardShadow({ color: "#000", opacity: 0.06, radius: 8, y: 2 })
export function cardShadow({
  color = "#000",
  opacity = 0.06,
  radius = 8,
  y = 2,
  x = 0,
  elevation,
}: {
  color?: string;
  opacity?: number;
  radius?: number;
  y?: number;
  x?: number;
  elevation?: number;
} = {}): ViewStyle {
  if (Platform.OS === "web") {
    // boxShadow é aceito em RN Web mas não está no tipo ViewStyle base.
    // Cast pra unknown→ViewStyle é a forma menos suja.
    return {
      boxShadow: `${x}px ${y}px ${radius}px ${rgba(color, opacity)}`,
    } as unknown as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: elevation ?? Math.round(radius / 2),
  };
}

// Converte "#RRGGBB" ou "#RGB" pra rgba(r,g,b,a). Aceita rgba(...) já formatado
// e retorna sem mexer.
function rgba(color: string, alpha: number): string {
  if (color.startsWith("rgba") || color.startsWith("rgb")) return color;
  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
