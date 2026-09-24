import { useState } from 'react';
import { ClipboardCopy, KeyRound, Upload } from 'lucide-react';
import { getSaveManager } from '../save';
import { sfx } from '../audio/sfx';

/** 保存コードの書き出し／読み込み（端末・アプリ間の引き継ぎ、控え） */
export function SaveCodePanel({ allowExport = true, onImported }: { allowExport?: boolean; onImported?: () => void }) {
  const m = getSaveManager();
  const [code, setCode] = useState('');
  const [exported, setExported] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!m) return null;

  const doExport = async () => {
    const c = m.exportCode();
    setExported(c);
    sfx.select();
    try {
      await navigator.clipboard.writeText(c);
      setMsg({ ok: true, text: '保存コードをコピーしました。メモ帳などに貼り付けて保管してください。' });
    } catch {
      setMsg({ ok: true, text: '下の保存コードを長押し（または選択）してコピーし、保管してください。' });
    }
  };

  const doImport = async () => {
    setBusy(true);
    const r = await m.importCode(code);
    setBusy(false);
    if (r.ok) {
      sfx.levelUp();
      setMsg({ ok: true, text: '保存コードから復元しました。' });
      setCode('');
      onImported?.();
    } else {
      sfx.hurt();
      setMsg({ ok: false, text: r.error });
    }
  };

  return (
    <div className="grid gap-3">
      {allowExport && (
        <div>
          <button onClick={doExport} className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-sm font-bold ring-1 ring-white/15">
            <ClipboardCopy className="h-4 w-4" /> 保存コードを書き出す（控えを取る）
          </button>
          {exported && (
            <textarea
              id="save-code-export"
              readOnly
              value={exported}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 h-20 w-full resize-none rounded-lg bg-black/40 p-2 font-mono text-[10px] leading-tight text-indigo-100 ring-1 ring-white/10"
              aria-label="書き出した保存コード"
            />
          )}
        </div>
      )}
      <div>
        <label htmlFor="save-code-import" className="flex items-center gap-1 text-xs font-bold text-gold-300">
          <KeyRound className="h-3.5 w-3.5" /> 保存コードで復元
        </label>
        <textarea
          id="save-code-import"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AQS1: で始まる保存コードを貼り付け"
          className="mt-1 h-16 w-full resize-none rounded-lg bg-black/40 p-2 font-mono text-[11px] text-indigo-50 outline-none ring-1 ring-white/15 focus:ring-gold-400"
        />
        <button
          onClick={doImport}
          disabled={!code.trim() || busy}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-2.5 text-sm font-bold disabled:opacity-40"
        >
          <Upload className="h-4 w-4" /> このコードで復元する
        </button>
      </div>
      {msg && <p className={`rounded-lg px-3 py-2 text-xs font-bold ${msg.ok ? 'bg-emerald-900/60 text-emerald-100' : 'bg-rose-900/60 text-rose-100'}`}>{msg.text}</p>}
    </div>
  );
}
