import { useEffect, useState } from 'react';
import { BookMarked, Download, KeyRound, Loader2, Save, Trash2, Upload, X } from 'lucide-react';
import { useGame } from '../store/gameStore';
import { getSaveManager, type SlotInfo } from '../save';
import { useSaveStatus } from '../save/useSaveStatus';
import { JOBS, CHARACTER_NAMES } from '../data/jobs';
import { HERO_SPRITES } from '../data/sprites';
import { QUESTS } from '../data/quests';
import { LECTURES } from '../data/lectures';
import { GLOSSARY } from '../data/glossary';
import { levelFromExp } from '../data/levels';
import { Modal } from './ui';
import { SaveCodePanel } from './SaveCodePanel';
import { sfx } from '../audio/sfx';

type Pending = { kind: 'save' | 'load' | 'delete'; index: number } | null;
type Mode = 'save' | 'load' | 'code';

const fmt = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

/** 冒険の書：3つのスロットにセーブ／ロード＋保存コード */
export function SaveMenu() {
  const mode = useGame((s) => s.saveMenu);
  if (!mode) return null;
  return <SaveMenuInner key={mode} initialMode={mode} />;
}

function SaveMenuInner({ initialMode }: { initialMode: 'save' | 'load' }) {
  const onboarded = useGame((s) => s.onboarded);
  const setSaveMenu = useGame((s) => s.setSaveMenu);
  const status = useSaveStatus();
  const m = getSaveManager();
  // 冒険を始める前はロードのみ
  const [mode, setMode] = useState<Mode>(onboarded ? initialMode : 'load');
  const [slots, setSlots] = useState<(SlotInfo | null)[] | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => m?.listSlots().then(setSlots);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!m) return null;

  const close = () => {
    sfx.cancel();
    setSaveMenu(null);
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      // 一覧を読み直すまで操作を受け付けない（古い一覧のまま上書き確認なしで保存するのを防ぐ）
      await refresh();
      setPending(null);
      setBusy(false);
    }
  };

  const doSave = (i: number) =>
    run(async () => {
      const ok = await m.saveSlot(i);
      if (ok) sfx.levelUp();
      else sfx.hurt();
    });
  const doLoad = (i: number) =>
    run(async () => {
      if (await m.loadSlot(i)) sfx.jobChange();
      else sfx.hurt();
    });
  const doDelete = (i: number) =>
    run(async () => {
      await m.deleteSlot(i);
      sfx.cancel();
    });

  const onSlot = (i: number) => {
    const filled = !!slots?.[i - 1];
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

  const tabs: { id: Mode; label: string; Icon: typeof Save }[] = onboarded
    ? [
        { id: 'save', label: 'セーブ', Icon: Save },
        { id: 'load', label: 'ロード', Icon: Upload },
        { id: 'code', label: '保存コード', Icon: KeyRound },
      ]
    : [
        { id: 'load', label: 'ロード', Icon: Upload },
        { id: 'code', label: '保存コード', Icon: KeyRound },
      ];

  return (
    <div className="relative z-[60]">
      <Modal onClose={close}>
        <div className="rpg-window overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <BookMarked className="h-5 w-5 text-gold-300" />
            <h2 className="font-pixel flex-1 text-lg text-gold-300">冒険の書</h2>
            {(busy || status.saving) && <Loader2 className="h-4 w-4 animate-spin text-indigo-200" aria-label="処理中" />}
            <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 ring-1 ring-white/20" aria-label="閉じる">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-1 p-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} role="tablist">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  sfx.select();
                  setMode(id);
                  setPending(null);
                }}
                className={`flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold ${
                  mode === id ? 'bg-gradient-to-r from-indigo-500 to-violet-600' : 'bg-white/5 text-indigo-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {mode === 'code' ? (
            <div className="px-3 pb-3">
              <p className="mb-2 px-1 text-xs leading-relaxed text-indigo-200">
                保存コードは今の進行をまるごと文字列にしたものです。別の端末・ブラウザ・アプリに引き継いだり、万一データが消えたときの控えに使えます。
              </p>
              <SaveCodePanel onImported={() => setSaveMenu(null)} />
            </div>
          ) : (
            <>
              <p className="px-4 pt-1 text-xs leading-relaxed text-indigo-200">
                {mode === 'save'
                  ? '今の進行（レベル・ゴールド・職業・虎の巻・用語・討伐記録・現在地・設定）を冒険の書に記録します。'
                  : '記録した冒険の書から再開します。'}
              </p>
              <div className="grid gap-2 p-3">
                {slots == null && <p className="py-6 text-center text-sm text-indigo-300">読み込み中…</p>}
                {slots?.map((slot, idx) => {
                  const i = idx + 1;
                  const d = slot?.data;
                  const confirm = pending?.index === i ? pending : null;
                  return (
                    <div key={i} className={`rounded-xl ring-1 ${slot ? 'bg-night-800/90 ring-white/15' : 'bg-black/25 ring-white/10'}`}>
                      <button
                        onClick={() => onSlot(i)}
                        disabled={busy || (mode === 'load' && !slot)}
                        className="flex w-full items-center gap-3 p-2.5 text-left disabled:cursor-default"
                      >
                        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-indigo-900 to-night-950 ring-1 ring-white/10">
                          {d && (
                            <img
                              src={HERO_SPRITES[d.player.jobId][d.player.gender].src}
                              alt=""
                              className="absolute inset-x-0 bottom-0 mx-auto h-[62px] object-contain"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-gold-300">
                            冒険の書 {i}
                            {slot?.recovered && <span className="ml-1 text-amber-300">（バックアップから読込）</span>}
                          </div>
                          {d && slot ? (
                            <>
                              <div className="truncate text-[15px] font-black">
                                {d.player.name || CHARACTER_NAMES[d.player.gender]}
                                <span className="ml-1.5 text-xs font-bold text-indigo-200">
                                  Lv.{levelFromExp(d.player.exp)} {JOBS[d.player.jobId].name}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-indigo-200">
                                <span>{d.player.gold.toLocaleString()}G</span>
                                <span>
                                  討伐 {QUESTS.filter((q) => d.progress.questRecords[q.id]).length}/{QUESTS.length}
                                </span>
                                <span>
                                  虎の巻 {d.progress.completedLectures.length}/{LECTURES.length}
                                </span>
                                <span>
                                  用語 {d.progress.masteredTerms.length}/{GLOSSARY.length}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[10px] tabular-nums text-indigo-300/70">{fmt.format(slot.savedAt)} に記録</div>
                            </>
                          ) : (
                            <div className="text-sm text-indigo-300/60">― 記録なし ―</div>
                          )}
                        </div>
                        {mode === 'save' ? <Download className="h-5 w-5 shrink-0 text-gold-300" /> : slot && <Upload className="h-5 w-5 shrink-0 text-gold-300" />}
                      </button>

                      {slot && !confirm && (
                        <div className="flex justify-end px-2.5 pb-2">
                          <button
                            onClick={() => {
                              sfx.select();
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
                            {confirm.kind === 'save' && 'この冒険の書に上書きしますか？（上書き前の内容はバックアップに1世代残ります）'}
                            {confirm.kind === 'load' && 'この記録から再開しますか？ 今の進行は冒険の書に記録していなければ戻せません。'}
                            {confirm.kind === 'delete' && 'この冒険の書を消しますか？'}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => setPending(null)} className="flex-1 rounded-md bg-white/10 py-2 font-bold">
                              いいえ
                            </button>
                            <button
                              disabled={busy}
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
            </>
          )}
          <p className="px-4 pb-4 text-[11px] leading-relaxed text-indigo-300/70">
            ※ 進行は自動でもこまめに保存されています（保存先：{status.backends.join(' ＋ ') || '—'}）。
            冒険の書と保存コードは、その時点の記録を別に残しておくためのものです。
          </p>
        </div>
      </Modal>
    </div>
  );
}
