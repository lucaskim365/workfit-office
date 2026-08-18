/**
 * Appwrite Function — CAPS 근태 인제스트 수신.
 *
 * 사내 C# 에이전트가 ACCESS.mdb에서 뽑은 최근 N일 창을 주기적으로 POST한다.
 * 기존 Vercel 함수(api/ingest.ts, Firestore)를 Appwrite로 이관한 것이며,
 * 검증·ID 결정·멱등 규칙은 `server/caps/**`(TypeScript, 단위 테스트 보유)와 동일하다.
 * 배포 번들이 저장소 코드를 import할 수 없어 계약을 여기에 다시 적었다 —
 * **server/caps를 고치면 이 파일도 같이 고쳐야 한다.**
 *
 * 원본 계약: jwheo/CommuteRef/db_decryption/docs/ingest-api-and-schema.md
 *
 * 호출(에이전트 IngestUrl):
 *   POST https://<appwrite>/v1/functions/caps-ingest/executions
 *   헤더: x-caps-timestamp(유닉스초), x-caps-signature(hex HMAC-SHA256)
 *   서명 대상: `${timestamp}.${rawBody}` — **파싱 전 원문 문자열**
 *
 * 필요 env(함수 설정):
 *   CAPS_INGEST_SECRET   — 에이전트 secret.txt와 같은 값(secret 처리)
 *   APPWRITE_DATABASE_ID — 기본 'workfit'
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Client, Databases } from 'node-appwrite';
import { z } from 'zod';

/* ------------------------------------------------------------------ 계약 §2 인증 */

const TIMESTAMP_SKEW_SEC = 300;

/** 서명 검증. 반환값은 로그용이며 응답 본문에는 싣지 않는다(계약 §6). */
function verifyRequest(secret, timestamp, signature, rawBody, nowSec) {
  if (!secret || !timestamp || !signature) return 'missing';
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return 'missing';
  // 재전송 방지. 시계가 5분 넘게 어긋난 요청은 서명이 맞아도 받지 않는다.
  if (Math.abs(nowSec - ts) > TIMESTAMP_SKEW_SEC) return 'stale';

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(String(signature).trim().toLowerCase(), 'utf8');
  // timingSafeEqual은 길이가 다르면 던진다. 길이 차이 자체는 비밀이 아니므로 먼저 거른다.
  if (left.length !== right.length) return 'mismatch';
  return timingSafeEqual(left, right) ? 'ok' : 'mismatch';
}

/* ------------------------------------------------------------------ 계약 §3 스키마 */

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이 아닙니다');
const monthDay = z.string().regex(/^\d{2}-\d{2}$/, 'MM-DD 형식이 아닙니다');
const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'ISO8601 일시가 아닙니다');

const CAPS_STATUS = [
  'normal', 'late', 'holiday_work', 'off', 'absent', 'missing_out', 'missing_in', 'unknown',
];

const payloadSchema = z.object({
  source: z.literal('caps'),
  generatedAt: isoDateTime,
  windowStart: dateOnly,
  attendance: z.array(z.object({
    empId: z.number().int(),
    name: z.string(),
    date: dateOnly,
    inAt: isoDateTime.nullable(),
    outAt: isoDateTime.nullable(),
    basicMin: z.number().int(),
    overMin: z.number().int(),
    nightMin: z.number().int(),
    lateMin: z.number().int(),
    totalMin: z.number().int(),
    status: z.enum(CAPS_STATUS),
    // raw는 원본 코드 보존용이라 모르는 키도 통과시킨다(status 재해석 안전망).
    raw: z.looseObject({
      decision: z.number().int(),
      inTime: z.number().int(),
      outTime: z.number().int(),
    }),
  })),
  employees: z.array(z.object({
    empId: z.number().int(),
    name: z.string(),
    active: z.boolean(),
    retireDate: dateOnly.nullable(),
  })),
  holidays: z.array(z.object({
    date: dateOnly.nullable(),
    monthDay: monthDay.nullable(),
    recurring: z.boolean(),
    name: z.string(),
  }).refine(
    (row) => (row.recurring ? row.monthDay !== null : row.date !== null),
    '반복 공휴일은 monthDay, 특정일 공휴일은 date가 필요합니다',
  )),
});

/** 계약 §6의 400 응답 detail 형식("attendance[3].date ...")으로 zod 오류를 줄인다. */
function formatIssue(error) {
  const issue = error.issues?.[0];
  if (!issue) return 'invalid payload';
  const path = issue.path
    .map((part) => (typeof part === 'number' ? `[${part}]` : `.${String(part)}`))
    .join('')
    .replace(/^\./, '');
  return path ? `${path} ${issue.message}` : issue.message;
}

/* ------------------------------------------------------------------ 계약 §4 문서 ID */

/** attendance 문서 ID: `{empId}_{YYYYMMDD}`. */
const attendanceDocId = (empId, date) => `${empId}_${date.replaceAll('-', '')}`;

/** holidays 문서 ID: 반복 `md_{MMDD}` / 특정일 `{YYYYMMDD}`. */
const holidayDocId = (h) =>
  h.recurring && h.monthDay ? `md_${h.monthDay.replace('-', '')}` : (h.date ?? '').replaceAll('-', '');

/* ------------------------------------------------------------------ 저장 */

/**
 * 멱등 upsert. 에이전트가 최근 N일 창을 통째로 다시 보내므로 몇 번을 받아도 결과가
 * 같아야 한다. 삭제는 하지 않는다(창 밖 데이터 보호).
 * Appwrite에는 map 타입이 없어 중첩 객체(raw·counts)는 JSON 문자열로 저장한다.
 */
async function upsert(dbs, DB, collection, id, data, log) {
  try {
    await dbs.createDocument(DB, collection, id, data);
  } catch (e) {
    if (e?.code !== 409) {
      log(`${collection}/${id} 생성 실패: ${e.message}`);
      throw e;
    }
    await dbs.updateDocument(DB, collection, id, data);
  }
}

async function storePayload(dbs, DB, payload, now, log) {
  const stamp = now.toISOString();

  for (const row of payload.employees) {
    await upsert(dbs, DB, 'employees', String(row.empId), {
      empId: row.empId,
      name: row.name,
      active: row.active,
      retireDate: row.retireDate,
      updatedAt: stamp,
    }, log);
  }

  for (const row of payload.attendance) {
    await upsert(dbs, DB, 'attendance', attendanceDocId(row.empId, row.date), {
      empId: row.empId,
      date: row.date,
      inAt: row.inAt,
      outAt: row.outAt,
      basicMin: row.basicMin,
      overMin: row.overMin,
      nightMin: row.nightMin,
      lateMin: row.lateMin,
      totalMin: row.totalMin,
      status: row.status,
      raw: JSON.stringify(row.raw),
      updatedAt: stamp,
    }, log);
  }

  for (const row of payload.holidays) {
    const id = holidayDocId(row);
    // 스키마가 걸러주지만 ID가 비면 저장하지 않는다.
    if (id === '' || id === 'md_') continue;
    await upsert(dbs, DB, 'holidays', id, {
      recurring: row.recurring,
      monthDay: row.monthDay,
      date: row.date,
      name: row.name,
    }, log);
  }

  const counts = {
    attendance: payload.attendance.length,
    employees: payload.employees.length,
    holidays: payload.holidays.length,
  };

  // 실행 메타는 마지막에. 본문 저장이 실패하면 여기까지 오지 않아 lastRunAt이 남지 않는다.
  await upsert(dbs, DB, 'syncMeta', 'caps', {
    lastRunAt: stamp,
    windowStart: payload.windowStart,
    counts: JSON.stringify(counts),
    lastError: null,
  }, log);

  return counts;
}

/* ------------------------------------------------------------------ 엔트리포인트 */

export default async ({ req, res, log, error }) => {
  if (req.method !== 'POST') {
    return res.json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const apiKey = req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY;
  const DB = process.env.APPWRITE_DATABASE_ID || 'workfit';

  // 서명 대상은 파싱 전 원문이다. req.bodyRaw를 쓰고 절대 재직렬화하지 않는다.
  const rawBody = req.bodyRaw ?? '';
  const verdict = verifyRequest(
    process.env.CAPS_INGEST_SECRET ?? '',
    req.headers['x-caps-timestamp'],
    req.headers['x-caps-signature'],
    rawBody,
    Math.floor(Date.now() / 1000),
  );
  if (verdict !== 'ok') {
    // 401 본문은 최소화한다 — 서명이 왜 틀렸는지는 공격자에게도 힌트가 된다.
    log(`unauthorized: ${verdict}`);
    return res.json({ ok: false, error: 'unauthorized' }, 401);
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return res.json({ ok: false, error: 'invalid_payload', detail: 'body is not valid JSON' }, 400);
  }

  const parsed = payloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return res.json({ ok: false, error: 'invalid_payload', detail: formatIssue(parsed.error) }, 400);
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const dbs = new Databases(client);

  try {
    const upserted = await storePayload(dbs, DB, parsed.data, new Date(), log);
    log(`ingested ${JSON.stringify(upserted)}`);
    return res.json({ ok: true, upserted });
  } catch (e) {
    error(`ingest failed: ${e.message}`);
    // 실패 사유를 syncMeta에 남긴다(계약 §4). 이것마저 실패하면 응답만 남긴다.
    try {
      await upsert(dbs, DB, 'syncMeta', 'caps', { lastError: e.message }, log);
    } catch {
      /* noop — 대응은 5xx를 본 에이전트의 재시도가 한다. */
    }
    return res.json({ ok: false, error: 'internal' }, 500);
  }
};
