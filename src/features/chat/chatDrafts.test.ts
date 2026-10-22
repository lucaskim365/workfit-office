import test from 'node:test';
import assert from 'node:assert/strict';
import { withDraft, draftPreview, type ChatDrafts } from './chatDrafts';
import type { RichNode } from '@/domain/chatMessage/richBody';

const para = (...content: RichNode[]): RichNode => ({ type: 'paragraph', content });
const doc = (...blocks: RichNode[]): RichNode => ({ type: 'doc', content: blocks });
const text = (t: string): RichNode => ({ type: 'text', text: t });

test('작성 중인 글을 방별로 넣고, 비우면 지운다', () => {
  const a = withDraft({}, 'r1', doc(para(text('안녕'))), '2026-10-22T03:00:00.000Z');
  assert.deepEqual(Object.keys(a), ['r1']);
  assert.equal(a.r1.text, '안녕');
  assert.equal(a.r1.at, '2026-10-22T03:00:00.000Z');
  const b = withDraft(a, 'r2', doc(para(text('두 번째'))));
  assert.deepEqual(Object.keys(b).sort(), ['r1', 'r2']);
  const c = withDraft(b, 'r1', doc(para()));
  assert.deepEqual(Object.keys(c), ['r2']);
  assert.deepEqual(Object.keys(a), ['r1']); // 입력 불변
});

test('아직 올리지 않은 사진은 보관하지 않는다 (다시 열면 파일이 없음)', () => {
  const d = withDraft({}, 'r1', doc(para(text('사진 '), { type: 'image', attrs: { attachmentId: 'img-1' } })));
  assert.deepEqual(d.r1.doc, doc(para(text('사진 '))));
  assert.equal(d.r1.text, '사진');
  // 사진만 있던 글은 남길 것이 없으니 지운다
  const only = withDraft({ r1: d.r1 } as ChatDrafts, 'r1', doc(para({ type: 'image', attrs: { attachmentId: 'img-2' } })));
  assert.deepEqual(only, {});
});

test('목록 미리보기는 한 줄로', () => {
  const d = withDraft({}, 'r1', doc(para(text('첫 줄')), para(text('둘째 줄'))));
  assert.equal(draftPreview(d.r1), '첫 줄 둘째 줄');
});
