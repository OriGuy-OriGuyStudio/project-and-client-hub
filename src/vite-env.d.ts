/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ADMIN_EMAIL: string;
  readonly VITE_AI_CHAT_URL: string;
  readonly VITE_STUDIO_WHATSAPP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
