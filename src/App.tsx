import { createEffect, on, onMount } from "solid-js";
import { canPublishStatus, initNostr, statusController } from "./state/nostr";
import { settings } from "./state/settings";
import { activePlayback, activeSource, availableSources, SOURCE_LABELS } from "./state/source";
import { initSpotify } from "./state/spotify";
import { initYouTubeMusic } from "./state/youtube";
import { Footer } from "./ui/Footer";
import { Logo } from "./ui/Logo";
import { NowPlaying } from "./ui/NowPlaying";
import { SettingsDialog } from "./ui/SettingsDialog";
import { SetupSteps } from "./ui/SetupSteps";
import { SourcePicker } from "./ui/SourcePicker";
import { Toaster } from "./ui/Toaster";
import { Show } from "solid-js";

/**
 * Nowstr は、Spotify / YouTube Music で再生中の曲を Nostr に掲示するだけの1枚のページ。
 * - Spotify: このブラウザを Spotify Connect デバイスにする（再生操作は Spotify 公式アプリから）
 * - YouTube Music: ブラウザ拡張が YouTube Music のタブから曲情報を届ける
 */
const App = () => {
  // 再生元 → MusicStatusController。再生元と Nostr はここでだけ接続する。
  // Nostr 未接続・投稿オフのときは null を渡す（掲示中なら clear される）。
  createEffect(() => {
    statusController.update(settings.statusEnabled && canPublishStatus() ? activePlayback() : null);
  });

  // Spotify は選ばれたときにだけ接続する（Spotify Connect のデバイス一覧に不要に出さないため）
  let spotifyStarted = false;
  createEffect(
    on(activeSource, (source) => {
      if (source === "spotify" && !spotifyStarted) {
        spotifyStarted = true;
        void initSpotify();
      }
    }),
  );

  onMount(() => {
    initYouTubeMusic();
    void initNostr();
  });

  const services = availableSources.map((source) => SOURCE_LABELS[source]).join(" または ");

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
            このページで {services} と Nostr を連携すると、再生中の曲を Nostr
            のステータスとして自動で設定できます。
          </p>
          <p class="text-xs text-muted leading-relaxed">
            ステータスは NIP-38 の music status（kind:30315、d タグ "music"）として投稿されます。
          </p>
        </div>
        <SourcePicker />
        <SetupSteps />
        <Show when={activePlayback()}>
          <NowPlaying />
        </Show>
        <Footer />
      </div>
      <Toaster />
    </div>
  );
};

export default App;
