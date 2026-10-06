import type { MusicService } from "./core/playback";

/**
 * 対応している音楽サービスと、そのタブに入れる content script。
 *
 * サイトへのアクセス権限はサービスごとに optional_host_permissions で求め、
 * 許可されたサービスにだけ content script を登録する（chrome.scripting.registerContentScripts）。
 * manifest の content_scripts に書くと、インストール時にすべてのサイトの権限を求めることになるため。
 * サービスのオン・オフは「権限があるか」そのもので、別に設定は持たない（Chrome の設定画面で外された場合も同じに扱える）。
 *
 * サービスを追加したら、manifest の optional_host_permissions にも matches を追加する。
 */
export type ServiceDefinition = {
  id: MusicService;
  label: string;
  /** 権限を求めるサイトで、content script を入れるサイト（match pattern） */
  matches: string[];
  /** ページ側（MAIN world）の補助スクリプト。main-world.js は共通で入れる */
  mainScripts?: string[];
  /** isolated world の adapter。source.js は共通で入れる */
  adapter: string;
};

const AMAZON_TLDS = [
  "com",
  "co.jp",
  "co.uk",
  "de",
  "fr",
  "it",
  "es",
  "ca",
  "com.au",
  "in",
  "com.mx",
  "com.br",
];

export const SERVICES: ServiceDefinition[] = [
  {
    id: "youtube-music",
    label: "YouTube Music",
    matches: ["https://music.youtube.com/*"],
    mainScripts: ["content/sources/youtube-music-main.js"],
    adapter: "content/sources/youtube-music.js",
  },
  {
    id: "spotify",
    label: "Spotify",
    matches: ["https://open.spotify.com/*"],
    mainScripts: ["content/sources/spotify-main.js"],
    adapter: "content/sources/spotify.js",
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    matches: ["https://soundcloud.com/*"],
    adapter: "content/sources/soundcloud.js",
  },
  {
    id: "amazon-music",
    label: "Amazon Music",
    matches: AMAZON_TLDS.map((tld) => `https://music.amazon.${tld}/*`),
    adapter: "content/sources/amazon-music.js",
  },
  {
    id: "nintendo-music",
    label: "Nintendo Music",
    matches: ["https://music.nintendo.com/*"],
    mainScripts: ["content/sources/nintendo-music-main.js"],
    adapter: "content/sources/nintendo-music.js",
  },
];

/** "https://music.youtube.com/*" のような match pattern が URL に当てはまるか（このファイルで使う形だけを扱う） */
export const matchesUrl = (pattern: string, url: string): boolean => {
  const match = /^(https?):\/\/([^/]+)\/\*$/.exec(pattern);
  if (!match) return false;
  try {
    const target = new URL(url);
    return target.protocol === `${match[1]}:` && target.hostname === match[2];
  } catch {
    return false;
  }
};

/** URL がどのサービスのものか */
export const serviceForUrl = (url: string | undefined): ServiceDefinition | null =>
  (url &&
    SERVICES.find((service) => service.matches.some((pattern) => matchesUrl(pattern, url)))) ||
  null;

/** サービスに入れる content script（registerContentScripts の形）。id は "<サービス>:<種類>" */
export const contentScriptsFor = (
  service: ServiceDefinition,
): chrome.scripting.RegisteredContentScript[] => [
  {
    id: `${service.id}:main-world`,
    matches: service.matches,
    js: ["content/main-world.js"],
    runAt: "document_start",
    world: "MAIN",
    persistAcrossSessions: true,
  },
  ...(service.mainScripts
    ? [
        {
          id: `${service.id}:main`,
          matches: service.matches,
          js: service.mainScripts,
          runAt: "document_idle" as const,
          world: "MAIN" as const,
          persistAcrossSessions: true,
        },
      ]
    : []),
  {
    id: `${service.id}:adapter`,
    matches: service.matches,
    js: ["content/source.js", service.adapter],
    runAt: "document_idle",
    persistAcrossSessions: true,
  },
];

/** いまアクセスを許可されているサービス */
export const grantedServices = async (): Promise<ServiceDefinition[]> => {
  const { origins = [] } = await chrome.permissions.getAll();
  return SERVICES.filter((service) =>
    service.matches.every((pattern) => origins.includes(pattern)),
  );
};
