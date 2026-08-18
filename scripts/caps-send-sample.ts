import { signCapsRequest } from '../server/caps/verify';

/**
 * 에이전트 흉내 — 서명된 샘플 요청으로 로컬 수신 서버를 검증한다.
 *
 * 실행(수신 서버를 먼저 띄운 뒤):
 *   $env:CAPS_INGEST_SECRET = '<수신 서버와 같은 값>'
 *   npx tsx scripts/caps-send-sample.ts
 *
 * 정상 200, 서명 불일치 401, 시각 초과 401, 스키마 위반 400의 네 케이스를 순서대로
 * 보내고 결과를 출력한다. C# 에이전트의 서명 방식(HMAC_SHA256(secret, ts + "." + body),
 * 소문자 hex, epoch 초)과 동일하다.
 */
const URL = process.env.CAPS_INGEST_URL ?? 'http://localhost:3020/api/ingest';
const secret = process.env.CAPS_INGEST_SECRET?.trim();
if (!secret) {
  console.error('CAPS_INGEST_SECRET이 필요합니다.');
  process.exit(1);
}

const samplePayload = {
  source: 'caps',
  generatedAt: new Date().toISOString(),
  windowStart: '2026-08-01',
  attendance: [
    {
      empId: 1, name: '홍길동', date: '2026-08-14',
      inAt: '2026-08-14T08:12:00+09:00', outAt: '2026-08-14T18:15:00+09:00',
      basicMin: 540, overMin: 15, nightMin: 0, lateMin: 0, totalMin: 555,
      status: 'normal', raw: { decision: 1, inTime: 1932, outTime: 2535 },
    },
    {
      empId: 2, name: '김철수', date: '2026-08-14',
      inAt: '2026-08-14T09:40:00+09:00', outAt: null,
      basicMin: 0, overMin: 0, nightMin: 0, lateMin: 100, totalMin: 0,
      status: 'missing_out', raw: { decision: 10, inTime: 2020, outTime: 0 },
    },
  ],
  employees: [
    { empId: 1, name: '홍길동', active: true, retireDate: null },
    { empId: 2, name: '김철수', active: true, retireDate: null },
  ],
  holidays: [
    { date: null, monthDay: '08-15', recurring: true, name: '광복절' },
  ],
};

async function send(label: string, body: string, timestamp: string, signature: string): Promise<void> {
  const response = await fetch(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-caps-timestamp': timestamp,
      'x-caps-signature': signature,
    },
    body,
  });
  console.log(`[${label}] ${response.status} ${await response.text()}`);
}

const body = JSON.stringify(samplePayload);
const ts = String(Math.floor(Date.now() / 1000));

await send('정상', body, ts, signCapsRequest(secret, ts, body));
await send('서명 불일치', body, ts, 'deadbeef'.repeat(8));
const staleTs = String(Math.floor(Date.now() / 1000) - 600);
await send('시각 초과', body, staleTs, signCapsRequest(secret, staleTs, body));
const broken = JSON.stringify({ ...samplePayload, attendance: [{ empId: 3, name: '박', date: '2026-08-14' }] });
await send('스키마 위반', broken, ts, signCapsRequest(secret, ts, broken));

// 멱등 확인: 같은 본문 재전송 → 200이어야 하고 .caps-local 문서 수는 그대로여야 한다.
await send('재전송(멱등)', body, ts, signCapsRequest(secret, ts, body));
