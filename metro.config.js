const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Stub Stream Video SDK + WebRTC no web — eles usam `requireNativeComponent`
// que só existe em RN nativo (iOS/Android). Sem isso, qualquer rota acaba
// puxando esses módulos indiretamente e quebra o bundle web.
// `_voice-mode.web.tsx` é o stub de UI; isso aqui é a rede de segurança
// caso outro arquivo importe o SDK transitivamente.
const STREAM_NATIVE_MODULES = new Set([
  "@stream-io/video-react-native-sdk",
  "@stream-io/react-native-webrtc",
]);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && STREAM_NATIVE_MODULES.has(moduleName)) {
    return { type: "empty" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config, { input: "./global.css" });
