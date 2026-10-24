import { describe, expect, it } from 'vitest';
import { caretAfter, formatNumber, formatTyped, parseNumber, significantBefore } from '../numberFormat';

describe('number format', () => {
  it('adds commas every 3 digits while typing', () => {
    expect(formatTyped('1000000')).toBe('1,000,000');
    expect(formatTyped('1,0000')).toBe('10,000');
    expect(formatTyped('１２３４５')).toBe('12,345');
    expect(formatTyped('-2500')).toBe('-2,500');
    expect(formatTyped('1234.')).toBe('1,234.');
    expect(formatTyped('66.5')).toBe('66.5');
    expect(formatTyped('-')).toBe('-');
    expect(formatTyped('')).toBe('');
    expect(formatTyped('abc')).toBe('abc');
  });
  it('formats and parses numbers', () => {
    expect(formatNumber(2740688)).toBe('2,740,688');
    expect(formatNumber(1.2)).toBe('1.2');
    expect(formatNumber(null)).toBe('');
    expect(parseNumber('2,740,688円')).toBe(2740688);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
  it('keeps the caret after the same digit', () => {
    // 「1000|」に 0 を足した「10000|」→「10,000|」
    expect(caretAfter('10,000', significantBefore('10000', 5))).toBe(6);
    // 「1,|000」の位置で 5 を打った「1,5|000」→「15,|000」
    expect(caretAfter('15,000', significantBefore('1,5000', 3))).toBe(2);
    expect(caretAfter('1,000', 0)).toBe(0);
  });
});
