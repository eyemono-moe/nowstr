/**
 * `installed` が `latest` より古いか。どちらも `1.2.3` のような数字をドットで区切った形
 * （Chrome 拡張の manifest の version と同じ）。読めない値なら古いとはみなさない。
 */
export const isOlderVersion = (installed: string, latest: string): boolean => {
  const parse = (version: string) =>
    /^\d+(\.\d+)*$/.test(version) ? version.split(".").map(Number) : null;
  const a = parse(installed);
  const b = parse(latest);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
};
