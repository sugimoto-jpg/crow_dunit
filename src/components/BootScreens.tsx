import { useEffect, useState } from 'react';
import { AlertTriangle, BookMarked, Loader2, Sparkles } from 'lucide-react';
import { getSaveManager, type SlotInfo } from '../save';
import { useSaveStatus } from '../save/useSaveStatus';
import { JOBS } from '../data/jobs';
import { levelFromExp } from '../data/levels';
import { SaveCodePanel } from './SaveCodePanel';

/** セーブデータ読み込み中（長引いたら案内と再読み込みボタンを出す） */
export function BootLoading({ error }: { error?: string | null }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="bg-sky safe-top safe-bottom fixed inset-0 grid place-items-center px-6 text-center">
      <div>
        <div className="logo-title text-3xl">アイドマ営業クエスト</div>
        {error ? (
          <p className="mt-4 text-sm text-rose-200">起動に失敗しました：{error}</p>
        ) : (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-indigo-200">
            <Loader2 className="h-4 w-4 animate-spin" /> 冒険の記録を読み込み中…
          </p>
        )}
        {(slow || error) && (
          <div className="mt-4 text-xs leading-relaxed text-indigo-300">
            {!error && <p>時間がかかっています。まもなく予備の保存先で起動します。</p>}
            <button onClick={() => location.reload()} className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-indigo-50 ring-1 ring-white/20">
              再読み込み
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/** セーブ破損・消失時：自動で初期化せず、利用者に選んでもらう */
export function RecoveryScreen() {
  const status = useSaveStatus();
  const m = getSaveManager();
  const [slots, setSlots] = useState<(SlotInfo | null)[]>([]);
  const [confirmNew, setConfirmNew] = useState(false);
  useEffect(() => {
    m?.listSlots().then(setSlots);
  }, [m]);
  if (!m || !status.boot) return null;
  const corrupted = status.boot.kind === 'corrupted';

  return (
    <div className="bg-sky safe-top safe-bottom safe-x fixed inset-0 overflow-y-auto">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="rpg-window p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-300" />
            <h1 className="font-pixel text-lg text-amber-200">{corrupted ? 'セーブデータを読み込めません' : 'セーブデータが見つかりません'}</h1>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-indigo-100">{status.boot.message}</p>
          <p className="mt-2 text-xs leading-relaxed text-indigo-300">
            {corrupted
              ? '壊れたデータは消さずに残しています。'
              : 'ブラウザのデータ削除、プライベートモード、別のブラウザ／アプリで開いた場合などに起こります。'}
          </p>
        </div>

        {slots.some(Boolean) && (
          <section className="rpg-window mt-3 p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-gold-300">
              <BookMarked className="h-4 w-4" /> 冒険の書から再開
            </h2>
            <div className="mt-2 grid gap-2">
              {slots.map(
                (s) =>
                  s && (
                    <button
                      key={s.index}
                      onClick={() => m.loadSlot(s.index)}
                      className="rounded-lg bg-night-800 p-2.5 text-left text-sm ring-1 ring-white/15 hover:ring-gold-400"
                    >
                      <div className="text-[11px] font-bold text-gold-300">冒険の書 {s.index}</div>
                      <div className="font-black">
                        {s.data.player.name || '（名前なし）'} Lv.{levelFromExp(s.data.player.exp)} {JOBS[s.data.player.jobId]?.name}
                      </div>
                      <div className="text-[11px] text-indigo-300">{fmt.format(s.savedAt)} に記録</div>
                    </button>
                  ),
              )}
            </div>
          </section>
        )}

        <section className="rpg-window mt-3 p-4">
          <SaveCodePanel allowExport={false} />
        </section>

        <section className="mt-3">
          {confirmNew ? (
            <div className="rpg-window p-4 text-sm">
              <p className="font-bold">新しく始めますか？ 今の画面から前の進行は戻せません（壊れたデータ自体は削除しません）。</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirmNew(false)} className="flex-1 rounded-lg bg-white/10 py-2.5 font-bold">
                  やめる
                </button>
                <button onClick={() => m.startNewAfterProblem()} className="flex-1 rounded-lg bg-rose-600 py-2.5 font-bold">
                  新しく始める
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmNew(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-bold">
              <Sparkles className="h-4 w-4" /> 新しく始める
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
