import { useState } from 'react';
import { BookMarked, Download, Save, Trash2, Upload, X } from 'lucide-react';
import { useGame } from '../store/gameStore';
import { SLOT_COUNT, deleteSlot, readSlots, writeSlot, type SaveSlot } from '../store/saveSlots';
import { JOBS, CHARACTER_NAMES } from '../data/jobs';
import { HERO_SPRITES } from '../data/sprites';
import { QUESTS } from '../data/quests';
import { LECTURES } from '../data/lectures';
import { levelFromExp } from '../data/levels';
import { Modal } from './ui';
import { sfx } from '../audio/sfx';

type Pending = { kind: 'save' | 'load' | 'delete'; index: number } | null;

const fmt = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/** 冒険の書：3つのスロットにセーブ／ロード */
export function SaveMenu() {
  const mode = useGame((s) => s.saveMenu);
  if (!mode) return null;
  return <SaveMenuInner key={mode} initialMode={mode} />;
}

function SaveMenuInner({ initialMode }: { initialMode: 'save' | 'load' }) {
  const onboarded = useGame((s) => s.onboarded);
  const setSaveMenu = useGame((s) => s.setSaveMenu);
  const takeSnapshot = useGame((s) => s.takeSnapshot);
  const loadSnapshot = useGame((s) => s.loadSnapshot);
  // 冒険を始める前はロードのみ
  const [mode, setMode] = useState<'save' | 'load'>(onboarded ? initialMode : 'load');
  const [slots, setSlots] = useState<(SaveSlot | null)[]>(() => readSlots());
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const close = () => {
    sfx.cancel();
    setSaveMenu(null);
  };

  const doSave = (i: number) => {
    const ok = writeSlot(i, takeSnapshot());
    setSlots(readSlots());
    setPending(null);
    if (ok) {
      sfx.levelUp();
      setMessage({ text: `冒険の書${i + 1}に記録しました。`, ok: true });
    } else {
      sfx.hurt();
      setMessage({ text: '記録できませんでした。ブラウザの保存領域が使えない状態です（プライベートモード等）。', ok: false });
    }
  };

  const doLoad = (i: number) => {
    const slot = slots[i];
    if (!slot) return;
    sfx.jobChange();
    loadSnapshot(slot.snapshot);
  };

  const doDelete = (i: number) => {
    deleteSlot(i);
    setSlots(readSlots());
    setPending(null);
    sfx.cancel();
    setMessage({ text: `冒険の書${i + 1}を消しました。`, ok: true });
  };

  const onSlot = (i: number) => {
    setMessage(null);
    const filled = !!slots[i];
    if (mode === 'save') {
      if (filled) {
        sfx.select();
        setPending({ kind: 'save', index: i });
      } else doSave(i);
    } else if (filled) {
      sfx.select();
      if (onboarded) setPending({ kind: 'load', index: i });
      else doLoad(i);
    }
  };

  return (
    <div className="relative z-[60]">
      <Modal onClose={close}>
        <div className="rpg-window overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <BookMarked className="h-5 w-5 text-gold-300" />
            <h2 className="font-pixel flex-1 text-lg text-gold-300">冒険の書</h2>
            <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 ring-1 ring-white/20" aria-label="閉じる">
              <X className="h-5 w-5" />
            </button>
          </div>

          {onboarded && (
            <div className="grid grid-cols-2 gap-1 p-2" role="tablist">
              {(['save', 'load'] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    sfx.select();
                    setMode(m);
                    setPending(null);
                    setMessage(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold ${
                    mode === m ? 'bg-gradient-to-r from-indigo-500 to-violet-600' : 'bg-white/5 text-indigo-200'
                  }`}
                >
                  {m === 'save' ? <Save className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  {m === 'save' ? 'セーブする' : 'ロードする'}
                </button>
              ))}
            </div>
          )}

          <p className="px-4 pt-1 text-xs leading-relaxed text-indigo-200">
            {mode === 'save'
              ? '今の進行（レベル・ゴールド・職業・習得した虎の巻・討伐記録）を冒険の書に記録します。'
              : '記録した冒険の書から再開します。'}
          </p>

          <div className="grid gap-2 p-3">
            {Array.from({ length: SLOT_COUNT }, (_, i) => {
              const slot = slots[i];
              const snap = slot?.snapshot;
              const confirm = pending?.index === i ? pending : null;
              return (
                <div key={i} className={`rounded-xl ring-1 ${slot ? 'bg-night-800/90 ring-white/15' : 'bg-black/25 ring-white/10'}`}>
                  <button
                    onClick={() => onSlot(i)}
                    disabled={mode === 'load' && !slot}
                    className="flex w-full items-center gap-3 p-2.5 text-left disabled:cursor-default"
                  >
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-indigo-900 to-night-950 ring-1 ring-white/10">
                      {snap && (
                        <img
                          src={(HERO_SPRITES[snap.jobId] ?? HERO_SPRITES.villager)[snap.gender].src}
                          alt=""
                          className="absolute inset-x-0 bottom-0 mx-auto h-[62px] object-contain"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-gold-300">冒険の書 {i + 1}</div>
                      {snap && slot ? (
                        <>
                          <div className="truncate text-[15px] font-black">
                            {snap.playerName || CHARACTER_NAMES[snap.gender]}
                            <span className="ml-1.5 text-xs font-bold text-indigo-200">
                              Lv.{levelFromExp(snap.exp)} {JOBS[snap.jobId]?.name ?? ''}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-indigo-200">
                            <span>{snap.gold.toLocaleString()}G</span>
                            <span>
                              討伐 {QUESTS.filter((q) => snap.questRecords?.[q.id]).length}/{QUESTS.length}
                            </span>
                            <span>
                              虎の巻 {snap.completedLectures.length}/{LECTURES.length}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] tabular-nums text-indigo-300/70">{fmt.format(slot.savedAt)} に記録</div>
                        </>
                      ) : (
                        <div className="text-sm text-indigo-300/60">― 記録なし ―</div>
                      )}
                    </div>
                    {mode === 'save' ? (
                      <Download className="h-5 w-5 shrink-0 text-gold-300" />
                    ) : (
                      slot && <Upload className="h-5 w-5 shrink-0 text-gold-300" />
                    )}
                  </button>

                  {slot && !confirm && (
                    <div className="flex justify-end px-2.5 pb-2">
                      <button
                        onClick={() => {
                          sfx.select();
                          setMessage(null);
                          setPending({ kind: 'delete', index: i });
                        }}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-indigo-300/70 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> 消す
                      </button>
                    </div>
                  )}

                  {confirm && (
                    <div className="anim-pop mx-2.5 mb-2.5 rounded-lg bg-black/40 p-2.5 text-xs">
                      <p className="font-bold">
                        {confirm.kind === 'save' && 'この冒険の書に上書きしますか？'}
                        {confirm.kind === 'load' && 'この記録から再開しますか？ セーブしていない今の進行は失われます。'}
                        {confirm.kind === 'delete' && 'この冒険の書を消しますか？ 元に戻せません。'}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => setPending(null)} className="flex-1 rounded-md bg-white/10 py-2 font-bold">
                          いいえ
                        </button>
                        <button
                          onClick={() => (confirm.kind === 'save' ? doSave(i) : confirm.kind === 'load' ? doLoad(i) : doDelete(i))}
                          className={`flex-1 rounded-md py-2 font-bold ${confirm.kind === 'delete' ? 'bg-rose-600' : 'bg-gold-400 text-night-950'}`}
                        >
                          {confirm.kind === 'save' ? '上書きする' : confirm.kind === 'load' ? '再開する' : '消す'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {message && (
            <p className={`anim-pop mx-3 mb-3 rounded-lg px-3 py-2 text-sm font-bold ${message.ok ? 'bg-emerald-800/60 text-emerald-100' : 'bg-rose-900/60 text-rose-100'}`}>
              {message.text}
            </p>
          )}
          <p className="px-4 pb-4 text-[11px] leading-relaxed text-indigo-300/70">
            ※ 進行は自動でも保存されています。冒険の書はこの端末のブラウザに保存されます（別の端末には引き継がれません）。
          </p>
        </div>
      </Modal>
    </div>
  );
}
