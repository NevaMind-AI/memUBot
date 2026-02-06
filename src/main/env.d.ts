/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MAIN_VITE_APP_MODE: 'memu' | 'yumi'
  readonly MAIN_VITE_FIREBASE_API_KEY: string
  readonly MAIN_VITE_FIREBASE_AUTH_DOMAIN: string
  readonly MAIN_VITE_FIREBASE_PROJECT_ID: string
  readonly MAIN_VITE_FIREBASE_STORAGE_BUCKET: string
  readonly MAIN_VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly MAIN_VITE_FIREBASE_APP_ID: string
  readonly MAIN_VITE_YUMI_API_BASE_URL: string
  readonly MAIN_VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
