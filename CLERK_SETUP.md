# Configurar Clerk pra funcionar em dlibras.vercel.app

O Clerk **em modo `pk_test_*` so aceita `localhost`** por default. Pra fazer
funcionar em `https://dlibras.vercel.app` precisa autorizar o dominio.

## Passos (5 minutos)

### 1. Login no Clerk Dashboard

Abre **https://dashboard.clerk.com/** e entra na sua conta.

### 2. Seleciona a instancia atual

No menu superior esquerdo, escolhe a instancia que ja esta conectada ao
DLibras (a publishable key do .env termina em `LmNsZXJrLmFjY291bnRzLmRldiQ`).

### 3. Adiciona dominio autorizado

Vai em **Configure -> Domains** (menu lateral).

Clica em **Add domain** e adiciona:

```
dlibras.vercel.app
```

Confirma. Em 30s o dominio fica ativo.

### 4. (Opcional) Adiciona outros dominios

Se voce tem outros previews:

```
dlibras-k4ts5aj3c-oieandersons-projects.vercel.app
*.oieandersons-projects.vercel.app
```

### 5. Configura OAuth providers (Google)

Pra login com Google funcionar:

1. Vai em **Configure -> SSO Connections**
2. Habilita **Google**
3. **Em modo dev (pk_test)**: Clerk usa o Google OAuth deles - ja funciona
   sem configurar nada extra
4. **Em modo prod (pk_live)**: voce precisa criar credenciais OAuth do
   Google Cloud Console e colar Client ID + Secret no Clerk

### 6. Recarrega a pagina

Apos adicionar o dominio, recarrega `https://dlibras.vercel.app` com hard
refresh (Cmd+Shift+R no Mac, Ctrl+Shift+R no Windows).

O botao **Login com Google** vai funcionar.

## Bypass de auth (pra testar sem Clerk)

Enquanto o Clerk nao tiver autorizado, voce pode usar o app sem login
clicando no botao **"Continuar em modo demo"** na tela de sign-in (botao
amarelo). Esse modo usa um user fake e libera todas as funcionalidades
exceto sync entre devices.

## Migrar pra producao (pk_live)

Quando quiser desligar o modo test:

1. No Clerk Dashboard, cria uma **Production Instance** (em vez da Development)
2. Configura todos os mesmos dominios + OAuth providers
3. Pega a `pk_live_*` da nova instancia
4. Atualiza Vercel:
   ```
   vercel env rm EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY production
   vercel env add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY production
   # cola: pk_live_xxx
   ```
5. Redeploy: `vercel --prod`

Custo: Clerk free ate 10k MAU (suficiente pra demo + comecar a vender pra
escolas), depois US$25/mes.
