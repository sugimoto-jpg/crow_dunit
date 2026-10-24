import { describe, expect, it } from 'vitest';
import { dealRows, describeDeals } from '../deals';
import { accounts, companyKey, defaultOpenStatuses, detectFields, sortAccounts, staleDeals } from '../followup';
import { parseGrid, toTable } from '../table';

// ヨミ表の案件一覧を模した架空のデータ
const TEXT = [
  '現在\t次回日程\t情報更新日\t属性\tアポチャネル\t提案商材\t月\t金額合計\t企業名\t"受注\n日時"\t先方名前\tフォロー理由',
  'FB\t2026/10/30\t2026/10/20\t新規\t紹介\tSP\t13\t¥1,950,000\tA株式会社\t\t山田\t',
  'FC\t2026/10/01\t2026/09/30\t新規\tIS\tSP\t13\t¥1,950,000\tB社\t\t\t連絡待ち',
  'YF\t\t2026/10/10\tフォロー\t電話\tCM\t15\t¥2,250,000\tC社\t\t\t',
  'FB\t\t2025/01/10\t新規\tIS\tSP\t13\t¥1,950,000\tD社\t\t\t',
  'キャンセル\t\t2026/10/01\t新規\t電話\tSP\t13\t¥1,950,000\tE社\t\t\t入室なし',
  '受注\t\t2026/01/16\t新規\t紹介\tSP\t13\t¥1,950,000\t株式会社F\t01/16\t\t',
  '受注\t\t2025/09/01\tクロスセル\tクロスセル\tMV\t12\t¥2,400,000\tG社\t09/01\t\t',
  '受注\t\t2025/10/01\tクロスセル\tクロスセル\tCP\t12\t¥2,000,000\tH社\t10/01\t\t',
  '受注\t\t2025/03/01\t新規\t紹介\tSP\t13\t¥1,950,000\tG社\t03/01\t\t',
  '受注\t\t2026/03/01\t新規\t紹介\tSP\t1\t¥150,000\tI社\t03/01\t\t',
  'FB\t2026/11/05\t2026/10/15\tクロスセル\tクロスセル\tMV\t12\t¥2,400,000\tI社\t\t\t',
].join('\n');

const t = toTable(parseGrid(TEXT), false);
const cols = describeDeals(t);
const f = detectFields(cols);
const rows = dealRows(t, cols);
const open = defaultOpenStatuses(['キャンセル', '受注', 'FB', 'FC', 'YF', '当日キャンセル', '失注', '（空欄）']);
const today = new Date(2026, 9, 24).getTime();

describe('followup', () => {
  it('finds the yomi columns', () => {
    expect(t.header[f.company]).toBe('企業名');
    expect(t.header[f.next]).toBe('次回日程');
    expect(t.header[f.update]).toBe('情報更新日');
    expect(t.header[f.months]).toBe('月');
    expect(t.header[f.won]).toBe('受注\n日時');
    expect(open).toEqual(['FB', 'FC', 'YF']);
    expect(companyKey('株式会社 F')).toBe(companyKey('F株式会社'));
  });

  it('flags open deals with no, past or stale next steps', () => {
    const items = staleDeals(rows, f, open, today, { idleDays: 30, withinDays: 90 });
    expect(items.map((x) => [x.row[f.company], x.reasons])).toEqual([
      ['C社', ['noNext']],
      ['B社', ['overdue']],
    ]);
    expect(items[1].overdueDays).toBe(23);
    // 期間の制限をなくすと、1年以上前の D社 も出る
    const all = staleDeals(rows, f, open, today, { idleDays: 30, withinDays: null });
    expect(all.map((x) => x.row[f.company])).toContain('D社');
    expect(all.find((x) => x.row[f.company] === 'D社')!.reasons).toEqual(['noNext', 'idle']);
  });

  it('lists won accounts with contract end, follow-up activity and product ideas', () => {
    const list = accounts(rows, f, open, t.header.indexOf('金額合計'));
    const by = Object.fromEntries(list.map((a) => [a.name, a]));
    expect(Object.keys(by).sort()).toEqual(['G社', 'H社', 'I社', '株式会社F']);
    expect(by['G社']).toMatchObject({ winCount: 2, products: ['MV', 'SP'], wonAmount: 4_350_000, crossAfter: 0, openDeals: 0 });
    expect(by['G社'].contractEnd).toBe(new Date(2026, 8, 1).getTime());
    // クロスセルで売れている商材（MV・CP）のうち未受注のもの
    expect(by['株式会社F'].suggest).toEqual(['MV', 'CP']);
    expect(by['G社'].suggest).toEqual(['CP']);
    // 1か月契約は契約終了を出さない。受注後にクロスセル案件があり、進行中
    expect(by['I社']).toMatchObject({ contractEnd: null, crossAfter: 1, openDeals: 1 });
    const order = sortAccounts(list, 'contract', today).map((a) => a.name);
    expect(order).toEqual(['株式会社F', 'H社', 'G社', 'I社']);
  });
});
