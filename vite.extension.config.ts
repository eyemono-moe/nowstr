import { defineConfig } from "vite-plus";

/**
 * ブラウザ拡張 Nowstr の service worker とポップアップのスクリプト（extension/src/）をビルドする。
 * rx-nostr なども含めて、それぞれ1ファイルにまとめる。
 * content script（extension/content/）はビルドせず、そのまま読み込む。
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "extension/dist",
    emptyOutDir: true,
    // 拡張は配布後に中身を確認できるよう、圧縮しない
    minify: false,
    target: "es2023",
    lib: {
      entry: {
        background: "extension/src/background.ts",
        popup: "extension/src/popup.ts",
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
