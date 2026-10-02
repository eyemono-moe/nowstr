import { nextTrack, playback, previousTrack, spotify, togglePlay } from "../state/spotify";

export const PlayerControls = (props: { compact?: boolean }) => {
  const disabled = () => spotify.player !== "ready" || playback() === null;
  const paused = () => playback()?.paused ?? true;

  return (
    <div class={`flex items-center justify-center ${props.compact ? "gap-1" : "gap-4"}`}>
      <button
        type="button"
        class="btn-icon"
        aria-label="前の曲"
        title="前の曲"
        disabled={disabled()}
        onClick={previousTrack}
      >
        <div class="i-lucide-skip-back" />
      </button>
      <button
        type="button"
        class={`btn-icon bg-fg! text-bg! hover:scale-105 ${props.compact ? "p-2" : "p-3"}`}
        aria-label={paused() ? "再生" : "一時停止"}
        title={paused() ? "再生" : "一時停止"}
        disabled={disabled()}
        onClick={togglePlay}
      >
        <div class={paused() ? "i-lucide-play" : "i-lucide-pause"} />
      </button>
      <button
        type="button"
        class="btn-icon"
        aria-label="次の曲"
        title="次の曲"
        disabled={disabled()}
        onClick={nextTrack}
      >
        <div class="i-lucide-skip-forward" />
      </button>
    </div>
  );
};
