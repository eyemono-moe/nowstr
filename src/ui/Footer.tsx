import { Show } from "solid-js";
import { SOURCE_URL, SPOTIFY_APPS_URL } from "../lib/links";
import { availableSources } from "../state/source";
import { PrivacyDialog } from "./PrivacyDialog";

export const Footer = () => (
  <footer class="flex flex-col items-center gap-2 pt-4 text-xs text-muted">
    <nav class="flex flex-wrap justify-center gap-x-4 gap-y-1">
      <PrivacyDialog />
      <Show when={availableSources.includes("spotify")}>
        <a href={SPOTIFY_APPS_URL} target="_blank" rel="noopener noreferrer" class="link">
          Spotify との連携を解除
        </a>
      </Show>
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" class="link">
        ソースコード
      </a>
    </nav>
    <p class="text-muted/70">Nowstr は Spotify や YouTube とは関係のない非公式のツールです。</p>
  </footer>
);
