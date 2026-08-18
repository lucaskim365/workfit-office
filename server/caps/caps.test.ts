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
