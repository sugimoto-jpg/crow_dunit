import { describe, expect, it } from 'vitest';
import { normalize } from '../logic';
import { parseLinkCode, suggestTitle } from '../members';

const enc = (s: string) => Buffer.from(s).toString('base64url');

describe('連携コード', () => {
  it('メンションベルの URL と合言葉を取り出す', () => {
    expect(parseLinkCode(`  TQ1.${enc('https://bell.example.com')}.abc~def\n`)).toEqual({ base: 'https://bell.example.com', token: 'abc~def' });
    expect(parseLinkCode(`TQ1.${enc('http://localhost:3000')}.t`)).toEqual({ base: 'http://localhost:3000', token: 't' });
  });
  it('形がちがう・https でないものは受け付けない', () => {
    expect(parseLinkCode('hello')).toBeNull();
    expect(parseLinkCode(`TQ1.${enc('http://bell.example.com')}.t`)).toBeNull();
    expect(parseLinkCode(`TQ1.${enc('javascript:alert(1)')}.t`)).toBeNull();
  });
});

describe('メンションからタスク名', () => {
  it('メンションの部分を取り、最初の行を短く', () => {
    expect(suggestTitle({ senderName: '山田', body: '@杉本 \n見積もりの件、明日までにお願いします' })).toBe('山田さん：見積もりの件、明日までにお願いします');
    expect(suggestTitle({ senderName: '山田', body: 'あ'.repeat(40) })).toBe(`山田さん：${'あ'.repeat(30)}…`);
    expect(suggestTitle({ senderName: '山田', body: '' })).toBe('山田さん：メッセージを確認');
  });
  it('保存データのリンクは https だけ残す', () => {
    const s = normalize({ tasks: [{ id: 'x', title: 't', source: { kind: 'members', messageId: 'm', sender: '山田', url: 'javascript:alert(1)' } }] });
    expect(s.tasks[0].source).toEqual({ kind: 'members', messageId: 'm', sender: '山田', url: null });
  });
});
