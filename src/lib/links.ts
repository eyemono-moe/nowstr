export const SOURCE_URL: string =
  import.meta.env.VITE_SOURCE_URL || "https://github.com/eyemono-moe/nowstr";

export const CONTACT_URL: string = import.meta.env.VITE_CONTACT_URL || SOURCE_URL;

/** 拡張の配布ページ（Chrome ウェブストア公開前なので GitHub Release の zip） */
export const RELEASES_URL = `${SOURCE_URL}/releases/latest`;

/** 最新の拡張の zip（Release に常に同じ名前で添付している） */
export const DOWNLOAD_URL = `${SOURCE_URL}/releases/latest/download/nowstr-extension.zip`;
