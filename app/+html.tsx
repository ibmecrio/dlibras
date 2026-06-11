// Custom HTML do build web. Tudo que precisa ir no <head> entra aqui.
// Expo Router serve esse arquivo no build estático.
//
// O que adicionamos:
//   - manifest.webmanifest (pro PWA install)
//   - theme-color (cor da status bar no browser)
//   - apple-touch-icon + apple-mobile-web-app-* (iOS PWA)
//   - viewport (zoom desabilitado, fit no notch)

import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#6c4ef5" />
        <meta name="description" content="DLibras — aprenda a Língua Brasileira de Sinais com câmera, IA e voz natural." />

        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="DLibras" />

        <title>DLibras — Aprenda Libras</title>

        <ScrollViewStyleReset />

        {/* Estilo base do body — Expo gera reset CSS via NativeWind, isso
            só garante background quando ainda não terminou de hydratar. */}
        <style dangerouslySetInnerHTML={{ __html: baseCss }} />
        <script dangerouslySetInnerHTML={{ __html: registerSW }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const baseCss = `
body { background-color: #11131c; }
@media (prefers-color-scheme: light) {
  body { background-color: #ffffff; }
}
`;

// Registra o Service Worker pra modo offline + installability PWA.
// Falha silenciosa se o browser não suportar (Safari iOS suporta!).
const registerSW = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(e){
      console.warn('[sw] register failed', e);
    });
  });
}
`;
