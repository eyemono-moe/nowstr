import { EnvironmentProvider } from "@ark-ui/solid/environment";
import { createSignal } from "solid-js";
import { clearDelegatedEvents, delegateEvents, render } from "solid-js/web";
import { AppError } from "../lib/errors";
import { notifyError } from "../state/toast";
import { MiniPlayer } from "../ui/MiniPlayer";

/**
 * Document Picture-in-Picture による常駐ミニプレイヤー。
 * Spotify Player は main document に1つだけあり、PiP には同じ store を参照する UI だけを描画する。
 */

export const isPipSupported = (): boolean => "documentPictureInPicture" in window;

const [pipWindow, setPipWindow] = createSignal<Window | null>(null);
export { pipWindow };

/** Solid は click 等をグローバルな document に委譲するため、PiP 側の document にも登録する */
const DELEGATED_EVENTS = ["click", "input", "pointerdown", "pointerup", "keydown"];

/**
 * main document のスタイル（UnoCSS の生成物を含む）を PiP window に複製する。
 *
 * - `cssRules` の cssText は `mask: var(...)` のような var() を含む shorthand を正しく
 *   シリアライズできない（UnoCSS のアイコンが消える）ため、CSS のソース文字列をそのまま使う。
 * - `<link>` は取得済みの CSS を `<style>` として埋め込み、PiP 側での再読み込みを待たずに済ませる。
 */
const copyStyles = async (target: Document): Promise<void> => {
  const nodes = [...document.querySelectorAll('style, link[rel="stylesheet"]')];
  const styles = await Promise.all(
    nodes.map(async (node) => {
      if (!(node instanceof HTMLLinkElement)) return node.textContent ?? "";
      try {
        const res = await fetch(node.href);
        if (res.ok) return await res.text();
      } catch {
        // 下の @import にフォールバック
      }
      return `@import url(${JSON.stringify(node.href)});`;
    }),
  );
  for (const css of styles) {
    const style = target.createElement("style");
    style.textContent = css;
    target.head.append(style);
  }
};

export const togglePip = async (): Promise<void> => {
  const current = pipWindow();
  if (current) {
    current.close();
    return;
  }
  if (!window.documentPictureInPicture) {
    notifyError(
      new AppError(
        "pip_unsupported",
        "このブラウザは Document Picture-in-Picture に対応していません。Chrome / Edge 116 以降をご利用ください。",
      ),
      "ミニプレイヤー",
    );
    return;
  }
  try {
    const win = await window.documentPictureInPicture.requestWindow({ width: 380, height: 168 });
    const doc = win.document;
    doc.title = "Nowstr";
    await copyStyles(doc);
    doc.documentElement.className = document.documentElement.className;
    doc.body.className = document.body.className;
    delegateEvents(DELEGATED_EVENTS, doc);

    const root = doc.createElement("div");
    root.className = "h-full";
    doc.body.append(root);
    const dispose = render(
      () => (
        <EnvironmentProvider value={() => doc}>
          <MiniPlayer />
        </EnvironmentProvider>
      ),
      root,
    );

    win.addEventListener(
      "pagehide",
      () => {
        dispose();
        clearDelegatedEvents(doc);
        setPipWindow(null);
      },
      { once: true },
    );
    setPipWindow(win);
  } catch (cause) {
    notifyError(
      new AppError("pip_failed", "ミニプレイヤーを開けませんでした。", { cause }),
      "ミニプレイヤー",
    );
  }
};
