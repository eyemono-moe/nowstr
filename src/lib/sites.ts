/**
 * 拡張が対応している音楽サービス。案内ページの対応サイトの一覧・説明文・フッター・プライバシーポリシーと、
 * index.html の説明文（vite.config.ts）はすべてここから作る。
 * サービスを追加したら、拡張（extension/manifest.json など）とあわせてここにも追加する。
 */
export type Site = {
  name: string;
  /** 対応サイトの一覧から開く URL */
  url: string;
  /** 投稿する曲のリンクのドメイン（プライバシーポリシーに書く） */
  linkHost: string;
  /** 対応サイトの一覧に出す注意書き */
  notes: string[];
};

export const SITES: Site[] = [
  {
    name: "YouTube Music",
    url: "https://music.youtube.com/",
    linkHost: "music.youtube.com",
    notes: [
      "どのページ（ホーム・プレイリスト・ライブラリなど）で再生していても読み取れます",
      "広告の再生中は投稿しません",
      "限定公開・非公開の動画は、曲名だけを投稿してリンクは付けません",
    ],
  },
  {
    name: "Spotify",
    url: "https://open.spotify.com/",
    linkHost: "open.spotify.com",
    notes: [
      "ブラウザの Web Player（open.spotify.com）で再生している曲が対象です。Spotify Free でも使えます",
      "広告の再生中は投稿しません",
      "スマートフォンのアプリなど、他の端末で再生している曲は対象外です",
    ],
  },
  {
    name: "SoundCloud",
    url: "https://soundcloud.com/",
    linkHost: "soundcloud.com",
    notes: [
      "シークレットリンクで再生している曲や非公開の曲は、曲名だけを投稿してリンクは付けません",
    ],
  },
  {
    name: "Amazon Music",
    url: "https://music.amazon.co.jp/",
    linkHost: "music.amazon.co.jp など",
    notes: [
      "ブラウザの Web Player（music.amazon.co.jp・music.amazon.com など）で再生している曲とポッドキャストが対象です",
      "曲そのもののリンクが取れないため、曲名とアーティスト名での検索結果へのリンクを付けます",
      "広告の再生中は投稿しません",
    ],
  },
  {
    name: "Nintendo Music",
    url: "https://music.nintendo.com/",
    linkHost: "music.nintendo.com",
    notes: [
      "ブラウザ版（music.nintendo.com）で再生している曲が対象です。利用には Nintendo Switch Online への加入が必要です",
      "「曲名 - ゲーム名」として投稿し、曲の共有用リンクを付けます",
    ],
  },
  {
    name: "Apple Music",
    url: "https://music.apple.com/",
    linkHost: "music.apple.com",
    notes: [
      "ブラウザの Web Player（music.apple.com）で再生している曲が対象です",
      "サインインせずに試聴（30 秒）している曲も投稿します",
    ],
  },
];

/** 「YouTube Music・Spotify・…」 */
export const SITE_NAMES = SITES.map((site) => site.name).join("・");
