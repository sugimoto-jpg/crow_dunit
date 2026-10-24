export const fmt = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.abs(n) >= 100 ? Math.round(n).toLocaleString('ja-JP') : (Math.round(n * 10) / 10).toLocaleString('ja-JP');
};

export const pct = (r: number | null | undefined) => (r == null || !Number.isFinite(r) ? '—' : `${(r * 100).toFixed(r < 0.1 ? 2 : 1)}%`);

/** Excel で保存した Shift_JIS の CSV にも対応する */
export async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}
