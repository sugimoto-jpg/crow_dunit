/** 入力欄の数値を3桁ごとの「,」付きで表示するための変換 */

/** 全角の数字・記号を半角にし、「,」「円」「%」と空白を取り除く */
function normalize(t: string): string {
  return t.replace(/[０-９．－，]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,\s円%]/g, '');
}

/** 入力された文字列を数値にする。空欄や数値でないものは null */
export function parseNumber(t: string): number | null {
  const s = normalize(t);
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function withCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 入力途中の文字列を「,」付きに整える。「12.」や「-」のような途中の形はそのまま残す */
export function formatTyped(t: string): string {
  const s = normalize(t);
  const m = /^(-?)(\d*)(\.\d*)?$/.exec(s);
  if (!m) return t;
  return m[1] + withCommas(m[2]) + (m[3] ?? '');
}

/** 数値を「,」付きの文字列にする */
export function formatNumber(n: number | null): string {
  return n == null ? '' : formatTyped(String(n));
}

/** 文字列の pos より前にある、数値として意味のある文字（数字・小数点・マイナス）の数 */
export function significantBefore(t: string, pos: number): number {
  return normalize(t.slice(0, pos)).length;
}

/** 整えた後の文字列で、意味のある文字を count 個過ぎた位置（カーソルを戻す先） */
export function caretAfter(formatted: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ',') seen++;
    if (seen === count) return i + 1;
  }
  return formatted.length;
}
