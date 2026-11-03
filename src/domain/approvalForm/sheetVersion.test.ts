import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSheet, setCellValue } from '@/lib/sheet';
import {
  SHEET_VERSION_MAX_CHARS,
  approvalFormVersionSchema,
  checkNewVersion,
  latestVersions,
  parseVersionKey,
  versionKey,
} from './sheetVersion';

test('버전 키 — 만들고 되읽기, 서식 코드에 @가 있어도 마지막 @v만 본다', () => {
  assert.equal(versionKey('발주', 3), '발주@v3');
  assert.deepEqual(parseVersionKey('발주@v3'), { formId: '발주', version: 3 });
  assert.deepEqual(parseVersionKey('a@b@v12'), { formId: 'a@b', version: 12 });
  assert.equal(parseVersionKey('발주'), null);
  assert.equal(parseVersionKey('발주@vx'), null);
});

test('서식별 최신 버전 번호', () => {
  const m = latestVersions([
    { formId: 'A', version: 1 },
    { formId: 'A', version: 3 },
    { formId: 'B', version: 2 },
    { formId: 'A', version: 2 },
  ]);
  assert.equal(m.get('A'), 3);
  assert.equal(m.get('B'), 2);
  assert.equal(m.get('C'), undefined);
});

test('직전 버전과 틀이 같으면 같다고 알려 새 버전을 쌓지 않게 한다', () => {
  const s = createSheet(3, 3);
  const first = checkNewVersion(s, undefined);
  assert.ok(first.ok && !first.same);
  const again = checkNewVersion(s, JSON.parse(JSON.stringify(s)));
  assert.ok(again.ok && again.same);
  const changed = checkNewVersion(setCellValue(s, 0, 0, '품명'), s);
  assert.ok(changed.ok && !changed.same);
});

test('틀이 한도보다 크면 저장하지 않고 이유를 준다', () => {
  let s = createSheet(1, 1);
  s = setCellValue(s, 0, 0, 'x'.repeat(SHEET_VERSION_MAX_CHARS));
  const r = checkNewVersion(s, undefined);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : '', /너무 큽니다/);
});

test('스키마 — 머리만 온 행은 sheet 없음, 틀이 오면 시트로, 시트 형식이 아니면 없음', () => {
  const head = approvalFormVersionSchema.parse({ formId: 'A', version: 1, createdBy: 'U1', createdAt: '2026-11-03T00:00:00Z' });
  assert.equal(head.sheet, undefined);
  const full = approvalFormVersionSchema.parse({ formId: 'A', version: 1, sheet: createSheet(2, 2), createdBy: 'U1', createdAt: 'x' });
  assert.equal(full.sheet?.rows.length, 2);
  const bad = approvalFormVersionSchema.parse({ formId: 'A', version: 1, sheet: { foo: 1 }, createdBy: 'U1', createdAt: 'x' });
  assert.equal(bad.sheet, undefined);
  assert.equal(approvalFormVersionSchema.safeParse({ formId: 'A', version: 0, createdBy: 'U1', createdAt: 'x' }).success, false);
});
