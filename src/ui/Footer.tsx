import { SOURCE_URL } from "../lib/links";

export const Footer = () => (
  <footer class="flex flex-col items-center gap-2 border-t border-fg/10 pt-6 text-xs text-muted">
    <nav class="flex flex-wrap justify-center gap-x-4 gap-y-1">
      <a href="#privacy" class="link">
        プライバシーポリシー
      </a>
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" class="link">
        ソースコード
      </a>
    </nav>
    <p class="text-muted/70">
      Nowstr は YouTube・Spotify・SoundCloud とは関係のない非公式のツールです。
    </p>
  </footer>
);
