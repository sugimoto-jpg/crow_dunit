import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useSaveStatus } from '../save/useSaveStatus';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = 'aq:install-hint-dismissed';

function isStandalone() {
  return (
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = () => isIOS() || /Android/.test(navigator.userAgent);

// Android(Chrome) の「インストール」案内は起動直後に来るので、画面が出る前から受け取っておく
let deferred: InstallPrompt | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
  });
}

/**
 * スマホのブラウザで開いているときに「ホーム画面に追加」を勧める。
 * ホーム画面から開くと、ブラウザが保存データを自動で消しにくくなる（iPhone の Safari は、しばらく開かないサイトのデータを消すことがある）。
 * クラウド保存が使える（claude.ai で開いている）とき・すでにホーム画面から開いているときは出さない。
 */
export function InstallHint({ compact = false }: { compact?: boolean }) {
  const s = useSaveStatus();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const cloud = s.backends.some((b) => b.startsWith('クラウド'));
  // claude.ai の中で開いているとき（アーティファクト）はホーム画面に追加しても保存は残らないので出さない
  const inClaude = 'claude' in window;
  if (cloud || inClaude || hidden || isStandalone() || !isMobile()) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* 次回も表示されるだけ */
    }
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    deferred = null;
    setCanPrompt(false);
  };

  return (
    <div className={`relative rounded-xl bg-indigo-950/80 text-xs leading-relaxed text-indigo-100 ring-1 ring-gold-400/40 ${compact ? 'p-2.5' : 'p-3'}`}>
      <button onClick={dismiss} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full text-indigo-300" aria-label="案内を閉じる">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-1.5 pr-6 font-bold text-gold-300">
        <Smartphone className="h-4 w-4" /> ホーム画面に追加しておくと安心です
      </div>
      <p className="mt-1">
        進行はこの端末に自動で保存されます。ホーム画面から開くと、アプリのように使えて保存データも消えにくくなります。
      </p>
      {isIOS() ? (
        <p className="mt-1 text-indigo-200">
          Safari 下の <b>共有ボタン（□に↑）</b> →「<b>ホーム画面に追加</b>」をタップ。
        </p>
      ) : canPrompt ? (
        <button onClick={install} className="mt-2 w-full rounded-lg bg-gold-400 py-2 font-bold text-night-950">
          ホーム画面に追加する
        </button>
      ) : (
        <p className="mt-1 text-indigo-200">
          ブラウザのメニュー（︙）→「<b>ホーム画面に追加</b>」または「<b>アプリをインストール</b>」をタップ。
        </p>
      )}
      <p className="mt-1 text-[11px] text-indigo-300/80">別の端末で続きを遊ぶときは「冒険の書 → 保存コード」で引き継げます。</p>
    </div>
  );
}
