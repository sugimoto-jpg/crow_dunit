// ============================================================
// メンバーズ連携：メンションベルが受け取ったメンションを読む
// メンションベルで発行した「連携コード」をこのブラウザに保存し、その合言葉で読みに行く。
// コードの中身（メンションベルのURL・合言葉）はリポジトリには入れない。
// ============================================================

export interface MembersLink {
  base: string;
  token: string;
}

export interface MembersMessage {
  id: string;
  chatName: string | null;
  senderName: string;
  body: string;
  mention: 'me' | 'all';
  sentAt: string;
  readAt: string | null;
  url: string | null;
}

const KEY = 'aidma-task-quest-members';

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

/** 連携コード「TQ1.<URL>.<合言葉>」を読む（前後の空白や改行は無視） */
export function parseLinkCode(code: string): MembersLink | null {
  const m = code.trim().match(/^TQ1\.([A-Za-z0-9_-]+)\.(\S+)$/);
  if (!m) return null;
  try {
    const base = fromBase64Url(m[1]);
    const u = new URL(base);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return null;
    return { base: u.origin, token: m[2] };
  } catch {
    return null;
  }
}

export function loadLink(): MembersLink | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as MembersLink) : null;
    return v && typeof v.base === 'string' && typeof v.token === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function saveLink(link: MembersLink | null): void {
  try {
    if (link) localStorage.setItem(KEY, JSON.stringify(link));
    else localStorage.removeItem(KEY);
  } catch {
    /* 保存できない環境では、開いている間だけ使える */
  }
}

export class LinkError extends Error {
  constructor(
    message: string,
    readonly revoked = false,
  ) {
    super(message);
  }
}

async function call<T>(link: MembersLink, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(link.base + path, {
      ...init,
      headers: { Authorization: `Bearer ${link.token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      cache: 'no-store',
    });
  } catch {
    throw new LinkError('メンションベルにつながりませんでした。通信状態を確認してね。');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) throw new LinkError(data.error ?? '連携コードが使えなくなっています。', true);
  if (!res.ok) throw new LinkError(data.error ?? '読み込めませんでした。');
  return data;
}

export async function fetchMessages(link: MembersLink): Promise<MembersMessage[]> {
  return (await call<{ messages: MembersMessage[] }>(link, '/api/task-quest/messages')).messages ?? [];
}

export async function markRead(link: MembersLink, ids: string[]): Promise<void> {
  await call(link, '/api/task-quest/read', { method: 'POST', body: JSON.stringify({ ids }) });
}

/** メッセージからタスク名の候補を作る（本文の最初の行を短く） */
export function suggestTitle(m: Pick<MembersMessage, 'senderName' | 'body'>): string {
  const line = m.body
    .replace(/@\S+/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  const text = line ? (line.length > 30 ? line.slice(0, 30) + '…' : line) : 'メッセージを確認';
  return `${m.senderName}さん：${text}`;
}
