import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateSubstitute,
  formatMinutes,
  grantEntryOf,
  holidayWorkMinutes,
  isHolidayWorkDoc,
  missingLedgerEntries,
  revokeEntryOf,
  substituteUseMinutes,
  type SubstituteLedgerEntry,
} from './substituteLedger';

const policy = { breakStartTime: '12:30', breakEndTime: '13:30' };
const NOW = '2026-11-13T05:00:00.000Z';
const doc = (over: Record<string, unknown> = {}, fv: Record<string, unknown> = {}) => ({
  id: 'D1', docNo: 'AP-261108-001', docType: '휴일근무', status: '완료', drafterId: 'U1',
  fieldValues: { workDate: '2026-11-08', workKind: '휴일', workStart: '08:30', workEnd: '18:00', ...fv },
  ...over,
});

test('휴일근로 분 — 휴게 겹침 빼기, 자정 넘김, 표시 붙은 시각', () => {
  assert.equal(holidayWorkMinutes(doc({}, { workStart: '08:30', workEnd: '18:00' }), policy), 510);
  assert.equal(holidayWorkMinutes(doc({}, { workStart: '09:00', workEnd: '18:00' }), policy), 480);
  assert.equal(holidayWorkMinutes(doc({}, { workStart: '22:00', workEnd: '02:00' }), policy), 240);
  assert.equal(holidayWorkMinutes(doc({}, { workStart: '14:00', workEnd: '16:15 (수동 입력)' }), policy), 135);
  assert.equal(holidayWorkMinutes(doc({}, { workStart: '', workEnd: '18:00' }), policy), 0);
});

test('시각이 없는 예전 문서는 근무 시간(시간) 칸으로', () => {
  assert.equal(holidayWorkMinutes(doc({}, { workStart: undefined, workEnd: undefined, workHours: 4.5 }), policy), 270);
});

test('휴일근로 판정 — 서식·근무 구분(없으면 주말)', () => {
  assert.equal(isHolidayWorkDoc(doc()), true);
  assert.equal(isHolidayWorkDoc(doc({ docType: '연장근로' })), true);
  assert.equal(isHolidayWorkDoc(doc({}, { workKind: '연장' })), false);
  assert.equal(isHolidayWorkDoc(doc({}, { workKind: undefined, workDate: '2026-11-08' })), true); // 일요일
  assert.equal(isHolidayWorkDoc(doc({}, { workKind: undefined, workDate: '2026-11-10' })), false); // 화요일
  assert.equal(isHolidayWorkDoc(doc({ docType: '휴가' })), false);
});

test('지급 줄 — 510분 근로 → 765분, 유효기간 1년, 완료 문서만', () => {
  const g = grantEntryOf(doc(), policy, NOW)!;
  assert.equal(g.id, 'SHL-G-D1');
  assert.equal(g.kind, 'GRANT');
  assert.equal(g.minutes, 765);
  assert.equal(g.workMinutes, 510);
  assert.equal(g.userId, 'U1');
  assert.equal(g.workDate, '2026-11-08');
  assert.equal(g.expiresOn, '2027-11-08');
  assert.equal(g.sourceDocNo, 'AP-261108-001');
  assert.equal(grantEntryOf(doc({}, { workStart: '09:00', workEnd: '09:01' }), policy, NOW)!.minutes, 1); // 1.5 → 1 버림
  assert.equal(grantEntryOf(doc({ status: '진행중' }), policy, NOW), null);
  assert.equal(grantEntryOf(doc({}, { workKind: '연장' }), policy, NOW), null);
  assert.equal(grantEntryOf(doc({}, { workStart: '' }), policy, NOW), null);
});

test('차감 줄 — 지급과 같은 분을 음수로', () => {
  const r = revokeEntryOf(grantEntryOf(doc(), policy, NOW)!, NOW);
  assert.equal(r.id, 'SHL-R-D1');
  assert.equal(r.kind, 'REVOKE');
  assert.equal(r.minutes, -765);
  assert.equal(r.sourceDocId, 'D1');
});

test('대조 — 빠진 지급·차감만, 두 번 돌려도 그대로', () => {
  const docs = [doc(), doc({ id: 'D2', status: '취소완료' }), doc({ id: 'D3', status: '취소완료' }), doc({ id: 'D4', status: '반려' })];
  const g2 = grantEntryOf({ ...doc({ id: 'D2' }) }, policy, NOW)!; // D2 는 완료 때 지급됐고 그 뒤 취소
  const first = missingLedgerEntries(docs, [g2], policy, NOW);
  assert.deepEqual(first.map((e) => e.id).sort(), ['SHL-G-D1', 'SHL-R-D2']); // D3: 지급 없던 취소 → 아무것도
  assert.deepEqual(missingLedgerEntries(docs, [g2, ...first], policy, NOW), []);
});

test('사용 분 — 종일 480·반차 240·반반차 120', () => {
  assert.equal(substituteUseMinutes(1), 480);
  assert.equal(substituteUseMinutes(0.5), 240);
  assert.equal(substituteUseMinutes(0.25), 120);
  assert.equal(substituteUseMinutes(2), 960);
});

const g = (docId: string, workDate: string, minutes: number, expiresOn?: string): SubstituteLedgerEntry => ({
  id: `SHL-G-${docId}`, userId: 'U1', kind: 'GRANT', minutes, sourceDocId: docId, sourceDocNo: '', workDate,
  expiresOn: expiresOn ?? `${Number(workDate.slice(0, 4)) + 1}${workDate.slice(4)}`, workMinutes: Math.round(minutes / 1.5), createdAt: NOW, createdBy: '', note: '',
});

test('선입선출 — 오래된 지급부터, 만료·취소 제외, 잔여·만료 임박', () => {
  const entries = [
    g('B', '2026-10-04', 600),
    g('A', '2026-09-06', 300),
    g('OLD', '2025-01-05', 480, '2026-01-05'), // 만료
    g('C', '2026-11-08', 765),
    { ...g('C', '2026-11-08', 765), id: 'SHL-R-C', kind: 'REVOKE' as const, minutes: -765 }, // 취소
  ];
  const r = allocateSubstitute(entries, 480, 240, '2026-11-13');
  assert.equal(r.totalMin, 900);
  assert.equal(r.usedMin, 480);
  assert.equal(r.pendingMin, 240);
  assert.equal(r.remainingMin, 180);
  const by = new Map(r.detailList.map((d) => [d.entry.sourceDocId, d]));
  assert.equal(by.get('A')!.usedMin, 300);
  assert.equal(by.get('A')!.status, 'USED');
  assert.equal(by.get('B')!.usedMin, 180);
  assert.equal(by.get('B')!.pendingMin, 240);
  assert.equal(by.get('OLD')!.status, 'EXPIRED');
  assert.equal(by.get('C')!.status, 'REVOKED');
  assert.equal(by.get('C')!.netMin, 0);
  assert.deepEqual(r.detailList.map((d) => d.entry.sourceDocId), ['C', 'B', 'A', 'OLD']); // 최근 근무일 먼저(표시용)
  assert.equal(allocateSubstitute([g('X', '2025-11-20', 480)], 0, 0, '2026-11-13').expiringSoonCount, 1);
});

test('시간 표시', () => {
  assert.equal(formatMinutes(765), '12시간 45분');
  assert.equal(formatMinutes(480), '8시간');
  assert.equal(formatMinutes(30), '30분');
  assert.equal(formatMinutes(0), '0시간');
  assert.equal(formatMinutes(-90), '-1시간 30분');
});
