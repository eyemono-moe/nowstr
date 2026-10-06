import { readFileSync } from "node:fs";
import UnoCSS from "unocss/vite";
import { defineConfig, lazyPlugins, loadEnv, type Plugin } from "vite-plus";
import solid from "vite-plugin-solid";
import { SITE_NAMES } from "./src/lib/sites.ts";

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

/** index.html の説明文（description / og:description）に、対応サービスの一覧（src/lib/sites.ts）を入れる */
const siteNames = (): Plugin => ({
  name: "nowstr-site-names",
  transformIndexHtml: (html) => html.replaceAll("%NOWSTR_SITE_NAMES%", SITE_NAMES),
});

/** 同じコミットの拡張のバージョンを、インストール方法の説明に最新版として表示する */
const extensionVersion: string = JSON.parse(
  readFileSync(new URL("./extension/manifest.json", import.meta.url), "utf8"),
).version;

export default defineConfig(({ mode }) => ({
  define: {
    __LATEST_EXTENSION_VERSION__: JSON.stringify(extensionVersion),
  },
  fmt: {
    ignorePatterns: ["docs/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    include: ["src/**/*.test.ts", "extension/**/*.test.ts"],
    // 単体テストは DOM 非依存の純粋ロジックのみなので jsdom は不要。
    environment: "node",
  },
  run: {
    tasks: {
      typecheck: { command: "vp check --no-fmt --no-lint", cache: false },
      deploy: { command: "vp build && wrangler deploy", cache: false },
      // ブラウザ拡張 Nowstr の service worker とポップアップをビルドする（extension/dist/）。
      // 拡張を「パッケージ化されていない拡張機能」として読み込む前に一度実行する（--watch で変更を追いかける）
      "build:extension": { command: "vp build --config vite.extension.config.ts", cache: false },
      // 配布用の zip にする（Release は .github/workflows/extension-release.yml で作る）
      "pack:extension": {
        command:
          "vp run build:extension && rm -f nowstr-extension.zip && cd extension && zip -qr ../nowstr-extension.zip . -x 'src/*' content/types.d.ts",
        cache: false,
      },
    },
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  plugins: lazyPlugins(() => [
    UnoCSS(),
    solid(),
    siteMeta(loadEnv(mode, process.cwd(), "VITE_").VITE_SITE_URL),
    siteNames(),
  ]),
}));
