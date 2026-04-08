/// <reference types="vite/client" />

type ImportMetaEnv = Record<string, never>;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TelegramWebApp {
  readonly initData: string;
  ready: () => void;
  expand?: () => void;
}

interface TelegramNamespace {
  WebApp: TelegramWebApp;
}

interface Window {
  Telegram?: TelegramNamespace;
}
