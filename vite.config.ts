import basicSsl from "@vitejs/plugin-basic-ssl";
import UnoCSS from "unocss/vite";
import { defineConfig, lazyPlugins, loadEnv, type Plugin } from "vite-plus";
import solid from "vite-plugin-solid";

/**
 * OGP の og:url / og:image は絶対 URL でないと多くのサービスで表示されないため、
 * 公開 URL（VITE_SITE_URL）が分かるビルドでだけ追加する。
 */
const siteMeta = (siteUrl: string | undefined): Plugin => ({
  name: "nowstr-site-meta",
  transformIndexHtml() {
    if (!siteUrl) return [];
    const base = siteUrl.replace(/\/+$/, "");
    return [
      { tag: "meta", attrs: { property: "og:url", content: `${base}/` }, injectTo: "head" },
      {
        tag: "meta",
        attrs: { property: "og:image", content: `${base}/ogp.png` },
        injectTo: "head",
      },
      { tag: "meta", attrs: { property: "og:image:width", content: "1200" }, injectTo: "head" },
      { tag: "meta", attrs: { property: "og:image:height", content: "630" }, injectTo: "head" },
      {
        tag: "meta",
        attrs: { name: "twitter:image", content: `${base}/ogp.png` },
        injectTo: "head",
      },
      { tag: "link", attrs: { rel: "canonical", href: `${base}/` }, injectTo: "head" },
    ];
  },
});

export default defineConfig(({ mode }) => ({
  fmt: {
    ignorePatterns: ["docs/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // 単体テストは DOM 非依存の純粋ロジックのみなので jsdom は不要。
    environment: "node",
  },
  run: {
    tasks: {
      typecheck: { command: "vp check --no-fmt --no-lint", cache: false },
      deploy: { command: "vp build && wrangler deploy", cache: false },
      // ブラウザ拡張 Nowstr Bridge を配布用の zip にする（Release は .github/workflows/extension-release.yml で作る）
      "pack:extension": {
        command:
          "rm -f nowstr-bridge.zip && cd extension && zip -qr ../nowstr-bridge.zip . -x types.d.ts",
        cache: false,
      },
    },
  },
  // - Spotify は redirect URI に `localhost` を許可しないため、ループバック IP で待ち受ける。
  // - NIP-07 拡張には https（と http://localhost）でしか window.nostr を注入しないものがある
  //   （AKA Profiles など）ため、自己署名証明書で HTTPS にする。
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  plugins: lazyPlugins(() => [
    basicSsl({ name: "nowstr-dev" }),
    UnoCSS(),
    solid(),
    siteMeta(loadEnv(mode, process.cwd(), "VITE_").VITE_SITE_URL),
  ]),
}));
