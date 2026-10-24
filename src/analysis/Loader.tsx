import { useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ClipboardPaste, FileUp, Link2, ShieldCheck } from 'lucide-react';
import { readText } from './format';

/** Google スプレッドシートの URL から、そのシートの CSV を取り出す（「リンクを知っている全員」が閲覧できる場合のみ） */
export async function fetchSheet(url: string): Promise<string> {
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) throw new Error('Google スプレッドシートの URL ではないようです（https://docs.google.com/spreadsheets/d/… の形）。');
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0';
  let res: Response;
  try {
    res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`);
  } catch {
    throw new Error('シートを読み込めませんでした。共有設定が「リンクを知っている全員（閲覧者）」になっているか確認するか、範囲をコピーして貼り付けてください。');
  }
  const text = await res.text();
  if (!res.ok || /^\s*</.test(text)) throw new Error('シートが非公開のため読み込めません。範囲をコピーして「貼り付け」から読み込んでください。');
  return text;
}

export interface WelcomeProps {
  onLoad: (text: string, name: string) => void;
  /** 読み込めない内容ならエラーメッセージを返す */
  validate: (text: string) => string | null;
  intro: ReactNode;
  help: ReactNode;
  sample: string;
  sampleLabel: string;
  placeholder: string;
}

export function Welcome({ onLoad, validate, intro, help, sample, sampleLabel, placeholder }: WelcomeProps) {
  const [tab, setTab] = useState<'paste' | 'file' | 'url'>('paste');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  function accept(t: string, name: string) {
    const err = validate(t);
    if (err) {
      setError(err);
      return;
    }
    onLoad(t, name);
  }

  async function run(job: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await job();
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const tabs: [typeof tab, string, ReactNode][] = [
    ['paste', '貼り付け', <ClipboardPaste key="p" className="h-4 w-4" />],
    ['file', 'CSV ファイル', <FileUp key="f" className="h-4 w-4" />],
    ['url', 'シートの URL', <Link2 key="u" className="h-4 w-4" />],
  ];

  return (
    <div className="mx-auto mt-2 max-w-3xl">
      <div className="text-center">{intro}</div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${tab === id ? 'bg-white text-indigo-700 shadow' : 'text-slate-500'}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {tab === 'paste' && (
          <div className="mt-4">
            <p className="text-sm text-slate-600">スプレッドシートで見出し行ごと範囲を選んでコピー（Ctrl+C / ⌘+C）し、下に貼り付けてください。</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={placeholder}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-indigo-500 focus:outline-none"
            />
            <button
              disabled={!text.trim()}
              onClick={() => accept(text, '貼り付けた表')}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-40"
            >
              分析する
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {tab === 'file' && (
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600">スプレッドシートの「ファイル → ダウンロード → CSV」で保存したファイルを選びます（UTF-8 / Shift_JIS）。</p>
            <input
              ref={file}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) run(async () => accept(await readText(f), f.name));
              }}
            />
            <button
              onClick={() => file.current?.click()}
              className="mx-auto mt-3 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white shadow hover:bg-indigo-700"
            >
              <FileUp className="h-5 w-5" />
              CSV を選ぶ
            </button>
          </div>
        )}

        {tab === 'url' && (
          <div className="mt-4">
            <p className="text-sm text-slate-600">
              Google スプレッドシートの URL（分析したいシートを開いた状態のもの）を貼り付けます。共有が「リンクを知っている全員」になっているシートだけ読めます。
              社外秘の数字は「貼り付け」をおすすめします。
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                disabled={!url.trim() || busy}
                onClick={() => run(async () => accept(await fetchSheet(url.trim()), 'Google スプレッドシート'))}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {busy ? '読込中…' : '読み込む'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          <button onClick={() => onLoad(sample, 'サンプルデータ')} className="text-sm font-semibold text-indigo-600 hover:underline">
            {sampleLabel}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 sm:p-6">
        {help}
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          数字はこのブラウザの中だけで計算・保存され、外部のサーバーには送信されません（URL 読み込み時の Google への取得を除く）。
        </p>
      </div>
    </div>
  );
}
