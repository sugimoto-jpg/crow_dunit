import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { caretAfter, formatNumber, formatTyped, parseNumber, significantBefore } from './numberFormat';

// 「-0」と表示しないように 0 にそろえる
export const yen = (n: number) => (Math.round(n) || 0).toLocaleString('ja-JP');
/** 円表示。マイナスは「−¥1,000」 */
export const money = (n: number) => `${Math.round(n) < 0 ? '−' : ''}¥${yen(Math.abs(n))}`;

export function Card({ title, children, aside, note }: { title: string; children: ReactNode; aside?: ReactNode; note?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div>
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** 集計の小さなタイル（ラベルと値） */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-bold tabular-nums ${tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : 'text-ink'}`}>{value}</div>
    </div>
  );
}

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-40';
export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-bold text-ink-2 hover:bg-surface-2 disabled:opacity-40';
export const linkBtn = 'text-sm font-bold text-accent-ink hover:underline';

export function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs font-bold text-muted">
      {label}
      <NumIn value={value} onChange={(v) => onChange(v ?? 0)} />
    </label>
  );
}

// スマホでは 16px にして、入力時に画面が拡大されないようにする
export const inputCls =
  'mt-1 h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-base font-normal text-ink placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none sm:h-9 sm:text-sm';

export function TextIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** 数値入力。打つそばから3桁ごとに「,」を付ける（例：1,000,000）。空欄は null */
export function NumIn({ value, onChange, placeholder, className = '' }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; className?: string }) {
  const [text, setText] = useState(formatNumber(value));
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useEffect(() => {
    setText((t) => (parseNumber(t) === value ? t : formatNumber(value)));
  }, [value]);
  // 「,」が増減してもカーソルが同じ数字の後ろに残るようにする
  useLayoutEffect(() => {
    if (caret.current != null && ref.current === document.activeElement) ref.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);
  return (
    <input
      ref={ref}
      className={`${inputCls} text-right tabular-nums ${className}`}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        const next = formatTyped(raw);
        caret.current = caretAfter(next, significantBefore(raw, e.target.selectionStart ?? raw.length));
        setText(next);
        onChange(parseNumber(raw));
      }}
    />
  );
}

export function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      className={`grid size-8 place-items-center rounded-lg text-muted disabled:opacity-30 ${danger ? 'hover:bg-bad-soft hover:text-bad' : 'hover:bg-surface-2 hover:text-ink'}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

/** 画面が広い（表で見せる）か。スマホではカードで見せる */
export function useWide(query = '(min-width: 768px)'): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
  );
}

/** カードの中の小さな見出し付きの欄 */
export function Labeled({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[11px] font-bold text-muted">{label}</div>
      {children}
    </div>
  );
}
