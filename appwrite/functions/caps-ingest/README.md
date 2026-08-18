# CAPS 근태 인제스트 Function

사내 C# 에이전트가 ACCESS.mdb에서 뽑은 근태를 주기적으로 밀어 넣는 HTTP 수신 함수.
기존 Vercel 함수(`api/ingest.ts`, Firestore)를 Appwrite로 이관한 것이다.

## 계약

- 원본: `jwheo/CommuteRef/db_decryption/docs/ingest-api-and-schema.md`
- 우리 문서: `jwheo/feat/commute/DESIGN.md`
- 검증·ID 결정·멱등 규칙의 **정본은 `server/caps/**`**(TypeScript, `npx tsx --test server/caps/caps.test.ts`).
  배포 번들이 저장소 코드를 import할 수 없어 `src/main.js`에 같은 계약을 다시 적었다.
  **한쪽을 고치면 반드시 다른 쪽도 고쳐야 한다.**

## 인증

에이전트는 매 요청에 두 헤더를 붙인다.

| 헤더 | 값 |
| --- | --- |
| `x-caps-timestamp` | 유닉스 초 |
| `x-caps-signature` | `HMAC-SHA256(secret, "{timestamp}.{rawBody}")` 의 hex |

서명 대상은 **파싱 전 원문 문자열**이다. 파싱본을 다시 직렬화하면 바이트가 달라져
정상 요청도 거절되므로, 함수는 `req.bodyRaw`를 그대로 쓴다.
시계가 5분(`TIMESTAMP_SKEW_SEC`) 넘게 어긋난 요청은 서명이 맞아도 받지 않는다(재전송 방지).

## 필요 환경변수

| 키 | 설명 |
| --- | --- |
| `CAPS_INGEST_SECRET` | 에이전트 `secret.txt`와 같은 값. **secret으로 등록**한다. |
| `APPWRITE_DATABASE_ID` | 기본 `workfit` |

## 쓰는 컬렉션

`employees`, `attendance`, `holidays`, `syncMeta` — 스키마는 `scripts/appwrite-provision-dev.ts` 참조.

문서 ID는 결정적이라 같은 창을 몇 번 받아도 결과가 같다.

- `attendance`: `{empId}_{YYYYMMDD}`
- `employees`: `{empId}`
- `holidays`: 반복 `md_{MMDD}` / 특정일 `{YYYYMMDD}`
- `syncMeta`: `caps` 고정

삭제는 하지 않는다(창 밖 데이터 보호).

> Appwrite에는 map 타입이 없어 중첩 객체(`raw`·`counts`)는 JSON 문자열로 저장한다.
> 화면에서 읽을 때 `JSON.parse`로 복원한다.

## 로컬 검증

배포 없이 같은 handler를 파일 저장소로 돌린다.

```bash
$env:CAPS_INGEST_SECRET = '<에이전트 secret.txt와 같은 값>'
npx tsx scripts/caps-ingest-dev.ts     # :3020
npx tsx scripts/caps-send-sample.ts    # 샘플 1건 전송
```

## 응답

| 상태 | 본문 |
| --- | --- |
| 200 | `{ ok: true, upserted: { attendance, employees, holidays } }` |
| 400 | `{ ok: false, error: 'invalid_payload', detail: 'attendance[3].date ...' }` |
| 401 | `{ ok: false, error: 'unauthorized' }` — 사유는 싣지 않는다(공격자 힌트 방지) |
| 500 | `{ ok: false, error: 'internal' }` — 사유는 `syncMeta.lastError`에 남는다 |
