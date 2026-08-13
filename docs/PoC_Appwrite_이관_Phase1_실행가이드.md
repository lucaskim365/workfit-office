# Phase 1 PoC 실행 가이드 — chatMessage · notification → Appwrite

| 항목 | 내용 |
|------|------|
| 목적 | Firestore→Appwrite 이관의 **가/부 판정 게이트**(계획서 Phase 1). repo 2개를 Appwrite로 전환해 CRUD·Realtime·성능을 실측 |
| 대상 repo | `chatMessage`(CRUD·페이지네이션·중첩 직렬화) / `notification`(**Realtime**) |
| 방식 | 어댑터 교체 — `VITE_DB_DRIVER` 스위치. **features·UI·domain 무변경** |
| 계획서 | [Firestore_Appwrite 이관 단계별 계획서](../../../../Study/database/doc/Firestore_Appwrite_이관_단계별_계획서_2026-08-12.md) |

---

## 1. 이 PoC가 바꾼 코드 (요약)

| 파일 | 역할 |
|------|------|
| `src/shared/lib/appwrite.ts` | Appwrite Client/Databases 초기화(firebase.ts 대칭) + `$id` 규격 검증 |
| `src/shared/lib/dbDriver.ts` | `VITE_DB_DRIVER` 스위치 (storage.ts 선례) |
| `src/data/chatMessage/chatMessage.repo.ts` | 백엔드 어댑터화(Memory/Firestore/**Appwrite**). 공개 인터페이스 불변 |
| `src/data/notification/notification.repo.ts` | 동일 + **Appwrite Realtime**(`client.subscribe`) |
| `scripts/appwrite-schema.ts` | **IaC** — DB·컬렉션·속성·인덱스·권한 멱등 생성(`npm run appwrite:schema`) |
| `src/vite-env.d.ts`, `.env.example` | 신규 env 타입/예시 |
| `package.json` | `appwrite`(웹 SDK)·`node-appwrite`(IaC) 추가 + `appwrite:schema` 스크립트 |

> 설계 규율 준수: `firebase/*`·`appwrite`를 import하는 곳은 여전히 **repo 계층뿐**. 파생 로직(방별 필터·미읽음 도출·정렬)은 백엔드와 분리돼 그대로 남는다.

---

## 2. Appwrite 스키마 생성 — IaC 스크립트 (콘솔 수작업 불요)

`scripts/appwrite-schema.ts` 가 Database·Collection·Attribute·Index·Permission 을 **코드로 멱등 생성**한다(재실행 안전). 콘솔 클릭 대신 명령 한 줄.

### 2.1 서버 API 키 발급 (1회)
- Console(`https://appwrite.widdyax.com/console`) → `workfit-intra` → **API Keys → Create** → 스코프 `databases.read`·`databases.write`(collections/attributes/indexes 포함) → 키 복사.

### 2.2 `.env.local` 에 값 채우기
```bash
APPWRITE_ENDPOINT="https://appwrite.widdyax.com/v1"   # 또는 VITE_APPWRITE_ENDPOINT 재사용
APPWRITE_PROJECT_ID="6a6bf85e002acb7f71d6"            # workfit-intra
APPWRITE_DATABASE_ID="workfit"                         # 원하는 DB id
APPWRITE_API_KEY="…서버 비밀키…"                       # ⚠️ VITE_ 아님, Git 커밋 금지
```

### 2.3 실행
```bash
npm run appwrite:schema
```
→ `workfit` DB + **보존 대상 컬렉션 27개**(속성·인덱스·권한)가 생성된다. 다시 돌려도 **존재 항목은 건너뛴다**(멱등). 컬렉션 추가/수정은 스크립트의 `COLLECTIONS` 배열만 고치면 된다.

### 생성되는 스키마 (스크립트 `COLLECTIONS` 가 SSOT)

Phase 1 실측은 아래 2개만 쓰지만, 스크립트는 **보존 카탈로그 전체(27개)**를 한 번에 만든다(계획서 §1.4 · Phase 0 완료분).

| 그룹 | 컬렉션 |
|------|--------|
| 메신저·알림(PoC) | `chatMessages`, `chatRooms`, `notifications` |
| 마스터/조직 | `users`, `departments`, `positions`, `jobTitles`, `companyInfo`, `companySites`, `commonCodes` |
| 권한/설정 | `authRoles`, `roleGroups`, `sysAdmins`, `backupPolicies`, `interfaces`, `approvalForms`, `approvalRouteRules`, `approvalRules` |
| 거래처/품목 | `vendors`, `items`, `creditLimits` |
| 결재 | `approvalDocs`, `documentExecutions`, `executionHistory`(서브컬렉션 평탄화) |
| 기타 | `systemLogs`, `issues`, `counters` |

- 변환 규칙: z.string→String · z.number().int()·금액(원)→Integer · z.boolean→Boolean · z.enum(ASCII)→Enum, 한글 enum→String · z.array(string)→String[] · **중첩객체/배열-of-객체/record→JSON 문자열** · nullable/optional/default→required=false.
- 제외: `approvalProcess`·`absence`·`succession`(localStorage 전용), 영업 8종(폐기).
- ⚠️ size·required 는 휴리스틱 — 운영 ETL 전 필드별 재검토 권장.

- **권한**: PoC 검증용 `Any` CRUD(스크립트 `POC_PERMISSIONS`). Realtime 수신엔 **read 권한 필수**(보고서 이슈: 권한 [] → 이벤트 미수신). **운영 전 좁힐 것**(계획서 §6).
- **중첩 객체**(attachment/replyTo/approvalPayload)는 Appwrite 속성 제약상 **JSON 문자열**로 저장. 앱 repo가 저장/복원 시 직렬화.
- ⚠️ 문서 `$id` = 앱 메시지/알림 id. Appwrite 규격(≤36자, `[a-zA-Z0-9._-]`, 선행 특수문자 불가). `appwrite.ts`의 `assertAppwriteId` 가 위반 시 즉시 에러로 조기 검출.

> 콘솔 수작업을 선호하면 위 표대로 Databases → Create collection → Attributes/Indexes 를 손으로 만들어도 동일하다.

---

## 3. 로컬 실행

`.env.local` 에 추가:

```bash
VITE_DB_DRIVER="appwrite"
VITE_APPWRITE_ENDPOINT="https://appwrite.widdyax.com/v1"
VITE_APPWRITE_PROJECT_ID="6a6bf85e002acb7f71d6"   # workfit-intra
VITE_APPWRITE_DATABASE_ID="workfit"                # 2.1에서 만든 DB id
```

- **Platforms 등록(CORS)**: Console → 프로젝트 → **Platforms → Add Web** → 호스트 `localhost`(개발), 배포 시 웹 도메인 추가. 미등록 시 브라우저 요청이 CORS로 차단됨.
- 실행: `npm install && npm run dev`
- 롤백: `VITE_DB_DRIVER="firestore"` 로 되돌리면 즉시 현행 복귀(코드 변경 0).

---

## 4. 검증 항목 (Phase 1 DoD)

| 검증 | 방법 | 기대 |
|------|------|------|
| 채팅 전송 | 메신저에서 메시지 전송 | Appwrite `chatMessages` 에 문서 생성, 화면 반영 |
| 첨부 | 이미지/파일 첨부 | Garage 업로드 URL이 `attachment`(JSON)에 저장·표시 |
| 방 조회/정렬 | 방 진입 | 시간 오름차순 로드(페이지네이션 100+건 포함) |
| 미읽음/읽음 | 방 진입 | `readBy` 갱신, 미읽음 배지 감소 |
| **Realtime** | 다른 세션에서 알림 생성 | `notification` 구독이 **수초 내** 자동 갱신(폴링 아님) |
| 성능 | 목록 로드 시간 | Firestore 대비 회귀 없음 |
| 롤백 | 드라이버 전환 | firestore/appwrite 왕복에 코드 변경 불요 |

**→ 위가 모두 통과하면 Phase 2(격리 3영역)·Phase 3(전면 전환) 진행 확정.**

---

## 5. PoC에서 드러난 실이관 고려사항 (미리 기록)

1. **중첩 객체 직렬화** — Appwrite 속성은 중첩 object를 직접 담기 어려워 attachment/replyTo/approvalPayload를 **JSON 문자열**로 저장했다. 전면 이관 시 이 규칙을 스키마 표준으로 확정하거나, 정규화(별도 테이블)를 택한다.
2. **Realtime 채널 표기** — Appwrite 버전에 따라 `...collections.{c}.documents`(구) vs `...tables.{t}.rows`(1.9 TablesDB)로 다르다. PoC는 **양쪽 채널을 동시 구독**해 흡수했다. 설치 버전 확정 후 하나로 고정 권장.
3. **Realtime = 전체 재조회** — 이벤트 수신 시 목록을 재조회해 `onSnapshot`의 "전체 목록" 시맨틱을 재현했다(증분 병합 아님). 알림처럼 소규모엔 충분, 대용량 컬렉션엔 증분 반영 고려.
4. **권한과 구독** — 컬렉션 read 권한이 없으면 Realtime 이벤트가 오지 않는다(설치 보고서 이슈 재확인). Phase 6 권한 설계 시 필수 점검.
5. **문서 ID 규격** — `$id` 제약으로 일부 레거시 ID는 매핑 규칙이 필요할 수 있다(`assertAppwriteId` 가 조기 검출).

---
*본 PoC는 `npm run build`(tsc + vite) 통과를 확인했다. appwrite 웹 SDK 26.x 기준.*
