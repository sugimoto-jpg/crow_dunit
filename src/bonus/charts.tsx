import { useState } from 'react';
import { money, yen } from './ui';

/** 「1,234,567」→「123.5万」 */
export function man(n: number): string {
  if (Math.abs(n) < 10_000) return yen(n);
  return `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万`;
}

/** 目盛りの上限をきりのいい数にする */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

export interface ScenarioBar {
  id: string;
  label: string;
  value: number;
  detail: string;
}

/**
 * 3つの予測の総合計給与を横棒で比べる。マイナスもあるので 0 の線から左右に伸ばす。
 * 棒を押すと、その予測を基準にする。
 */
export function ScenarioBars({ bars, selected, onSelect }: { bars: ScenarioBar[]; selected: string; onSelect: (id: string) => void }) {
  const lo = Math.min(0, ...bars.map((b) => b.value));
  const hi = Math.max(0, ...bars.map((b) => b.value));
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;
  const zero = pos(0);

  return (
    <div className="space-y-3">
      {bars.map((b) => {
        const left = Math.min(zero, pos(b.value));
        const width = Math.abs(pos(b.value) - zero);
        const on = b.id === selected;
        return (
          <button key={b.id} className="group block w-full text-left" onClick={() => onSelect(b.id)} aria-pressed={on} title={b.detail}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className={`font-bold ${on ? 'text-ink' : 'text-ink-2'}`}>
                {b.label}
                {on && <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent-ink">基準</span>}
              </span>
              <span className={`font-bold tabular-nums ${b.value < 0 ? 'text-bad' : 'text-ink'}`}>{money(b.value)}</span>
            </div>
            <div className="relative h-3.5 rounded-full bg-surface-2">
              <div
                className={`absolute inset-y-0 bg-series-1 transition-opacity ${b.value < 0 ? 'rounded-l' : 'rounded-r'} ${on ? '' : 'opacity-45 group-hover:opacity-70'}`}
                style={{ left: `${left}%`, width: `${Math.max(width, b.value === 0 ? 0 : 0.6)}%` }}
              />
              {lo < 0 && <div className="absolute -inset-y-1 w-px bg-line-strong" style={{ left: `${zero}%` }} />}
            </div>
            <div className="mt-1 text-[11px] text-muted">{b.detail}</div>
          </button>
        );
      })}
    </div>
  );
}

/** 月別の入金：実績（③）と受注履歴の見込み（①）を並べた縦棒 */
export function MonthlyBars({ labels, actual, expected }: { labels: string[]; actual: (number | null)[]; expected: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceCeil(Math.max(...expected, ...actual.map((v) => v ?? 0)));
  const ticks = [0, top / 2, top];
  const h = (v: number) => `${(v / top) * 100}%`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <Legend color="bg-series-1" label="実際の入金（入金履歴）" />
        <Legend color="bg-series-2" label="受注履歴の見込み" />
      </div>
      <div className="relative flex h-44 gap-1 pl-10 sm:gap-2">
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ bottom: h(t) }}>
            <span className="w-8 translate-y-1/2 text-right text-[10px] text-muted tabular-nums">{man(t)}</span>
            <span className={`h-px flex-1 translate-y-1/2 ${t === 0 ? 'bg-line-strong' : 'bg-line'}`} />
          </div>
        ))}
        {labels.map((label, i) => (
          <div
            key={label}
            className={`relative flex flex-1 items-end justify-center gap-0.5 rounded-t-md ${hover === i ? 'bg-surface-2' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(hover === i ? null : i)}
          >
            {actual[i] == null ? (
              <span className="mb-1 w-[38%] max-w-5 text-center text-[10px] text-faint">−</span>
            ) : (
              <span className="w-[38%] max-w-5 rounded-t bg-series-1" style={{ height: h(actual[i]!) }} />
            )}
            <span className="w-[38%] max-w-5 rounded-t bg-series-2" style={{ height: h(expected[i]) }} />
            {hover === i && (
              <div className="absolute bottom-full z-10 mb-1 w-max rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg">
                <div className="mb-0.5 font-bold text-ink">{label}</div>
                <div className="flex items-center gap-1.5 text-ink-2">
                  <span className="size-2 rounded-sm bg-series-1" />
                  実際 {actual[i] == null ? '未入力' : `${money(actual[i]!)}`}
                </div>
                <div className="flex items-center gap-1.5 text-ink-2">
                  <span className="size-2 rounded-sm bg-series-2" />
                  見込み {money(expected[i])}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 pl-10 sm:gap-2">
        {labels.map((label) => (
          <div key={label} className="flex-1 text-center text-[11px] text-muted">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
