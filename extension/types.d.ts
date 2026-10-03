// 拡張内で受け渡す再生状態。Nowstr 本体の src/core/playback.ts と同じ形。

type BridgeTrack = {
  uri: string;
  title: string;
  artists: string[];
  album: string;
  artworkUrl: string | null;
  durationMs: number;
  unlisted: boolean;
};

type BridgePlaybackState = {
  track: BridgeTrack | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
};

type BridgePlaybackMessage = { type: "playback"; state: BridgePlaybackState | null };

// 同じタブで古い content script が残っていたら止めるためのフック。
// 拡張の再読み込み・更新時、古いスクリプトは孤立したまま残り、新しいものが注入されるため。
interface Window {
  __nowstrYtmStop?: () => void;
  __nowstrBridgeStop?: () => void;
}
