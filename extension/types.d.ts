// 拡張内で受け渡す再生状態。Nowstr 本体の src/core/playback.ts と同じ形。

type BridgeTrack = {
  uri: string;
  title: string;
  artists: string[];
  album: string;
  artworkUrl: string | null;
  durationMs: number;
};

type BridgePlaybackState = {
  track: BridgeTrack | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
};

type BridgePlaybackMessage = { type: "playback"; state: BridgePlaybackState | null };
