# 근태 인제스트 API & Firestore 스키마 (웹 팀 전달용)

> 대상: 그룹웨어(**React + Vite** on Vercel) 담당. `/api/ingest`는 **Vercel 서버리스 함수(Node)** 로 구현(Next.js 아님 — 프론트 프레임워크와 무관하게 `api/` 폴더의 함수로 배포됨).
> 이 문서만 있으면 웹 쪽 작업이 가능하도록 **입력 계약 + 저장 스키마**만 정의한다.
> CAPS/Access 내부는 알 필요 없음 — 사내 PC 에이전트가 정제해서 아래 형식으로 보내준다.
> 이 계약은 에이전트 쪽 e2e 테스트로 **실제 검증됨**(서명·페이로드가 아래와 동일).

---

## 1. 역할 (한눈에)

```
[사내 PC 에이전트]  --HMAC 서명 POST-->  [Vercel /api/ingest]  -->  [Firestore]
   (읽기+정제)                              (검증 → 멱등 upsert)
```

- 웹의 `/api/ingest`는 **수신·검증·저장만** 한다. 스케줄/폴링 없음(트리거는 PC 쪽 에이전트).
- **클라이언트(브라우저)에서 근태 데이터 쓰기 금지.** 오직 이 서버 라우트(Admin SDK)만 쓴다.
- 에이전트는 `.mdb` 변경을 실시간 감시하다가 **바뀐 행만** 보낸다(보통 펀치 후 1~5초). 한 번의 요청이
  창 전체가 아니라 **부분(delta)** 이다 → 반드시 **멱등 upsert**로 처리(중복 금지, 최신값으로 덮어쓰기).

### 전송 특성 (실시간 에이전트 기준)

| | 값 |
|---|---|
| 보통 요청 크기 | `attendance` **1~5건** (출퇴근 1건 = 1행) |
| 첫 실행 / `--resync` | 창 전체(45일 ≈ 500~1,600건) 1회 |
| 하트비트 | 30분마다, **세 배열이 모두 빈** 요청 |
| 재시도 | 4xx/5xx면 최대 3회. 실패하면 다음 회차가 같은 행을 다시 보냄 |

> ⚠️ **빈 배열 요청을 400으로 막지 말 것.** `attendance`·`employees`·`holidays`가 모두 `[]`인 요청은
> 정상적인 **하트비트**다. 저장할 행은 없지만 `syncMeta/caps.lastRunAt`은 갱신해야 한다 — 웹에서
> "에이전트가 살아있는지"를 판단하는 유일한 신호다. (현재 zod 스키마는 빈 배열을 통과시키므로
> 서버 코드는 그대로 두면 된다.)
>
> ⚠️ **"한 번의 요청 = 그 시점의 전체"가 아니다.** 요청에 없는 직원·날짜를 "사라졌다"고 보고
> 지우면 안 된다. 삭제는 하지 않는다(§4).

---

## 2. 인증 (HMAC-SHA256)

에이전트는 로컬 시크릿 파일의 값으로 요청에 서명한다. 서버는 같은 시크릿(환경변수)으로 재계산해 비교한다.

**헤더**

| 헤더 | 내용 |
|---|---|
| `Content-Type` | `application/json` |
| `X-Caps-Timestamp` | 요청 생성 시각 (Unix epoch **초**, 문자열) |
| `X-Caps-Signature` | `HMAC_SHA256( secret, timestamp + "." + rawBody )` → 소문자 hex |

**서버 검증 (의사코드)**

```ts
const raw = await readRawBody(req);              // ⚠️ 파싱 전 "원문 바이트"로 서명 검증
const ts  = req.headers['x-caps-timestamp'];
const sig = req.headers['x-caps-signature'];

// 1) 재전송 방지: 시각 오차 ±5분
if (Math.abs(Date.now()/1000 - Number(ts)) > 300) return res.status(401);

// 2) 서명 비교 (타이밍 안전 비교)
const expected = hmacSha256Hex(process.env.CAPS_INGEST_SECRET, `${ts}.${raw}`);
if (!timingSafeEqual(expected, sig)) return res.status(401);

const payload = JSON.parse(raw);
```

- **주의(중요):** 서명은 `JSON.parse` 하기 전 **원문 바이트** 기준. ⚠️ **Vercel Node 함수는 `application/json` body를 자동 파싱해 `req.body`에 넣기 때문에**, 그 파싱본을 다시 직렬화하면 바이트가 달라져 서명이 깨진다. **원문(raw body)을 직접 확보**해야 함:
  - 방법 A: Node 함수에서 `req` 스트림을 직접 읽어 raw 문자열 확보(자동 파싱 우회) 후 HMAC 검증 → 그 다음 `JSON.parse`.
  - 방법 B: 서명 검증을 **Edge 런타임**(`await request.text()`로 원문 획득)에서 하고, 저장은 Node에서. (Edge는 Firebase Admin SDK 못 씀에 유의)
  - 어느 쪽이든 "받은 그대로의 바이트"로 `HMAC(secret, ts + "." + raw)` 재계산해 비교.
- 선택: 사무실 고정 IP가 있으면 IP 허용목록을 추가로.

---

## 3. 요청 본문 (에이전트가 보내는 JSON)

`POST /api/ingest`

형식은 아래 그대로지만, 세 배열에는 **직전 전송 이후 실제로 바뀐 행만** 담긴다(§1 전송 특성).
아래 예시는 필드를 다 보여주려고 각 배열에 1건씩 넣은 것이고, 실제로는 대부분
`attendance` 1건에 `employees`·`holidays`는 `[]`다.

```jsonc
{
  "source": "caps",
  "generatedAt": "2026-08-12T14:03:11+09:00",
  "windowStart": "2026-06-28",          // 이 실행이 다시 보낸 구간의 시작일
  "attendance": [
    {
      "empId": 1,                        // = CAPS tuser.id (안정 키). 이름으로 조인 금지
      "name": "홍길동",
      "date": "2026-08-11",
      "inAt": "2026-08-11T08:12:00+09:00",   // null = 미기록
      "outAt": "2026-08-11T18:15:00+09:00",  // null = 미기록
      "basicMin": 540,                   // 분 단위 (540 = 9h)
      "overMin": 15,
      "nightMin": 0,
      "lateMin": 0,
      "totalMin": 63,
      "status": "normal",                // normal|late|holiday_work|off|absent|missing_out|missing_in|unknown
      "raw": { "decision": 1, "inTime": 1932, "outTime": 2535 }  // 원본 코드 보존
    }
  ],
  "employees": [
    { "empId": 1, "name": "홍길동", "active": true, "retireDate": null }
  ],
  "holidays": [
    { "date": null, "monthDay": "08-15", "recurring": true, "name": "광복절" }
  ]
}
```

### 필드 타입

| 경로 | 타입 | 비고 |
|---|---|---|
| `source` | string | 항상 `"caps"` |
| `generatedAt` | ISO8601(+09:00) | 에이전트 실행 시각 |
| `windowStart` | `YYYY-MM-DD` | 재동기화 구간 시작 |
| `attendance[].empId` | int | **문서 키의 근간**. `employees[].empId`와 동일 체계 |
| `attendance[].date` | `YYYY-MM-DD` | |
| `attendance[].inAt/outAt` | ISO8601 \| null | KST. null=미기록(결근/미퇴근) |
| `attendance[].*Min` | int | 분 단위 소요시간 |
| `attendance[].status` | enum | 아래 표. **`raw.decision`가 진짜 원본** |
| `attendance[].raw` | object | 원본 코드 그대로. status 재해석용 안전망 |
| `employees[].active` | bool | 재직 여부(retireDate 없음 = true) |
| `holidays[].recurring` | bool | true = 매년 반복 고정 공휴일(현재 데이터 전부 이 형태) |
| `holidays[].monthDay` | `MM-DD` \| null | 반복 공휴일의 월-일 |
| `holidays[].date` | `YYYY-MM-DD` \| null | 특정 연도 날짜(있을 경우). 반복이면 null |

### status 코드 (⚠️ 실데이터 패턴 기반 추정 — 확정 전까지 `raw.decision` 신뢰)

실제 DB 1,612행 전수 분석으로 나온 매핑. 관찰된 원본 코드는 0~16(15종).

| status | 원본 decision | 패턴 | 의미(추정) |
|---|---|---|---|
| `normal` | 0, 1, 2 | 출퇴근 정상, 지각 0 | 정상 근무(연장 유무 무관) |
| `late` | 3, 4, 5 | `lateMin > 0`, 출근 있음 | 지각 |
| `holiday_work` | 6 | 기본 0·연장만·정상 펀치 | 휴일근무 |
| `off` | 7 | in·out 없음 (370건) | 휴무(결근과 구분) |
| `absent` | 8 | in·out 없음 (547건) | 결근/미출근 |
| `missing_out` | 10, 11, 12 | 출근O, 퇴근X | 퇴근 미기록 |
| `missing_in` | 14, 15, 16 | 출근X, 퇴근O | 출근 미기록 |
| `unknown` | 그 외 | — | 미정(현재 데이터엔 없음) |

> - `off`(7) vs `absent`(8)은 **둘 다 미펀치**라 데이터만으론 확정 불가 → CAPS 관리화면과 대조 필요.
> - `raw.decision`을 항상 함께 저장하므로, 나중에 매핑을 바꿔도 재계산 가능.

---

## 4. 저장 규칙 (멱등 upsert)

에이전트는 같은 날짜를 여러 번 보낸다(당일 기록은 계속 갱신됨). **결정적 문서 ID + merge upsert**로 처리:

| 컬렉션 | 문서 ID | 소스 |
|---|---|---|
| `employees` | `{empId}` | `employees[]` |
| `attendance` | `{empId}_{YYYYMMDD}` | `attendance[]` |
| `holidays` | 반복: `md_{MMDD}` / 특정일: `{YYYYMMDD}` | `holidays[]` |
| `syncMeta` | `caps` | 실행 메타 |

- `set(doc, { merge: true })`로 덮어쓰기 → 재전송해도 중복 없음.
- **삭제는 하지 않음.** 에이전트가 보내는 건 "바뀐 행"이라 **요청에 없는 문서가 정상**이다.
  없는 것을 지우면 매 요청마다 DB가 비워진다. 창 안에서 사라진 기록 처리는 추후 정책으로.
- 배치 쓰기는 Firestore `writeBatch`(최대 500 ops/배치)로 나눠서.
- 매 요청 끝에 `syncMeta/caps` 갱신: `lastRunAt`, `windowStart`, `counts`, `lastError(null)`.
  - `counts`는 **그 요청에 담긴 건수**(누적 총계가 아님). 보통 1~2, 하트비트면 0.
  - `windowStart`는 그 요청이 훑은 구간의 시작일. 변경 이벤트면 최근 3일, 전수 동기화면 45일 전이라
    **요청마다 값이 달라진다**(정상).
  - 하트비트(빈 배열)도 여기까지 도달해 `lastRunAt`을 갱신해야 한다.

**신선도 판정(웹 화면용):** `lastRunAt`이 30분 넘게 갱신되지 않으면 에이전트가 멈춘 것으로 본다
(정상이면 변경이 없어도 30분마다 하트비트가 온다).

---

## 5. Firestore 스키마

```
employees/{empId}
  empId:      number
  name:       string
  active:     boolean
  retireDate: string | null          // "YYYY-MM-DD"
  email:      string | null          // ↓ CAPS엔 없음. 계정 매핑 위해 수기 입력
  updatedAt:  timestamp (serverTimestamp)

attendance/{empId}_{YYYYMMDD}
  empId:    number
  date:     string                   // "YYYY-MM-DD"
  inAt:     timestamp | null
  outAt:    timestamp | null
  basicMin, overMin, nightMin, lateMin, totalMin: number
  status:   string                   // normal|late|holiday_work|off|absent|missing_out|missing_in|unknown
  raw:      { decision:number, inTime:number, outTime:number }
  updatedAt: timestamp (serverTimestamp)

holidays/{md_MMDD | YYYYMMDD}
  recurring: boolean          // 현재 CAPS 데이터는 전부 매년 반복(양력 고정)
  monthDay:  string | null    // "MM-DD" (반복 공휴일)
  date:      string | null    // "YYYY-MM-DD" (특정일)
  name:      string
  // 참고: 설날/추석(음력)·대체공휴일은 CAPS nHoliday 에 없음 → 웹에서 별도 소스 필요

syncMeta/caps
  lastRunAt:   timestamp
  windowStart: string
  counts:      { attendance:number, employees:number, holidays:number }
  lastError:   string | null

// 계정 매핑(웹에서 관리) — Firebase Auth uid ↔ 직원
userMap/{authUid}
  empId: number
  role:  "member" | "admin"
```

- `inAt/outAt`는 문자열로 오지만 저장 시 **Firestore Timestamp로 변환** 권장(쿼리·정렬 편의).
- `email`은 CAPS에 비어 있으므로 웹에서 `employees` 또는 `userMap`에 수기로 채운다(로그인 계정 연결용).

---

## 6. 응답 형식

```jsonc
// 200 OK
{ "ok": true, "upserted": { "attendance": 630, "employees": 14, "holidays": 8 } }

// 401 (서명/시각 불일치)  → 본문 최소화
{ "ok": false, "error": "unauthorized" }

// 400 (스키마 위반)
{ "ok": false, "error": "invalid_payload", "detail": "attendance[3].date missing" }
```

에이전트는 2xx를 성공으로 보고 재시도하지 않는다. 4xx/5xx면 로그 남기고 재시도(최대 3회) 후 실패 종료.

---

## 7. 보안 규칙 (읽기 측)

쓰기는 서버만, 읽기는 본인/관리자만.

```
match /attendance/{docId} {
  allow read: if isSelf(docId) || isAdmin();
  allow write: if false;          // 서버(Admin SDK) 전용
}
match /employees/{empId} {
  allow read: if request.auth != null;
  allow write: if false;
}
function isAdmin() { return request.auth.token.role == 'admin'; }
function isSelf(docId) {
  return request.auth != null &&
    string(get(/databases/$(database)/documents/userMap/$(request.auth.uid)).data.empId)
      == docId.split('_')[0];
}
```

---

## 8. Vercel 환경변수

| 이름 | 용도 |
|---|---|
| `CAPS_INGEST_SECRET` | 에이전트와 공유하는 HMAC 시크릿 (사내 PC의 `secret.txt`와 동일 값) |
| `FIREBASE_SERVICE_ACCOUNT` | Firestore 쓰기용 서비스계정 JSON (Admin SDK) |

---

## 9. 웹 팀 체크리스트

- [ ] `/api/ingest`에서 **원문 문자열로 HMAC 검증** 후 파싱
- [ ] 타임스탬프 ±5분 검사
- [ ] 결정적 ID로 **merge upsert** (중복 금지)
- [ ] **빈 배열 요청(하트비트)을 200으로 받고 `lastRunAt` 갱신** — 400으로 막지 않기
- [ ] 요청에 없는 문서를 삭제하지 않기(delta 전송이라 정상)
- [ ] `inAt/outAt` → Timestamp 변환, `raw` 보존
- [ ] `syncMeta/caps` 갱신 + 실패 시 `lastError`
- [ ] 보안 규칙 적용, 클라이언트 쓰기 차단
- [ ] `userMap`으로 로그인 계정 ↔ empId 연결 UI
- [ ] `status` 코드 의미를 CAPS와 대조해 확정(추정값이므로)
