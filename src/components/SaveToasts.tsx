import { AlertTriangle, CheckCircle2, Info, RotateCw, X } from 'lucide-react';
import { useSaveStatus } from '../save/useSaveStatus';
import { getSaveManager } from '../save';

/** セーブの結果を画面下に通知する（失敗・復旧・競合は必ず表示） */
export function SaveToasts() {
  const status = useSaveStatus();
  const m = getSaveManager();
  if (!status.toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {status.toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`anim-pop pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-bold shadow-lg ring-1 ${
            t.kind === 'success'
              ? 'bg-emerald-900/95 text-emerald-50 ring-emerald-400/50'
              : t.kind === 'error'
                ? 'bg-rose-950/95 text-rose-50 ring-rose-400/60'
                : t.kind === 'warn'
                  ? 'bg-amber-950/95 text-amber-50 ring-amber-400/60'
                  : 'bg-night-800/95 text-indigo-50 ring-white/20'
          }`}
        >
          {t.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : t.kind === 'info' ? (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="flex-1 leading-snug">{t.text}</span>
          {status.conflict && t.sticky && t.kind === 'warn' && (
            <button onClick={() => location.reload()} className="flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-xs">
              <RotateCw className="h-3.5 w-3.5" /> 再読み込み
            </button>
          )}
          {(t.sticky || t.kind === 'error') && (
            <button onClick={() => m?.dismiss(t.id)} className="shrink-0 rounded p-0.5 hover:bg-white/10" aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
