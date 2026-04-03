/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
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
