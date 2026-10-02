/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_REDIRECT_URI?: string;
  readonly VITE_SOURCE_URL?: string;
  readonly VITE_CONTACT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
