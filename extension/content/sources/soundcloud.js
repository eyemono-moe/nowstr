// Nowstr: SoundCloud（soundcloud.com）の MusicSourceAdapter。
//
// SoundCloud は mediaSession の metadata と playbackState を設定する。再生は document に入れない <audio> で行うが、
// main-world.js が拾うので、曲名・再生状態・位置・長さは共通処理（source.js）で読める。ここでは次だけを補う。
// - 曲の URL: 画面下の再生バーの曲名リンク（.playbackSoundBadge__titleLink）
// - 非公開の曲か: シークレットリンク（/s-xxxx を含む URL）で再生している、
//   または再生中の曲に「Private」ラベル（.sc-label-private）が付いていれば、リンクを出さない

(() => {
  /** @returns {{ url: string | null, secret: boolean }} */
  const trackLink = () => {
    const url = parseHref(
      document.querySelector(".playbackSoundBadge__titleLink")?.getAttribute("href"),
    );
    if (!url || url.hostname !== "soundcloud.com") return { url: null, secret: false };
    const secret = url.pathname.split("/").some((part) => /^s-\w+$/.test(part));
    return { url: `https://soundcloud.com${url.pathname}`, secret };
  };

  /** web-scrobbler の SoundCloud connector と同じ手がかり（一覧・プレイリスト・曲のページ） */
  const privateLabel = () =>
    Boolean(
      document.querySelector(".sound.playing .sc-label-private") ??
      document.querySelector(".compactTrackListItem.active .sc-label-private") ??
      document.querySelector(".soundList__item .active .sc-label-private"),
    );

  defineMusicSource({
    source: "soundcloud",
    read({ metadata }) {
      if (!metadata?.title) return null;
      const { url, secret } = trackLink();
      const query = `${metadata.title} ${metadata.artist ?? ""}`.trim();
      return {
        uri: url ?? `https://soundcloud.com/search?q=${encodeURIComponent(query)}`,
        unlisted: secret || privateLabel(),
      };
    },
  });
})();
