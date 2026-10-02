import { describe, expect, it } from 'vitest';
import { csvToRecords, parseCsv } from '../csv';
import { buildCompanies, extractSummary } from '../model';
import { passesFilters, recommend, type Query } from '../recommend';

const HEADER = '支援担当者,責任者,企業名,法人番号,住所,受注日,受注金額,支援状況,受注サービス,受注担当者,代表者役職,代表者名,電話番号（代表）,メールアドレス（代表）,取引先HP URL,業種,サービス/商品名,従業員数,社長（決裁者）の想定カラー,受注経緯・メッセージ';
const CSV = [
  '﻿' + HEADER,
  `鈴木 一、高橋 二,永田 勝,テスト建設株式会社,'1111,東京都港区1-1,2026-08-01,1000000,支援中,営業支援ユニット,山田 太郎,代表取締役,"建設 一郎",'0312345678,a@example.com,example.com,建築・建設,住宅の新築工事,60,赤（ギャンブラー）,"東京で住宅の新築をされている企業様です。\n今後も伴走します"`,
  `,,テスト建設株式会社,'1111,東京都港区1-1,2024-01-01,500000,契約終了,セールスユニット,山田 太郎,代表取締役,"建設 一郎",'0312345678,,,建築・建設,,,,`,
  `高橋 二,,みらい不動産,,大阪府大阪市1-2,2026-05-01,800000,契約終了,営業支援ユニット,佐藤 花子,代表,"不動産 二郎",'0611112222,,n/a,不動産売買,,5,,`,
  `,,解約食品,,福岡県福岡市3,2025-01-01,300000,解約,営業支援ユニット,,代表,"食品 三郎",,,,食品加工,,,,`,
  `,永田 勝,その他商事,,北海道札幌市4,2026-09-01,300000,支援中,営業支援ユニット,,代表,"商事 四郎",,,,その他,,,,"リフォーム工事の職人を抱えている企業様です。"`,
].join('\r\n');

const q = (patch: Partial<Query>): Query => ({ text: '', categories: [], prefecture: '', status: 'current', includeHubs: true, requireContact: false, staff: '', staffScope: 'support', ...patch });

describe('csv', () => {
  it('quoted fields with newlines and escaped quotes', () => {
    expect(parseCsv('a,b\r\n"x\ny","he said ""hi"""\n')).toEqual([['a', 'b'], ['x\ny', 'he said "hi"']]);
  });
});

describe('buildCompanies', () => {
  const companies = buildCompanies(csvToRecords(CSV));
  it('merges orders of the same company and cleans values', () => {
    expect(companies).toHaveLength(4);
    const c = companies.find((x) => x.name === 'テスト建設株式会社')!;
    expect(c.orders).toHaveLength(2);
    expect(c.orders[0].date).toBe('2026-08-01');
    expect(c.phone).toBe('0312345678');
    expect(c.hp).toBe('https://example.com');
    expect(c.prefecture).toBe('東京都');
    expect(c.summary).toBe('東京で住宅の新築をされている企業様です');
    expect(c.categories).toContain('construction');
  });
  it('drops n/a urls', () => {
    expect(companies.find((x) => x.name === 'みらい不動産')!.hp).toBe('');
  });
  it('extractSummary falls back to "されている" sentences', () => {
    expect(extractSummary('ご縁をいただきました。飲食店を3店舗運営している会社です。')).toBe('飲食店を3店舗運営している会社です');
  });
});

describe('recommend', () => {
  const companies = buildCompanies(csvToRecords(CSV));
  const now = new Date('2026-10-01');

  it('ranks the directly matching company first with reasons and a tip', () => {
    const res = recommend(companies, q({ text: '建設' }), now);
    expect(res[0].company.name).toBe('テスト建設株式会社');
    expect(res[0].type).toBe('direct');
    const texts = res[0].reasons.map((r) => r.text).join('\n');
    expect(texts).toContain('業種が「建築・建設」');
    expect(texts).toContain('支援中');
    expect(res[0].tip).toContain('結論');
  });

  it('finds companies through the order memo even when the industry is その他', () => {
    const res = recommend(companies, q({ text: 'リフォーム' }), now);
    expect(res.map((r) => r.company.name)).toContain('その他商事');
  });

  it('suggests real-estate companies as bridges into construction', () => {
    const res = recommend(companies, q({ text: '建設' }), now);
    const hub = res.find((r) => r.company.name === 'みらい不動産');
    expect(hub?.type).toBe('hub');
    expect(hub?.reasons[0].text).toContain('橋渡し');
    expect(recommend(companies, q({ text: '建設', includeHubs: false }), now).some((r) => r.type === 'hub')).toBe(false);
  });

  it('applies status and prefecture filters', () => {
    expect(recommend(companies, q({ text: '食品' }), now)).toHaveLength(0);
    expect(recommend(companies, q({ text: '食品', status: 'all' }), now)[0].reasons.some((r) => r.kind === 'caution')).toBe(true);
    expect(recommend(companies, q({ categories: ['construction'], prefecture: '大阪府' }), now).map((r) => r.company.name)).toEqual(['みらい不動産']);
  });

  it('filters by support staff and explains the relationship', () => {
    const res = recommend(companies, q({ staff: '鈴木' }), now);
    expect(res.map((r) => r.company.name)).toEqual(['テスト建設株式会社']);
    expect(res[0].reasons[0].text).toContain('鈴木 一さんが支援担当');
    expect(recommend(companies, q({ text: '建設', staff: '高橋 二' }), now).map((r) => r.company.name).sort()).toEqual(['みらい不動産', 'テスト建設株式会社'].sort());
  });

  it('includes order owners and managers only when asked', () => {
    expect(recommend(companies, q({ staff: '永田' }), now)).toHaveLength(0);
    const res = recommend(companies, q({ staff: '永田', staffScope: 'any' }), now);
    expect(res.map((r) => r.company.name).sort()).toEqual(['その他商事', 'テスト建設株式会社'].sort());
    expect(res.find((r) => r.company.name === 'その他商事')!.reasons[0].text).toContain('責任者');
  });

  it('passesFilters scopes the overview by region and status', () => {
    const names = (patch: Partial<Query>) => companies.filter((c) => passesFilters(c, q(patch))).map((c) => c.name).sort();
    expect(names({ prefecture: '東京都' })).toEqual(['テスト建設株式会社']);
    expect(names({})).not.toContain('解約食品');
    expect(names({ status: 'all' })).toHaveLength(4);
  });
});
