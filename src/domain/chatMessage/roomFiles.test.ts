import test from 'node:test';
import assert from 'node:assert/strict';
import { roomFilesOf } from './roomFiles.ts';
import type { ChatMessage } from './schema';

const att = (name: string, mime: string, id?: string) => ({ url: `u/${name}`, name, size: 1, mime, ...(id ? { id } : {}) });
const msg = (id: string, at: string, extra: Partial<ChatMessage>): ChatMessage =>
  ({ id, roomId: 'r', senderId: 's', senderName: '보낸이', text: '', type: 'text', at, readBy: [], isEdited: false, ...extra }) as ChatMessage;

test('예전 메시지(attachment)와 서식 메시지(attachments 여러 개)를 모두 최신순으로', () => {
  const files = roomFilesOf([
    msg('old', '2026-11-01T10:00', { type: 'file', attachment: att('a.pdf', 'application/pdf') }),
    msg('rich', '2026-11-02T10:00', { format: 'rich', attachments: [att('b.png', 'image/png', 'i1'), att('c.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'f1')] }),
    msg('text', '2026-11-03T10:00', {}),
  ]);
  assert.deepEqual(files.map((f) => [f.attachment.name, f.type]), [['b.png', 'image'], ['c.xlsx', 'file'], ['a.pdf', 'file']]);
  assert.equal(new Set(files.map((f) => f.key)).size, 3, '목록 key 가 겹치지 않는다');
});

test('지운 메시지의 파일은 빼고', () => {
  assert.equal(roomFilesOf([msg('d', '2026-11-01', { deletedAt: '2026-11-02', attachments: [att('x.pdf', 'application/pdf')] })]).length, 0);
});
