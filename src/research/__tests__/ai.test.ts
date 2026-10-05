import { describe, expect, it } from 'vitest';
import { candidateLine, gatherCandidates, resolvePicks, type Plan } from '../ai';
import { csvToRecords } from '../csv';
import { buildCompanies } from '../model';
import type { Query } from '../recommend';

const CSV = [
  '企業名,住所,受注日,支援状況,受注担当者,代表者名,電話番号（代表）,メールアドレス（代表）,業種,サービス/商品名,従業員数',
  `山田工務店,東京都港区1-2-3,2026-08-01,支援中,営業 一郎,山田 太郎,'0311112222,yamada@example.com,建築・建設,山田工務店の注文住宅の施工,30`,
  `みどりリフォーム,大阪府大阪市4-5,2026-07-01,契約終了,営業 一郎,緑 花子,'0633334444,,リフォーム,水回りリフォーム,8`,
  `さくら歯科,東京都新宿区6,2026-06-01,支援中,営業 二郎,桜 次郎,,,医院・診療所,歯科医院,12`,
].join('\n');

const companies = buildCompanies(csvToRecords(CSV));
const filters: Query = { text: '', categories: [], prefecture: '', status: 'current', includeHubs: true, requireContact: false, staff: '', staffScope: 'support' };
const plan: Plan = {
  summary: '採用支援',
  segments: [
    { label: '工務店・リフォーム', why: '職人の採用に困っている', keywords: ['建築', 'リフォーム'] },
    { label: 'クリニック', why: '衛生士の採用が難しい', keywords: ['歯科', '診療所'] },
  ],
};

describe('gatherCandidates', () => {
  it('collects companies for every segment without duplicates', () => {
    const cands = gatherCandidates(companies, plan, filters);
    expect(cands.map((c) => c.rec.company.name).sort()).toEqual(['さくら歯科', 'みどりリフォーム', '山田工務店'].sort());
    expect(cands.find((c) => c.rec.company.name === 'さくら歯科')!.segment.label).toBe('クリニック');
    // 各セグメントの1位が先頭に並ぶ
    expect(new Set(cands.slice(0, 2).map((c) => c.segment.label)).size).toBe(2);
  });

  it('respects the current filters', () => {
    const cands = gatherCandidates(companies, plan, { ...filters, prefecture: '東京都' });
    expect(cands.map((c) => c.rec.company.name).sort()).toEqual(['さくら歯科', '山田工務店'].sort());
  });
});

describe('candidateLine', () => {
  it('sends business info but never names or contact details', () => {
    const c = gatherCandidates(companies, plan, filters).find((x) => x.rec.company.name === '山田工務店')!;
    const line = candidateLine(1, c);
    expect(line).toContain('建築・建設');
    expect(line).toContain('（非公開）の注文住宅の施工');
    expect(line).toContain('東京都');
    for (const secret of ['山田工務店', '山田 太郎', '0311112222', 'yamada@example.com', '港区']) expect(line).not.toContain(secret);
  });
});

describe('resolvePicks', () => {
  it('drops unknown or duplicate ids and clamps fit', () => {
    const cands = gatherCandidates(companies, plan, filters);
    const picks = resolvePicks(
      [
        { id: 2, fit: 9, reason: 'a', approach: 'x' },
        { id: 2, fit: 3, reason: 'dup', approach: 'x' },
        { id: 99, fit: 4, reason: 'none', approach: 'x' },
        { id: 1, fit: 0, reason: 'b', approach: 'y' },
      ],
      cands,
    );
    expect(picks.map((p) => [p.id, p.fit])).toEqual([
      [2, 5],
      [1, 1],
    ]);
    expect(picks[0].candidate).toBe(cands[1]);
  });
});
