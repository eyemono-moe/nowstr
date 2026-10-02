import { createEffect, onMount, Show } from "solid-js";
import { canPublishStatus, initNostr, statusController } from "./state/nostr";
import { settings } from "./state/settings";
import { initSpotify, playback } from "./state/spotify";
import { Footer } from "./ui/Footer";
import { Logo } from "./ui/Logo";
import { NowPlaying } from "./ui/NowPlaying";
import { SettingsDialog } from "./ui/SettingsDialog";
import { SetupSteps } from "./ui/SetupSteps";
import { Toaster } from "./ui/Toaster";

/**
 * Nowstr はこのブラウザを Spotify Connect デバイスにして、再生中の曲を Nostr に掲示するだけの1枚のページ。
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
        <div class="flex flex-col gap-2">
          <p class="text-xl font-bold">いま聴いている曲を、Nostr に。</p>
          <p class="text-sm leading-relaxed">
            このページで Spotify と Nostr にログインすると、Spotify で再生中の曲を Nostr
            のステータスとして自動で設定できます。
          </p>
          <p class="text-xs text-muted leading-relaxed">
            ステータスは NIP-38 の music status（kind:30315、d タグ "music"）として投稿されます。
          </p>
        </div>
        <SetupSteps />
        <Show when={playback()}>
          <NowPlaying />
        </Show>
        <Footer />
      </div>
      <Toaster />
    </div>
  );
};

export default App;
