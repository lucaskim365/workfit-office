import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatMessage } from '@/domain/chatMessage/schema';
import { applyLiveChange, replayChanges } from './threadCache';

const msg = (id: string, at: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  roomId: 'R',
  senderId: 'U1',
  senderName: '홍',
  text: id,
  type: 'text',
  attachment: null,
  replyTo: null,
  approvalPayload: null,
  at,
  readBy: ['U1'],
  isEdited: false,
  reactions: {},
  ...over,
});

const ids = (list: ChatMessage[]) => list.map((m) => m.id);

test('새 메시지는 시간 순서 자리에 붙는다', () => {
  const list = [msg('a', '2026-10-28T09:00:00'), msg('c', '2026-10-28T09:02:00')];
  assert.deepEqual(ids(applyLiveChange(list, { roomId: 'R', message: msg('d', '2026-10-28T09:03:00') })), ['a', 'c', 'd']);
  assert.deepEqual(ids(applyLiveChange(list, { roomId: 'R', message: msg('b', '2026-10-28T09:01:00') })), ['a', 'b', 'c']);
});

test('같은 메시지가 바뀌면 그 자리에서 바꾼다(읽음 표시 등)', () => {
  const list = [msg('a', '2026-10-28T09:00:00'), msg('b', '2026-10-28T09:01:00')];
  const out = applyLiveChange(list, { roomId: 'R', message: msg('a', '2026-10-28T09:00:00', { readBy: ['U1', 'U2'] }) });
  assert.deepEqual(ids(out), ['a', 'b']);
  assert.deepEqual(out[0].readBy, ['U1', 'U2']);
});

test('지운 메시지는 빠진다', () => {
  const list = [msg('a', '2026-10-28T09:00:00'), msg('b', '2026-10-28T09:01:00')];
  assert.deepEqual(ids(applyLiveChange(list, { roomId: 'R', removedId: 'a' })), ['b']);
});

test('먼저 붙여 둔 내 메시지는 저장된 메시지가 오면 하나로 합쳐진다', () => {
  const list = [msg('R-optimistic-1', '2026-10-28T09:00:00', { text: '안녕' })];
  const out = applyLiveChange(list, { roomId: 'R', message: msg('R-2', '2026-10-28T09:00:01', { text: '안녕' }) });
  assert.deepEqual(ids(out), ['R-2']);
});

test('같은 말을 빠르게 두 번 보내도 하나로 줄지 않는다', () => {
  const list = [msg('R-optimistic-1', '2026-10-28T09:00:00', { text: '네' }), msg('R-optimistic-2', '2026-10-28T09:00:00', { text: '네' })];
  const out = applyLiveChange(list, { roomId: 'R', message: msg('R-3', '2026-10-28T09:00:01', { text: '네' }) });
  assert.deepEqual(ids(out), ['R-optimistic-2', 'R-3']);
});

test('받기 시작한 뒤의 변경만, 그 방 것만 다시 얹는다', () => {
  const fetched = [msg('a', '2026-10-28T09:00:00')];
  const log = [
    { at: 100, change: { roomId: 'R', message: msg('old', '2026-10-28T08:00:00') } },
    { at: 200, change: { roomId: 'R', message: msg('b', '2026-10-28T09:01:00') } },
    { at: 210, change: { roomId: 'X', message: msg('x', '2026-10-28T09:02:00', { roomId: 'X' }) } },
  ];
  assert.deepEqual(ids(replayChanges(fetched, log, 'R', 150)), ['a', 'b']);
});
