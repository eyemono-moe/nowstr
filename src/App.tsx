import { createEffect, onMount, Show } from "solid-js";
import { canPublishStatus, initNostr, statusController } from "./state/nostr";
import { settings } from "./state/settings";
import { initSpotify, playback, spotify } from "./state/spotify";
import { ConnectionPanel } from "./ui/ConnectionPanel";
import { NowPlaying } from "./ui/NowPlaying";
import { PlaylistPicker } from "./ui/PlaylistPicker";
import { SettingsDialog } from "./ui/SettingsDialog";
import { Toaster } from "./ui/Toaster";

const Logo = () => (
  <div class="flex items-center gap-2">
    <div class="h-8 w-8 flex items-center justify-center rounded-lg from-accent to-nostr bg-gradient-to-br">
      <div class="i-lucide-audio-lines text-lg text-bg" />
    </div>
    <span class="text-xl font-bold tracking-tight">Nowstr</span>
  </div>
);

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
      <div class="mx-auto max-w-5xl flex flex-col gap-6 p-6">
        <header class="flex items-center justify-between">
          <Logo />
          <SettingsDialog />
        </header>

        <Show
          when={spotify.loggedIn}
          fallback={
            <main class="mx-auto max-w-md w-full flex flex-col gap-6 pt-12">
              <div class="text-center">
                <p class="text-2xl font-bold">ブラウザで聴いている曲を、Nostr に。</p>
                <p class="mt-2 text-sm text-muted">
                  Spotify を再生し、いま聴いている曲を NIP-38 music status
                  として自動で掲示する小さなプレイヤーです。
                </p>
              </div>
              <ConnectionPanel />
            </main>
          }
        >
          <main class="grid gap-6 md:(grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start)">
            <NowPlaying />
            <div class="flex flex-col gap-6 md:(sticky top-6 max-h-[calc(100vh-3rem)])">
              <ConnectionPanel />
              <PlaylistPicker />
            </div>
          </main>
        </Show>
      </div>
      <Toaster />
    </div>
  );
};

export default App;
