/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_SOURCE_URL?: string;
  readonly VITE_CONTACT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** 配布している最新の拡張のバージョン（ビルド時に extension/manifest.json から埋め込む） */
declare const __LATEST_EXTENSION_VERSION__: string;
