import { Component, type ReactNode } from 'react';
import { getSaveManager } from '../save';

interface State {
  error: Error | null;
  code: string;
}

/**
 * 描画中の例外で真っ白な画面になるのを防ぐ。
 * セーブデータには触れず、再読み込みと保存コードの控えを案内する。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, code: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bg-sky safe-top safe-bottom safe-x fixed inset-0 z-[80] overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-10">
          <div className="rpg-window p-5">
            <h1 className="font-pixel text-xl text-rose-300">表示中にエラーが発生しました</h1>
            <p className="mt-2 text-sm leading-relaxed text-indigo-100">
              セーブデータは保護されています（自動で消したり初期化したりはしません）。まず再読み込みをお試しください。
            </p>
            <p className="mt-2 break-all rounded bg-black/30 p-2 font-mono text-[11px] text-rose-200">{this.state.error.message}</p>
            <button onClick={() => location.reload()} className="mt-4 w-full rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 py-3 font-bold text-night-950">
              再読み込み
            </button>
            <button
              onClick={() => {
                try {
                  this.setState({ code: getSaveManager()?.exportCode() ?? '' });
                } catch {
                  this.setState({ code: '保存コードを作れませんでした' });
                }
              }}
              className="mt-2 w-full rounded-lg bg-white/10 py-2.5 text-sm font-bold"
            >
              念のため保存コードを表示する
            </button>
            {this.state.code && (
              <textarea
                readOnly
                value={this.state.code}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-2 h-24 w-full resize-none rounded-lg bg-black/40 p-2 font-mono text-[10px] text-indigo-100"
                aria-label="保存コード"
              />
            )}
          </div>
        </div>
      </div>
    );
  }
}
