import { HardDrive } from 'lucide-react';
import { useSaveStatus } from '../save/useSaveStatus';

const fmt = new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const BOOT_LABEL: Record<string, string> = {
  first_launch: '初回起動',
  loaded: '前回の続き',
  recovered_from_backup: 'バックアップから復旧',
  migrated_legacy: '旧形式から移行',
  corrupted: '破損（利用者が選択）',
  data_missing: 'データ消失（利用者が選択）',
  storage_unavailable: '保存領域なし',
};

/** セーブの状態（テスト運用中の切り分け用） */
export function SaveStatusPanel() {
  const s = useSaveStatus();
  const rows: [string, string][] = [
    ['保存先', s.backends.join(' ＋ ') || '—'],
    ['消されにくい保存', s.persisted == null ? '不明' : s.persisted ? '許可済み' : '未許可（空き容量不足時に消える可能性）'],
    ['最終セーブ', s.lastSavedAt ? fmt.format(s.lastSavedAt) : '—'],
    ['セーブ回数', `${s.saveCount}回（通し番号 ${s.revision}）`],
    ['起動時の判定', s.boot ? BOOT_LABEL[s.boot.kind] ?? s.boot.kind : '—'],
  ];
  return (
    <details className="rounded-xl bg-night-800/80 px-4 py-3 text-xs ring-1 ring-white/10">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold">
        <HardDrive className="h-4 w-4 text-indigo-200" />
        <span className="flex-1">セーブの状態</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${s.lastError ? 'bg-rose-500' : s.conflict ? 'bg-amber-500 text-night-950' : s.durable ? 'bg-emerald-500 text-night-950' : 'bg-amber-500 text-night-950'}`}>
          {s.lastError ? '失敗あり' : s.conflict ? '停止中' : s.durable ? '正常' : '保存されません'}
        </span>
      </summary>
      <dl className="mt-2 grid gap-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-28 shrink-0 text-indigo-300">{k}</dt>
            <dd className="min-w-0 flex-1 break-words text-indigo-50">{v}</dd>
          </div>
        ))}
        {s.lastError && <p className="mt-1 rounded bg-rose-900/50 p-2 text-rose-100">直近のエラー：{s.lastError}</p>}
      </dl>
    </details>
  );
}
