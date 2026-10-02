import { Slider } from "@ark-ui/solid/slider";
import { createSignal } from "solid-js";
import { currentPositionMs } from "../core/playback";
import { formatTime, now } from "../lib/clock";
import { playback, seek } from "../state/spotify";

/** 再生位置の表示と seek。ドラッグ中は表示だけ追従させ、離したときに seek する */
export const ProgressBar = (props: { compact?: boolean }) => {
  const [dragging, setDragging] = createSignal<number | null>(null);
  const duration = () => playback()?.durationMs ?? 0;
  const position = () => {
    const state = playback();
    return dragging() ?? (state ? currentPositionMs(state, now()) : 0);
  };

  return (
    <div class="w-full flex items-center gap-2 text-xs text-muted tabular-nums">
      <span class="w-10 text-right">{formatTime(position())}</span>
      <Slider.Root
        class="flex-1"
        min={0}
        max={Math.max(duration(), 1)}
        step={1000}
        value={[position()]}
        disabled={playback() === null}
        aria-label={["再生位置"]}
        onValueChange={({ value }) => setDragging(value[0] ?? null)}
        onValueChangeEnd={({ value }) => {
          setDragging(null);
          if (value[0] !== undefined) seek(value[0]);
        }}
      >
        <Slider.Control class="group relative flex h-4 items-center">
          <Slider.Track class="h-1 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <Slider.Range class="h-full bg-fg group-hover:bg-accent" />
          </Slider.Track>
          <Slider.Thumb
            index={0}
            class={`block rounded-full bg-fg shadow outline-none focus-visible:(ring-2 ring-accent) ${
              props.compact ? "h-2.5 w-2.5" : "h-3 w-3"
            } opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
          >
            <Slider.HiddenInput />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
      <span class="w-10">{formatTime(duration())}</span>
    </div>
  );
};
