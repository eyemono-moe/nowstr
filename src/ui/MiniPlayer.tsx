import { Match, Show, Switch } from "solid-js";
import { playback, spotify } from "../state/spotify";
import { Artwork } from "./Artwork";
import { Marquee } from "./Marquee";
import { NostrStatusBadge } from "./NostrStatusBadge";
import { PlayerControls } from "./PlayerControls";
import { ProgressBar } from "./ProgressBar";
import { VolumeControl } from "./VolumeControl";

type Size = { width: number; height: number };

/**
 * PiP window の大きさに応じたレイアウト。
 * - full: アートワーク + 曲情報 / 操作 / 進捗の3段
 * - compact: 曲情報と操作を詰めた2段 + 進捗
 * - bar: 1行（曲情報と操作を横並び）+ 下端に細い進捗
 */
type Layout = "full" | "compact" | "bar";

const layoutOf = ({ height }: Size): Layout =>
  height < 100 ? "bar" : height < 150 ? "compact" : "full";

const TrackText = (props: { artist?: boolean; size?: "sm" | "xs" }) => {
  const track = () => playback()?.track ?? null;
  return (
    <Show
      when={track()}
      fallback={
        <p class="truncate text-xs text-muted">
          {spotify.player === "ready" ? "再生していません" : "Spotify に接続していません"}
        </p>
      }
    >
      {(t) => (
        <div class="min-w-0 flex flex-col leading-tight">
          <Marquee
            text={t().title}
            class={`font-semibold ${props.size === "xs" ? "text-xs" : "text-sm"}`}
          />
          <Show when={props.artist ?? true}>
            <Marquee
              text={t().artists.join(", ")}
              class={`text-muted ${props.size === "xs" ? "text-[10px]" : "text-xs"}`}
            />
          </Show>
        </div>
      )}
    </Show>
  );
};

/** Document Picture-in-Picture に表示する小型プレイヤー */
export const MiniPlayer = (props: { size: Size }) => {
  const track = () => playback()?.track ?? null;
  const layout = () => layoutOf(props.size);
  const width = () => props.size.width;

  return (
    <div class="relative h-full select-none overflow-hidden bg-bg text-fg">
      <Switch>
        <Match when={layout() === "full"}>
          <div class="h-full flex items-center gap-3 p-3">
            <Artwork
              src={track()?.artworkUrl}
              alt={track()?.album ?? ""}
              class="aspect-square h-full max-h-40"
            />
            <div class="min-w-0 flex flex-1 flex-col justify-center gap-1">
              <TrackText />
              <PlayerControls compact />
              <ProgressBar compact showTime={width() >= 300} />
              <div class="flex items-center justify-between gap-1">
                <NostrStatusBadge compact />
                <VolumeControl showSlider={width() >= 300} sliderClass="w-16" />
              </div>
            </div>
          </div>
        </Match>

        <Match when={layout() === "compact"}>
          <div class="h-full flex items-center gap-2 p-2">
            <Show when={width() >= 260}>
              <Artwork
                src={track()?.artworkUrl}
                alt={track()?.album ?? ""}
                class="aspect-square h-full max-h-24"
              />
            </Show>
            <div class="min-w-0 flex flex-1 flex-col justify-center gap-0.5">
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1">
                  <TrackText />
                </div>
                <Show when={width() >= 360}>
                  <NostrStatusBadge compact />
                </Show>
              </div>
              <div class="flex items-center justify-between gap-1">
                <PlayerControls compact />
                <VolumeControl showSlider={width() >= 340} sliderClass="w-14" />
              </div>
              <ProgressBar compact showTime={width() >= 320} />
            </div>
          </div>
        </Match>

        <Match when={layout() === "bar"}>
          <div class="h-full flex items-center gap-2 px-2 pb-1">
            <Show when={width() >= 280 && props.size.height >= 40}>
              <Artwork
                src={track()?.artworkUrl}
                alt={track()?.album ?? ""}
                class="aspect-square h-[calc(100%-12px)] max-h-16 rounded-md"
              />
            </Show>
            <div class="min-w-0 flex-1">
              <TrackText artist={props.size.height >= 56} size="xs" />
            </div>
            <PlayerControls dense />
            <VolumeControl showSlider={width() >= 480} sliderClass="w-16" />
            <Show when={width() >= 600}>
              <NostrStatusBadge compact />
            </Show>
          </div>
          {/* 下端に細い進捗バー（seek も可能） */}
          <div class="absolute inset-x-0 bottom-0 -mb-1 px-1">
            <ProgressBar compact showTime={false} />
          </div>
        </Match>
      </Switch>
    </div>
  );
};
