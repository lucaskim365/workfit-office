import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { capsIngestPayloadSchema, formatPayloadIssue } from './schema';
import { signCapsRequest, verifyCapsRequest } from './verify';
import { attendanceDocId, holidayDocId } from './store';
import { CapsFileStore } from './fileStore';
import { handleCapsIngest } from './handler';

/** 계약 검증 테스트. 러너가 없어 `npx tsx --test server/caps/caps.test.ts`로 실행한다. */

const SECRET = 'test-secret';

const payload = () => ({
  source: 'caps' as const,
  generatedAt: '2026-08-14T14:03:11+09:00',
  windowStart: '2026-07-01',
  attendance: [{
    empId: 1, name: '홍길동', date: '2026-08-11',
    inAt: '2026-08-11T08:12:00+09:00', outAt: '2026-08-11T18:15:00+09:00',
    basicMin: 540, overMin: 15, nightMin: 0, lateMin: 0, totalMin: 555,
    status: 'normal' as const, raw: { decision: 1, inTime: 1932, outTime: 2535 },
  }],
  employees: [{ empId: 1, name: '홍길동', active: true, retireDate: null }],
  holidays: [{ date: null, monthDay: '08-15', recurring: true, name: '광복절' }],
});

test('서명 검증 — 정상·불일치·시각 초과·헤더 누락', () => {
  const body = JSON.stringify(payload());
  const ts = '1755150000';
  const now = Number(ts);
  const sig = signCapsRequest(SECRET, ts, body);

  assert.equal(verifyCapsRequest(SECRET, ts, sig, body, now), 'ok');
  assert.equal(verifyCapsRequest(SECRET, ts, sig.toUpperCase(), body, now), 'ok'); // 대소문자 관용
  assert.equal(verifyCapsRequest(SECRET, ts, signCapsRequest('wrong', ts, body), body, now), 'mismatch');
  assert.equal(verifyCapsRequest(SECRET, ts, sig, `${body} `, now), 'mismatch'); // 바이트 하나만 달라도
  assert.equal(verifyCapsRequest(SECRET, ts, sig, body, now + 301), 'stale');
  assert.equal(verifyCapsRequest(SECRET, undefined, sig, body, now), 'missing');
  assert.equal(verifyCapsRequest(SECRET, 'abc', sig, body, now), 'missing');
});

test('페이로드 스키마 — 계약 예시 통과, 위반은 경로 포함 메시지', () => {
  assert.ok(capsIngestPayloadSchema.safeParse(payload()).success);

  const broken = { ...payload(), attendance: [{ empId: 1, name: '홍길동' }] };
  const result = capsIngestPayloadSchema.safeParse(broken);
  assert.ok(!result.success);
  if (!result.success) assert.match(formatPayloadIssue(result.error), /^attendance\[0\]\./);

  // raw는 모르는 키를 보존 대상으로 통과시킨다.
  const extraRaw = payload();
  (extraRaw.attendance[0].raw as Record<string, unknown>).extra = 9;
  assert.ok(capsIngestPayloadSchema.safeParse(extraRaw).success);
});

test('결정적 문서 ID — 계약 §4', () => {
  assert.equal(attendanceDocId(7, '2026-08-11'), '7_20260811');
  assert.equal(holidayDocId({ recurring: true, monthDay: '08-15', date: null }), 'md_0815');
  assert.equal(holidayDocId({ recurring: false, monthDay: null, date: '2026-10-06' }), '20261006');
});

test('handler — delta 전송과 하트비트 (계약 §1·§4)', async () => {
  // 실시간 에이전트는 창 전체가 아니라 **바뀐 행만** 보낸다. 그러다 보니 두 가지가 계약이 된다.
  //   1) 요청에 없는 문서를 지우면 안 된다(매 요청마다 DB가 비워진다).
  //   2) 세 배열이 모두 빈 요청(하트비트)도 200으로 받아 lastRunAt을 갱신해야 한다
  //      — 웹이 "에이전트가 살아있는지" 판단하는 유일한 신호다.
  const dir = mkdtempSync(join(tmpdir(), 'caps-'));
  try {
    const store = new CapsFileStore(dir);
    const send = async (body: string, now: Date) => {
      const ts = String(Math.floor(now.getTime() / 1000));
      return handleCapsIngest({
        rawBody: body, timestamp: ts, signature: signCapsRequest(SECRET, ts, body),
        secret: SECRET, store, now,
      });
    };

    // 최초 1회: 창 전체
    await send(JSON.stringify(payload()), new Date('2026-08-14T05:00:00.000Z'));

    // 퇴근이 찍혀 그 1건만 다시 온다 — employees·holidays 는 빈 배열
    const delta = payload();
    delta.attendance[0].outAt = '2026-08-11T19:30:00+09:00';
    delta.employees = [];
    delta.holidays = [];
    delta.windowStart = '2026-08-11'; // 이벤트 동기화는 창이 짧다
    const second = await send(JSON.stringify(delta), new Date('2026-08-14T05:01:00.000Z'));

    assert.equal(second.status, 200);
    assert.deepEqual(second.body.upserted, { attendance: 1, employees: 0, holidays: 0 });
    // 바뀐 행은 갱신되고
    assert.equal(store.read('attendance')['1_20260811'].outAt, '2026-08-11T10:30:00.000Z');
    // 이번 요청에 없던 문서는 그대로 남아 있어야 한다
    assert.ok(store.read('employees')['1']);
    assert.ok(store.read('holidays').md_0815);

    // 하트비트: 셋 다 비어 있어도 200 + lastRunAt 갱신
    const heartbeat = { ...payload(), attendance: [], employees: [], holidays: [] };
    const third = await send(JSON.stringify(heartbeat), new Date('2026-08-14T05:31:00.000Z'));

    assert.equal(third.status, 200);
    assert.deepEqual(third.body.upserted, { attendance: 0, employees: 0, holidays: 0 });
    assert.equal(store.read('syncMeta').caps.lastRunAt, '2026-08-14T05:31:00.000Z');
    assert.equal(store.read('syncMeta').caps.lastError, null);
    // 하트비트가 기존 데이터를 지우지 않는다
    assert.equal(Object.keys(store.read('attendance')).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('handler — 200 저장·멱등, 401, 400', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'caps-'));
  try {
    const store = new CapsFileStore(dir);
    const body = JSON.stringify(payload());
    const now = new Date('2026-08-14T05:00:00.000Z');
    const ts = String(Math.floor(now.getTime() / 1000));

    const ok = await handleCapsIngest({
      rawBody: body, timestamp: ts, signature: signCapsRequest(SECRET, ts, body),
      secret: SECRET, store, now,
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.upserted, { attendance: 1, employees: 1, holidays: 1 });

    // 저장 결과: 결정적 ID, Timestamp(ISO) 변환, raw 보존, syncMeta 갱신.
    const attendance = store.read('attendance');
    assert.ok(attendance['1_20260811']);
    assert.equal(attendance['1_20260811'].inAt, '2026-08-10T23:12:00.000Z');
    assert.deepEqual(attendance['1_20260811'].raw, { decision: 1, inTime: 1932, outTime: 2535 });
    assert.equal(store.read('syncMeta').caps.lastError, null);

    // 같은 본문 재전송 → 문서 수 그대로(멱등).
    const again = await handleCapsIngest({
      rawBody: body, timestamp: ts, signature: signCapsRequest(SECRET, ts, body),
      secret: SECRET, store, now,
    });
    assert.equal(again.status, 200);
    assert.equal(Object.keys(store.read('attendance')).length, 1);

    const bad = await handleCapsIngest({
      rawBody: body, timestamp: ts, signature: 'ff'.repeat(32), secret: SECRET, store, now,
    });
    assert.equal(bad.status, 401);
    assert.deepEqual(bad.body, { ok: false, error: 'unauthorized' });

    const brokenBody = JSON.stringify({ ...payload(), source: 'other' });
    const invalid = await handleCapsIngest({
      rawBody: brokenBody, timestamp: ts, signature: signCapsRequest(SECRET, ts, brokenBody),
      secret: SECRET, store, now,
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'invalid_payload');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
