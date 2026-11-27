import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, setCellMeta, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS } from './approvalSheet';
import { expandRepeats, setRepeatSection } from './repeatRows';
import { clearXlsxSection, dropEmptyXlsxLock, readXlsxLock, xlsxLockAfterUpload, xlsxLockedCells } from './xlsxLock';

/**
 * 0 머리글(날짜·내역·금액), 1~2 내역 줄(반복 구간), 3 비고(입력 칸)
 *   날짜 칸에는 틀이 '2026.'을 미리 써 둠
 */
function form(): Sheet {
  let s = createSheet(4, 3);
  ['날짜', '내역', '금액'].forEach((t, c) => (s = setCellValue(s, 0, c, t)));
  for (const r of [1, 2]) {
    s = setCellValue(s, r, 0, '2026.');
    s = setCellMeta(s, APPROVAL_NS.input, r, 0, { type: 'text' });
    s = setCellMeta(s, APPROVAL_NS.input, r, 1, { type: 'text' });
    s = setCellMeta(s, APPROVAL_NS.input, r, 2, { type: 'currency' });
  }
  s = setCellMeta(s, APPROVAL_NS.input, 3, 0, { type: 'text' });
  return setRepeatSection(s, 1, 2, '내역');
}

const idOf = (s: Sheet) => (s.rowMeta[APPROVAL_NS.repeat]?.['1'] as { id: string }).id;

test('엑셀을 올리면 — 엑셀 값이 든 칸만 잠그고, 엑셀에 없어 빈 칸은 그대로 쓸 수 있다', () => {
  const tpl = form();
  const id = idOf(tpl);
  const shape = expandRepeats(tpl, { [id]: 1 }); // 3줄로
  const at = (r: number, c: number) => cellKey(r, shape.cols[c]);
  // 엑셀에는 날짜·금액만 — 내역은 빈 칸으로 들어온다. 둘째 줄 날짜는 틀에 미리 쓴 글자 그대로(값이 아니다)
  const values = {
    [at(1, 0)]: '2026-10-01', [at(1, 1)]: '', [at(1, 2)]: '12000',
    [at(2, 0)]: '2026.', [at(2, 1)]: '', [at(2, 2)]: '8000',
    [at(3, 0)]: '2026-10-03', [at(3, 1)]: '', [at(3, 2)]: '500',
  };
  const lock = xlsxLockAfterUpload({ shape, base: {}, values });
  assert.deepEqual(lock, { [id]: [`0:${shape.cols[0]}`, `0:${shape.cols[2]}`, `1:${shape.cols[2]}`, `2:${shape.cols[0]}`, `2:${shape.cols[2]}`] });
  assert.deepEqual([...xlsxLockedCells(shape, lock)], ['1:0', '1:2', '2:2', '3:0', '3:2']);
  // 표를 통째로 바꾼 올리기(목록 엑셀) — 틀에 미리 쓴 글자와 같은 값도 잠근다(번호 열의 1, 2, 3…)
  const whole = xlsxLockAfterUpload({ shape, base: {}, values, whole: true });
  assert.deepEqual([...xlsxLockedCells(shape, whole)], ['1:0', '1:2', '2:0', '2:2', '3:0', '3:2']);
});

test('엑셀이 건드리지 않은 표는 잠그지 않고, 전에 잠근 것은 그대로 둔다', () => {
  const tpl = form();
  const id = idOf(tpl);
  const at = (r: number, c: number) => cellKey(r, tpl.cols[c]);
  // 표 밖(비고)만 바뀜
  const base = { [at(1, 1)]: '점심' };
  assert.deepEqual(xlsxLockAfterUpload({ shape: tpl, base, values: { ...base, [at(3, 0)]: '메모' } }), {});
  const prev = { [id]: [`0:${tpl.cols[2]}`] };
  assert.deepEqual(xlsxLockAfterUpload({ shape: tpl, base, values: { ...base, [at(3, 0)]: '메모' }, prev }), prev);
});

test('엑셀 내용 지우기 — 늘어난 줄을 되돌리고 표를 처음 모양으로, 표 아래 값은 제자리로', () => {
  const tpl = form();
  const id = idOf(tpl);
  const extras = { [id]: 2 }; // 4줄(1~4), 비고는 5행
  const shape = expandRepeats(tpl, extras);
  const at = (r: number, c: number) => cellKey(r, shape.cols[c]);
  const values = { [at(1, 0)]: '2026-10-01', [at(1, 1)]: '손으로 쓴 내역', [at(4, 2)]: '500', [at(5, 0)]: '비고 글', [at(0, 0)]: '날짜' };
  const refs = { [at(3, 1)]: 'u1', [at(5, 0)]: 'u2' };
  const got = clearXlsxSection(tpl, extras, values, refs, { [id]: ['0:A'], other: ['0:B'] }, id);
  assert.deepEqual(got.extras, {});
  // 표의 입력 칸은 비고(값 키가 없으면 틀에 미리 쓴 글자가 보인다), 비고는 5행 → 3행
  assert.deepEqual(got.values, { [at(0, 0)]: '날짜', [at(3, 0)]: '비고 글' });
  assert.deepEqual(got.refs, { [at(3, 0)]: 'u2' });
  assert.deepEqual(got.lock, { other: ['0:B'] });
});

test('엑셀 내용 지우기 — 엑셀로 줄어든 표도 서식 줄 수로 되돌린다', () => {
  const tpl = form();
  const id = idOf(tpl);
  const extras = { [id]: -1 }; // 1줄(1), 비고는 2행
  const shape = expandRepeats(tpl, extras);
  const at = (r: number, c: number) => cellKey(r, shape.cols[c]);
  const got = clearXlsxSection(tpl, extras, { [at(1, 2)]: '500', [at(2, 0)]: '비고 글' }, {}, { [id]: ['0:x'] }, id);
  assert.deepEqual(got.extras, {});
  assert.deepEqual(got.values, { [at(3, 0)]: '비고 글' });
  assert.deepEqual(got.lock, {});
});

test('빈 칸은 잠금에서 뺀다 — 잠근 칸이 숨은 행 등으로 비워지면 다시 쓸 수 있게', () => {
  let s = form();
  const id = idOf(s);
  const [a, , c] = s.cols;
  s = setCellValue(s, 1, 2, '12000');
  s = setCellValue(s, 2, 0, '');
  assert.deepEqual(dropEmptyXlsxLock(s, { [id]: [`0:${c}`, `1:${a}`, `1:${c}`], gone: ['0:x'] }), { [id]: [`0:${c}`] });
});

test('잠금 읽기 — 깨진 값은 빈 값', () => {
  assert.deepEqual(readXlsxLock('{"a":["0:A",3],"b":"x"}'), { a: ['0:A'] });
  assert.deepEqual(readXlsxLock('[1]'), {});
  assert.deepEqual(readXlsxLock(undefined), {});
});
