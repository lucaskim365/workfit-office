import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, setCellMeta, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS } from './approvalSheet';
import { pickXlsxValues, xlsxChanges } from './xlsxPreview';

/** 0 머리글(날짜·내역·금액), 1~2 내용 줄 — 날짜 칸에는 틀이 '2026.'을 미리 써 둠 */
function shape(): Sheet {
  let s = createSheet(3, 3);
  ['날짜', '내역', '금액'].forEach((t, c) => (s = setCellValue(s, 0, c, t)));
  for (let r = 1; r <= 2; r++) {
    s = setCellValue(s, r, 0, '2026.');
    s = setCellMeta(s, APPROVAL_NS.input, r, 0, { type: 'text' });
    s = setCellMeta(s, APPROVAL_NS.input, r, 1, { type: 'text' });
    s = setCellMeta(s, APPROVAL_NS.input, r, 2, { type: 'currency' });
  }
  return s;
}

test('바뀌는 칸 — 빈 칸에 들어가면 채움, 있던 값이 달라지면 바뀜, 없어지면 지워짐', () => {
  const s = shape();
  const at = (r: number, c: number) => cellKey(r, s.cols[c]);
  const base = { [at(1, 1)]: '점심', [at(1, 2)]: '12000', [at(2, 1)]: '택시' };
  const values = { [at(1, 0)]: '2026-10-01', [at(1, 1)]: '저녁', [at(1, 2)]: '12000', [at(2, 0)]: '', [at(2, 1)]: '' };
  const got = xlsxChanges({ shape: s, base, values });
  assert.deepEqual(
    got.map((ch) => [ch.r, ch.c, ch.kind, ch.before, ch.after]),
    [
      [1, 0, 'add', '2026.', '2026-10-01'], // 틀에 미리 쓴 글자만 있던 칸은 빈 칸으로 본다
      [1, 1, 'change', '점심', '저녁'],
      [2, 0, 'clear', '2026.', ''], // 미리 쓴 글자가 없어지는 것도 지워짐
      [2, 1, 'clear', '택시', ''],
      // (1,2) 는 같은 값
    ]
  );
});

test('뺀 칸은 화면 값으로 되돌린다 — 화면에 값이 없던 칸은 키를 지운다, 사람 칸 ID 도 같이', () => {
  const base = { '1:b': '점심' };
  const values = { '1:a': '2026-10-01', '1:b': '저녁', '2:b': '홍길동' };
  const picked = pickXlsxValues({ base, baseRefs: { '1:b': 'U1' }, values, refs: { '2:b': 'U2' }, excluded: new Set(['1:a', '1:b', '2:b']) });
  assert.deepEqual(picked.values, { '1:b': '점심' });
  assert.deepEqual(picked.refs, { '1:b': 'U1' });
  // 아무것도 안 빼면 그대로
  assert.equal(pickXlsxValues({ base, baseRefs: {}, values, refs: {}, excluded: new Set() }).values, values);
});
