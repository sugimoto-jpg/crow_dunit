import { emptyState, normalize, type State } from './logic';

/** このブラウザの localStorage に保存する（外部には送信しない） */
export const KEY = 'aidma-task-quest-v1';

export function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function save(s: State): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** 別のタブで保存されたら読み直す */
export function onExternalChange(fn: (s: State) => void): () => void {
  const h = (e: StorageEvent) => {
    if (e.key === KEY) fn(load());
  };
  window.addEventListener('storage', h);
  return () => window.removeEventListener('storage', h);
}
