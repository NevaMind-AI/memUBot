/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE: string
  readonly VITE_EASEMOB_APP_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
