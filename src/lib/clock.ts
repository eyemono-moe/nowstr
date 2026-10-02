import { createRoot, createSignal } from "solid-js";

/** 再生位置の表示更新用の時計。main / PiP の両方の UI で共有する */
export const now = createRoot(() => {
  const [now, setNow] = createSignal(Date.now());
  setInterval(() => setNow(Date.now()), 250);
  return now;
});

export const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};
