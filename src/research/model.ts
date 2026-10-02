import { categorize, type CategoryId } from './industries';

/** 1件の受注 */
export interface Order {
  date: string;
  amount: number;
  service: string;
  status: string;
  owner: string;
  kind: string;
}

/** 受注一覧を企業単位にまとめたもの（同じ法人番号・企業名の受注は1社に集約） */
export interface Company {
  key: string;
  name: string;
  kana: string;
  corpNo: string;
  prefecture: string;
  address: string;
  repTitle: string;
  repName: string;
  phone: string;
  mobile: string;
  email: string;
  hp: string;
  employees: number | null;
  industry: string;
  categories: CategoryId[];
  products: string;
  /** 受注経緯から抜き出した「どんな会社か」の一文 */
  summary: string;
  /** 受注経緯・メッセージ（最新の受注のもの、長すぎる分は省略） */
  note: string;
  color: string;
  orders: Order[];
}

export const STATUS_GROUP: Record<string, 'active' | 'ended' | 'cancelled' | 'other'> = {
  支援中: 'active',
  SL支援: 'active',
  M支援: 'active',
  RM支援: 'active',
  経管支援: 'active',
  稼働前支援: 'active',
  残稼働中: 'active',
  残稼働確認: 'active',
  取材前: 'active',
  取材リスケ: 'active',
  取材未実施: 'active',
  契約終了: 'ended',
  解約: 'cancelled',
};

export function statusGroup(status: string) {
  return STATUS_GROUP[status] ?? 'other';
}

const PREF_RE = /^(北海道|東京都|大阪府|京都府|.{2,3}県)/;

/** Excel で先頭の 0 を守るために付いている ' や、n/a などの空値を取り除く */
function clean(v: string | undefined): string {
  const s = (v ?? '').trim().replace(/^'/, '');
  return /^(n\/a|なし|不明|-|－)$/i.test(s) ? '' : s;
}

function normalizeUrl(v: string): string {
  const s = clean(v);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return `https://${s}`;
  return '';
}

/** 受注経緯の文章から「〇〇をされている企業様です」のような会社紹介の一文を取り出す */
export function extractSummary(note: string): string {
  const sentences = note
    .replace(/\r/g, '')
    .split(/[。\n！!]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const hit =
    sentences.find((s) => /(企業様|会社様|事業者様|法人様)(です|になります|でございます)?$/.test(s)) ??
    sentences.find((s) => /(されて|行って|展開して|手掛けて|運営して|提供して)(いる|おられる|います)/.test(s));
  return hit ? hit.slice(0, 120) : '';
}

/** CSV の1行（見出し→値）の配列から企業一覧を作る */
export function buildCompanies(records: Record<string, string>[]): Company[] {
  const map = new Map<string, Company>();
  const latestDate = new Map<string, string>();

  for (const r of records) {
    const name = clean(r['企業名']);
    if (!name) continue;
    const corpNo = clean(r['法人番号']);
    const key = corpNo || name.replace(/\s/g, '');
    const date = clean(r['受注日']);
    const order: Order = {
      date,
      amount: Number(clean(r['受注金額']).replace(/,/g, '')) || 0,
      service: clean(r['受注サービス']).replace(/\s*\(無効\)$/, ''),
      status: clean(r['支援状況']),
      owner: clean(r['受注担当者']) || clean(r['責任者']),
      kind: clean(r['アポイント種別']),
    };

    let c = map.get(key);
    if (!c) {
      c = {
        key,
        name,
        kana: '',
        corpNo,
        prefecture: '',
        address: '',
        repTitle: '',
        repName: '',
        phone: '',
        mobile: '',
        email: '',
        hp: '',
        employees: null,
        industry: '',
        categories: [],
        products: '',
        summary: '',
        note: '',
        color: '',
        orders: [],
      };
      map.set(key, c);
    }
    c.orders.push(order);

    // 基本情報は「新しい受注の値」を優先し、空欄は古い受注の値で埋める
    const newer = date >= (latestDate.get(key) ?? '');
    if (newer) latestDate.set(key, date);
    const fill = (field: keyof Company, value: string) => {
      if (!value) return;
      if (newer || !c![field]) (c as unknown as Record<string, unknown>)[field] = value;
    };
    fill('name', name);
    fill('kana', clean(r['企業名（カナ）']));
    fill('address', clean(r['住所']));
    fill('repTitle', clean(r['代表者役職']));
    fill('repName', clean(r['代表者名']));
    fill('phone', clean(r['電話番号（代表）']));
    fill('mobile', clean(r['携帯番号']));
    fill('email', clean(r['メールアドレス（代表）']));
    fill('hp', normalizeUrl(r['取引先HP URL']));
    const industry = clean(r['業種']);
    if (industry && (industry !== 'その他' || !c.industry)) fill('industry', industry);
    fill('products', clean(r['サービス/商品名']));
    const color = clean(r['社長（決裁者）の想定カラー']);
    fill('color', color);
    const emp = Number(clean(r['従業員数']).replace(/[,名人]/g, ''));
    if (emp > 0 && (newer || c.employees == null)) c.employees = emp;
    const note = clean(r['受注経緯・メッセージ']);
    if (note) {
      const summary = extractSummary(note);
      if (summary) fill('summary', summary);
      fill('note', note.length > 400 ? note.slice(0, 400) + '…' : note);
    }
  }

  for (const c of map.values()) {
    c.prefecture = c.address.match(PREF_RE)?.[1] ?? '';
    c.categories = [...new Set([...categorize(c.industry), ...categorize(c.products)])];
    c.orders.sort((a, b) => b.date.localeCompare(a.date));
  }
  return [...map.values()];
}
