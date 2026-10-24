import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { caretAfter, formatNumber, formatTyped, parseNumber, significantBefore } from './numberFormat';

export const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');

export function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs text-slate-500">
      {label}
      <div className="mt-0.5 py-1 text-right text-sm font-bold text-slate-800 tabular-nums">{value}</div>
    </div>
  );
}

export function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <NumIn value={value} onChange={(v) => onChange(v ?? 0)} />
    </label>
  );
}

export const inputCls = 'mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none';

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
      className={`rounded p-1 disabled:opacity-30 ${danger ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-slate-100 hover:text-slate-700'}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
