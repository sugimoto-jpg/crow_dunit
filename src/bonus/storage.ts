import { DEFAULT_SETTINGS, type Order, type Settings } from './calc';

const KEY = 'aidma-bonus-forecast-v1';

export interface Saved {
  orders: Order[];
  settings: Settings;
}

/** 入力内容はこの端末のブラウザにだけ保存する（外部送信なし） */
export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as { orders?: Order[]; settings?: Partial<Settings> & { makeup?: number } };
      const settings = { ...DEFAULT_SETTINGS, ...d.settings };
      // 旧版の「メイクアップ」はメイクプイの加算へ移す
      if (d.settings?.makeup && !d.settings.addons) {
        settings.addons = DEFAULT_SETTINGS.addons.map((a) => (a.name === 'メイクプイ' ? { ...a, amount: d.settings!.makeup! } : a));
      }
      return { orders: Array.isArray(d.orders) ? d.orders : [], settings };
    }
  } catch {
    /* 保存できない環境では毎回まっさらから始める */
  }
  return { orders: [], settings: DEFAULT_SETTINGS };
}

export function save(d: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* noop */
  }
}
