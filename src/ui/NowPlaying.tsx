import { Match, Show, Switch } from "solid-js";
import spotifyLogo from "../assets/spotify-full-logo-white.svg";
import { spotifyWebUrl } from "../core/spotify-link";
import { DEVICE_NAME, playback, retryPlayer, spotify, transferHere } from "../state/spotify";
import { Artwork } from "./Artwork";
import { NostrStatusBadge } from "./NostrStatusBadge";

/** Player が使えない・この device で再生していないときの案内 */
const PlayerNotice = () => (
  <Switch>
    <Match when={spotify.player === "connecting" || spotify.player === "idle"}>
      <p class="text-sm text-muted">Spotify に接続しています…</p>
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
        <button type="button" class="btn-primary" onClick={transferHere}>
          <div class="i-lucide-monitor-speaker" />
          このブラウザで再生
        </button>
        <p class="text-xs text-muted leading-relaxed">
          再生中の曲をこのブラウザに移します。以降は Spotify アプリのデバイス一覧から「{DEVICE_NAME}
          」を選んで操作できます。
          <br />
          このタブを開いている間、再生中の曲が Nostr の music status に掲示されます。
        </p>
      </div>
    </Match>
  </Switch>
);

/**
 * このブラウザで再生中の曲。Spotify のメタデータを表示するため、
 * Spotify のロゴによる帰属表示と Spotify へのリンクを必ず添える（Developer Policy / Design Guidelines）。
 */
export const NowPlaying = () => {
  const track = () => playback()?.track ?? null;

  return (
    <section class="card flex flex-col gap-4">
      <Show when={track()} fallback={<PlayerNotice />}>
        {(t) => {
          const url = () => spotifyWebUrl(t().uri);
          return (
            <>
              <img src={spotifyLogo} alt="Spotify" class="w-[84px] self-start" />
              <div class="flex items-center gap-4">
                <Artwork
                  src={t().artworkUrl}
                  alt={t().album}
                  class="aspect-square w-28 shrink-0 rounded-lg"
                />
                <div class="min-w-0 flex flex-col gap-0.5">
                  <Show when={url()} fallback={<p class="truncate font-semibold">{t().title}</p>}>
                    {(href) => (
                      <a
                        href={href()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="truncate font-semibold hover:underline"
                        title={t().title}
                      >
                        {t().title}
                      </a>
                    )}
                  </Show>
                  <p class="truncate text-sm text-muted" title={t().artists.join(", ")}>
                    {t().artists.join(", ")}
                  </p>
                  <p class="truncate text-xs text-muted/70" title={t().album}>
                    {t().album}
                  </p>
                  <Show when={url()}>
                    {(href) => (
                      <a
                        href={href()}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="mt-2 self-start rounded-full border border-fg/30 px-3 py-1 text-[11px] font-bold tracking-wider hover:border-fg"
                      >
                        OPEN SPOTIFY
                      </a>
                    )}
                  </Show>
                </div>
              </div>
              <Show when={playback()?.paused}>
                <p class="text-xs text-muted">一時停止中</p>
              </Show>
            </>
          );
        }}
      </Show>
      <div class="border-t border-fg/10 pt-3">
        <NostrStatusBadge />
      </div>
    </section>
  );
};
