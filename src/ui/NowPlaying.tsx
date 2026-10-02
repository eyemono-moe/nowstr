import { Match, Show, Switch } from "solid-js";
import { isPipSupported, pipWindow, togglePip } from "../pip/pip";
import { playback, retryPlayer, spotify, transferHere } from "../state/spotify";
import { Artwork } from "./Artwork";
import { NostrStatusBadge } from "./NostrStatusBadge";
import { PlayerControls } from "./PlayerControls";
import { ProgressBar } from "./ProgressBar";
import { VolumeControl } from "./VolumeControl";

/** Player が使えない・この device で再生していないときの案内 */
const PlayerNotice = () => (
  <Switch>
    <Match when={spotify.player === "connecting" || spotify.player === "idle"}>
      <p class="text-sm text-muted">Spotify プレイヤーに接続しています…</p>
    </Match>
    <Match when={spotify.player === "error"}>
      <div class="flex flex-col items-center gap-3 text-center">
        <p class="text-sm text-danger">{spotify.error?.message}</p>
        <Show when={spotify.error?.code !== "spotify_premium_required"}>
          <button type="button" class="btn-secondary text-sm" onClick={retryPlayer}>
            再接続
          </button>
        </Show>
      </div>
    </Match>
    <Match when={spotify.player === "offline"}>
      <div class="flex flex-col items-center gap-3 text-center">
        <p class="text-sm text-muted">Spotify との接続が切れました。</p>
        <button type="button" class="btn-secondary text-sm" onClick={retryPlayer}>
          再接続
        </button>
      </div>
    </Match>
    <Match when={playback() === null}>
      <div class="flex flex-col items-center gap-3 text-center">
        <p class="text-sm text-muted">
          プレイリストを選ぶか、他のデバイスで再生中の曲をこのブラウザに移せます。
        </p>
        <button type="button" class="btn-secondary text-sm" onClick={transferHere}>
          <div class="i-lucide-monitor-speaker" />
          このブラウザで再生
        </button>
      </div>
    </Match>
  </Switch>
);

export const NowPlaying = () => {
  const track = () => playback()?.track ?? null;

  return (
    <section class="card flex flex-col items-center gap-5 p-6">
      <Artwork
        src={track()?.artworkUrl}
        alt={track()?.album ?? ""}
        class="aspect-square w-full max-w-72 shadow-2xl"
      />
      <div class="w-full min-w-0 text-center">
        <Show when={track()} fallback={<PlayerNotice />}>
          {(t) => (
            <>
              <h2 class="truncate text-xl font-bold" title={t().title}>
                {t().title}
              </h2>
              <p class="truncate text-muted" title={t().artists.join(", ")}>
                {t().artists.join(", ")}
              </p>
              <p class="truncate text-xs text-muted/70" title={t().album}>
                {t().album}
              </p>
            </>
          )}
        </Show>
      </div>
      <ProgressBar />
      <PlayerControls />
      <div class="w-full flex items-center justify-between">
        <NostrStatusBadge />
        <div class="flex items-center gap-2">
          <VolumeControl />
          <button
            type="button"
            class="btn-icon"
            aria-label="ミニプレイヤー"
            title={
              isPipSupported()
                ? "ミニプレイヤー（Picture-in-Picture）"
                : "このブラウザは Document Picture-in-Picture に未対応です"
            }
            aria-pressed={pipWindow() !== null}
            disabled={!isPipSupported()}
            onClick={() => void togglePip()}
          >
            <div
              class={
                pipWindow()
                  ? "i-lucide-picture-in-picture text-accent"
                  : "i-lucide-picture-in-picture-2"
              }
            />
          </button>
        </div>
      </div>
    </section>
  );
};
