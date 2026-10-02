import { createEffect, onMount, Show } from "solid-js";
import { canPublishStatus, initNostr, statusController } from "./state/nostr";
import { settings } from "./state/settings";
import { initSpotify, playback, spotify } from "./state/spotify";
import { ConnectionPanel } from "./ui/ConnectionPanel";
import { Footer } from "./ui/Footer";
import { Logo } from "./ui/Logo";
import { NowPlaying } from "./ui/NowPlaying";
import { SettingsDialog } from "./ui/SettingsDialog";
import { Toaster } from "./ui/Toaster";

/**
 * Nowstr はこのブラウザを Spotify Connect デバイスにして、再生中の曲を Nostr に掲示するだけの小さなページ。
 * 再生操作やプレイリストの選択は Spotify 公式アプリから行う。
 */
const App = () => {
  // Playback Store → MusicStatusController。Spotify と Nostr はここでだけ接続する。
  // Nostr 未接続・投稿オフのときは null を渡す（掲示中なら clear される）。
  createEffect(() => {
    statusController.update(settings.statusEnabled && canPublishStatus() ? playback() : null);
  });

  onMount(() => {
    void initSpotify();
    void initNostr();
  });

  return (
    <div class="min-h-screen bg-bg text-fg">
      <div class="mx-auto max-w-md flex flex-col gap-6 p-6">
        <header class="flex items-center justify-between">
          <Logo />
          <SettingsDialog />
        </header>
        <Show when={!spotify.loggedIn}>
          <div class="pt-6 text-center">
            <p class="text-xl font-bold">いま聴いている曲を、Nostr に。</p>
            <p class="mt-2 text-sm text-muted leading-relaxed">
              このブラウザを Spotify の再生デバイスにして、再生中の曲を NIP-38 music status
              として自動で掲示します。
            </p>
          </div>
        </Show>
        <ConnectionPanel />
        <Show when={spotify.loggedIn}>
          <NowPlaying />
        </Show>
        <Footer />
      </div>
      <Toaster />
    </div>
  );
};

export default App;
