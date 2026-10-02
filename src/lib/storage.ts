/** localStorage の JSON 読み書き。プライベートモード等で失敗しても例外を投げない。 */
export const loadJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
};

export const saveJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくてもアプリは動作させる
  }
};

export const removeItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
};
