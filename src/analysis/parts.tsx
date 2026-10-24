import type { ReactNode } from 'react';
import { toCsv } from '../research/csv';

/** 案件フィルターの画面で共通に使う部品 */

export function Card({ title, icon, right, children }: { title: string; icon: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {icon}
        <h2 className="flex-1 font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}

export const select = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';

export function downloadCsv(fileName: string, header: string[], rows: (string | number)[][]) {
  const blob = new Blob([toCsv(header, rows)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const fmtDate = (t: number | null) => {
  if (t === null) return '';
  const d = new Date(t);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

export const todayStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
