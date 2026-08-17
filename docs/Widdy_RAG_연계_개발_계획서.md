# Widdy(위디) 챗봇 — RAG 연계 개발 계획서

> 작성일: 2026-08-17 · 대상: 퀵 도크 우측 슬라이드 패널의 "Widdy(위디)" 챗봇을 사내 문서 기반 RAG로 실기능화
> 관련 문서: [[메신저_개발_계획서.md]], [[그룹웨어_개발_계획서.md]], `데이터_계층_구현현황.md`, `DB_이관_대비_설계원칙.md`
> 관련 메모리: [[db-migration-firestore-to-appwrite]], [[storage-migration-firebase-to-garage]], [[sign-api-token-client-exposed]]
> 정본 UI: `src/app/shell/QuickDock.tsx` — `ChatbotPanel`(현재 목업)
> 백엔드 실측 기준: test-server1 (2026-08-17 분석)

---

## 1. 배경 · 현황

퀵 도크(`src/app/shell/QuickDock.tsx`)의 3종 도구(그룹웨어·**Widdy**·메신저) 중 메신저는 실기능 개발이 끝났고([[메신저_개발_계획서.md]]), 이번엔 **Widdy 챗봇**을 사내 문서 기반 질의응답(RAG)으로 실기능화한다.

**프론트 현황 = 껍데기 목업.**
- `ChatbotPanel`(`QuickDock.tsx:363`)은 **하드코딩된 가짜 대화**(생산 실적·불량률 고정 텍스트)를 렌더한다.
- 입력창이 `<input>`이 아니라 `<span>메시지를 입력하세요…</span>`, 전송 버튼(↑)에 `onClick` 없음 → **입력·전송 불가**.
- `useState`·`fetch`·API·LLM 연동 **전무**. 순수 표시용.

**백엔드 현황 = RAG 프로토타입 가동 중(실데이터).** test-server1에 다음이 systemd로 상시 가동되며, **전부 `127.0.0.1` 로컬 전용(외부 미노출)**이다.

| 구성요소 | 구현/모델 | 엔드포인트 |
|---|---|---|
| 벡터DB | `ai-postgres` = **pgvector**/pg16, DB `ai_vector_db`, 테이블 `doc_embeddings`, **HNSW 코사인 인덱스** | `127.0.0.1:5433` |
| 임베딩 | `ai-embed.service` — **BGE-M3**(ONNX int8, **1024차원**, 다국어), FastAPI | `127.0.0.1:8900 /embed` |
| LLM | `ollama.service` — **qwen2.5:7b**(온프레미스) | `127.0.0.1:11434` |
| RAG 체인 | `rag.py` — top-4 코사인 검색 → 환각방지 한국어 프롬프트 → Ollama(temp 0.1) | (CLI 스크립트) |
| 문서 동기화 | `garage_sync.py` — **Garage→pgvector 증분**(ETag), 다포맷 추출(txt/pdf/xlsx/hwp/이미지 OCR) | `ai-garage-sync.timer` |
| 테스트 UI | `ai-rag-ui.service` — **Streamlit** 데모 | `127.0.0.1:8501` |

**벡터DB 실 적재량**: `garage` 소스 **1,718 청크**(실제 워크핏 문서 — 개발 일정 계획서.xlsx, 인테리어 견적서.pdf, 채팅 첨부 등) + `pilot` 소스 743 청크(테스트 코퍼스). → **"벡터DB 연계 + 기본 기능 테스트 완료"는 사실.** Garage 업로드 문서를 자동 임베딩해 pgvector에 넣고 Streamlit에서 질의응답이 되는 단계까지 완성.

**이번 계획의 핵심 = 이 검증된 RAG를, 인증·문서 접근제어를 갖춰 앱 Widdy에 안전하게 연결하는 것.**

---

## 2. 목표

1. Widdy 도크에서 **자연어로 질문하면**, 사내 문서 근거로 **출처와 함께 답변**한다(스트리밍).
2. 답변은 **질문자가 볼 권한이 있는 문서만** 근거로 한다(문서 접근제어).
3. 앱은 RAG 내부망에 **직접 접근하지 않고**, 인증된 게이트웨이만 거친다([[sign-api-token-client-exposed]]의 교훈 반영).
4. 대화 이력을 저장해 **멀티턴 컨텍스트**를 지원한다.
5. Garage 신규 업로드가 **자동으로 검색 대상에 반영**된다(동기화 유지).

### 비목표(이번 범위 제외)
- 문서 편집·생성, 워크플로 자동화(결재 자동 상신 등).
- 음성 입출력, 이미지 생성.
- RAG 외 일반 웹 지식 응답(사내 문서 grounding 전용).

---

## 3. 아키텍처 — Appwrite Function을 보안 브리지로

앱은 RAG에 직접 접근하지 않고, **인증된 Appwrite Function**을 통해서만 질의한다. Garage sign API와 동일한 "클라이언트는 자격증명·내부망을 모른다" 원칙.

```
[Widdy UI (웹/모바일)]
   └─(Appwrite 세션 인증)→ [Appwrite Function: widdy-chat]
                              ├─ 사용자·문서 ACL 컨텍스트 구성
                              ├─→ 임베딩 /embed (BGE-M3, 1024d)
                              ├─→ pgvector 검색 (ACL 필터 WHERE)
                              ├─→ Ollama 생성(스트리밍)
                              └─ 답변 + 출처(citations) 반환 → 대화 이력 저장(Appwrite)
```

**네트워크 주의**: AI 서비스는 호스트 `127.0.0.1`에 바인딩돼 있어 Appwrite Function 컨테이너에서 직접 접근 불가. RAG API를 **사설 인터페이스(10.10.1.53)** 또는 도커 네트워크/호스트게이트웨이로 노출하도록 바인딩 조정 필요(외부 공개는 하지 않음).

**대안 아키텍처(참고)**: DMZ(test-server2)에 하드닝된 RAG API를 nginx+실인증으로 노출(garage-sign-api 패턴). Appwrite Function 경유가 인증·ACL 재사용 측면에서 우수하여 1안 권장.

---

## 4. 단계별 로드맵

### Phase 0 — 보안 하드닝(선결)
- `garage_sync.py`의 **하드코딩된 Garage AK/SK 평문** → `.env`(권한 600)로 이관.
- AI 서비스 바인딩/방화벽 재점검(외부 미노출 유지 확인).

### Phase 1 — RAG를 API로 승격
- `rag.py` 로직을 `service.py`(FastAPI)에 **`POST /chat`** 엔드포인트로 통합.
  - 입력: `{query, userId, aclContext, history?}` · 출력: **SSE 스트리밍** 답변 + `citations[]`(source_doc_id, chunk_idx, 원본 키).
- 검색·프롬프트·Ollama 호출을 하나의 서비스로. 사설 인터페이스 바인딩.

### Phase 2 — 문서 접근제어(ACL) 【✅ 구현·검증 완료 2026-08-17】
- **문제(해소)**: 전체 조회라 누가 물어도 남의 연봉계약서·견적서 청크가 반환되던 것 → scope 필터로 차단.
- 구현(test-server1 `/opt/ai-embed`):
  - `acl.py` — Garage 키 → **scope** 매핑 + 사용자별 허용 scope 계산(Appwrite `chatRooms.members`, `approvalDocs.drafterId`+`steps[].approverId`, `users.roleGroup`).
  - scope 태그: `public` · `user:<uid>`(seals) · `room:<roomId>`(chat 멤버) · `doc:<AP-id>`(결재 참여자) · `restricted`(매핑불명→ADMIN만). **멤버십은 검색 시점 판정**(스냅샷 아님 → 항상 최신).
  - `search_acl.py` — ACL 적용 벡터검색(`WHERE metadata->'scopes' ?| allowed`). `/chat` retrieve로 승격 예정.
  - `garage_sync.py` 패치 — 인제스트 시 scope 자동 부여(인덱스 실패 시 fail-closed).
  - 기존 2,461 청크 scope 백필(미부여 0), scope용 GIN 인덱스 추가.
- 🔴 레드팀 통과: "박명규 연봉계약서"(doc:AP-260716-002) 청크가 **비참여자 미노출**, 참여자만 접근.
- ⚠️ 잔여: Streamlit 데모(:8501) 무필터 → 외부 노출 금지. Appwrite 키 읽기전용화·index 캐싱은 하드닝 후속.

### Phase 3 — Appwrite Function `widdy-chat`
- Appwrite 세션으로 사용자 식별 → ACL 컨텍스트 구성 → Phase 1 RAG API 호출(사설망) → 스트리밍 중계.
- 대화 이력 컬렉션 `widdyChats`(userId, sessionId, role, content, citations, at) 신설 — 멀티턴 컨텍스트.
- 단독 배포는 push 함수 전례처럼 전용 스크립트 사용(통합 스크립트가 제거된 `bridge-a2f`를 되살리는 문제 재발 방지, [[db-migration-firestore-to-appwrite]]).

### Phase 4 — Widdy 웹페이지 연계 (`ChatbotPanel` 실기능화)
- 목업 → 실제 `<form>` + `<input>` + 상태 + **스트리밍 렌더링**. 데이터 계층 패턴 준수.
- 답변에 **출처 문서 링크(citation)** 표시 → 클릭 시 Garage 원본/결재문서로 이동.
- 추천 칩을 실제 질의 트리거로. 로딩/에러/빈응답("문서에서 찾을 수 없습니다") 처리.
- 명칭 표기 통일(위디 / WIDDY / Widdy 중 하나로).
- **상세 설계는 §10 참조.**

### Phase 5 — 운영화
- `ai-garage-sync.timer` 유지하되 대상 프리픽스 스코프 + ACL 메타 채우기.
- 관측성: 질의/응답/지연/근거문서 로깅(민감정보 주의), 실패율 모니터링.
- 모델 정책 결정(§6).

---

## 5. 데이터 모델

**기존 `doc_embeddings`**(pgvector, 실측):
`id, source_col, source_doc_id, chunk_idx, content, embedding vector(1024), metadata jsonb`
— unique(source_col, source_doc_id, chunk_idx), HNSW(vector_cosine_ops).

**ACL 확장(Phase 2)** — `metadata`에 추가:
```json
{
  "file": "approvals/....xlsx",
  "garageKey": "approvals/....xlsx",
  "docId": "AP-260812-001",
  "owners": ["U012"],
  "allowRoles": ["ADMIN"],
  "visibility": "private"   // public | dept | private
}
```
검색 시: `WHERE (metadata->>'visibility'='public' OR metadata->'owners' ? :uid OR metadata->'allowRoles' ?| :roles)`.

**신규 `widdyChats`(Appwrite)**: `userId, sessionId, turnIdx, role('user'|'assistant'), content, citations(jsonb), createdAt`.

---

## 6. 모델 정책 (결정 필요)

| 옵션 | 장점 | 단점 |
|---|---|---|
| **qwen2.5:7b (현행, 로컬)** | 사내 문서가 외부로 안 나감(프라이버시), 무료·무제한 | 품질 중간, 서버 CPU 자원 |
| 더 큰 로컬 모델 | 품질↑, 온프레미스 유지 | 자원 요구↑(GPU 권장) |
| Claude(클라우드) | 최고 품질/추론 | **데이터 egress** — 민감 문서 외부 전송 검토 필요 |
| **하이브리드** | 민감=로컬, 일반=클라우드 라우팅 | 라우팅 정책 복잡도 |

→ 사내 결재·인사 문서 특성상 **온프레미스(로컬) 기본 유지**를 권장. 품질 이슈 시 하이브리드 검토.

---

## 7. 리스크 · 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| **문서 ACL 미비 상태로 앱 연결** | 회사 문서 유출 | Phase 2를 앱 노출(Phase 4)의 **선결 게이트**로 강제 |
| 자격증명 하드코딩(garage_sync) | 키 유출 | Phase 0에서 즉시 .env 이관 |
| RAG 내부망 노출 범위 확대 | 공격면 증가 | Appwrite Function 경유만 허용, 외부 직결 금지 |
| 환각(근거 없는 답변) | 오정보 | 기존 grounding 프롬프트 유지 + citations 필수 표기 |
| 동기화 지연/누락 | 최신 문서 미반영 | timer 유지 + 실패 알림 |

---

## 8. 완료 기준(수용 기준)

- [ ] Phase 0: garage_sync 키 .env 이관, 외부 미노출 재확인
- [ ] Phase 1: `/chat` 스트리밍 API + citations 동작
- [x] Phase 2: 사용자별 ACL 필터로 **타인 문서 청크 미반환** 검증(레드팀 질의) — 완료(2026-08-17)
- [ ] Phase 3: `widdy-chat` Appwrite Function 배포 + 멀티턴 이력 저장
- [ ] Phase 4: Widdy UI 실입력·스트리밍·출처링크 동작, 목업 제거
- [ ] Phase 5: 동기화·모니터링·모델정책 확정

---

## 9. 우선순위 요약

1. **Phase 2(문서 ACL)** — 이것 없이 앱에 붙이면 정보 유출. 최우선.
2. Phase 1(`/chat` API) + Phase 3(Appwrite Function).
3. Phase 4(UI 연결).
4. Phase 0/5(하드닝·운영화)는 병행.

> 요지: 백엔드 RAG는 **이미 실데이터로 동작**한다. 남은 일은 *새 AI를 만드는 것*이 아니라 **인증·접근제어를 입혀 앱에 안전하게 잇는 것**이다.

---

## 10. 웹 프론트엔드 연계 상세 (Widdy 웹페이지)

앱 정본 데이터 계층 패턴(`domain → data(repo) → features(React Query) → modules/UI`, [[data-layer-pattern]])을 그대로 따른다. `ChatbotPanel`은 훅만 소비하고 API·인증·스트리밍은 하위 계층이 안다.

### 10.1 신설/변경 파일

| 파일 | 역할 |
|---|---|
| `src/domain/widdyChat/schema.ts` (new) | 타입: `WiddyMessage{ id, role:'user'\|'assistant', content, citations?, at }`, `Citation{ docId, source, chunkIdx, url? }` |
| `src/data/widdyChat/widdyChat.repo.ts` (new) | `ask(query, history)`, `listHistory(sessionId)`, `clear(sessionId)`. 게이트웨이 호출 유일 지점 |
| `src/features/widdy/useWiddyChat.ts` (new) | `useMutation(ask)` + optimistic user 메시지, 스트림 토큰 누적; `useQuery(history)` |
| `src/app/shell/QuickDock.tsx` `ChatbotPanel` (edit) | 훅 소비, `<form>`/`<input>`/전송/스트리밍 렌더 + citations 칩. 목업 제거 |
| `.env` (edit) | 필요 시 `VITE_WIDDY_CHAT_URL`(옵션 B) 등 |

### 10.2 API 계약 (클라이언트 ↔ 게이트웨이)

요청:
```json
POST { "query": "육아휴직 규정 알려줘", "sessionId": "wc-...", "history": [{"role":"user","content":"..."},{"role":"assistant","content":"..."}] }
```
응답(스트리밍 SSE):
```
event: token   data: {"delta":"제공"}
event: token   data: {"delta":"된 문서에 따르면…"}
event: done    data: {"citations":[{"docId":"AP-260812-001","source":"approvals/...xlsx","chunkIdx":12}], "sessionId":"wc-..."}
```
응답(비스트리밍, 옵션 A):
```json
{ "answer": "…", "citations": [{ "docId": "...", "source": "...", "chunkIdx": 12 }], "sessionId": "wc-..." }
```

### 10.3 스트리밍 방식 결정 (핵심)

Appwrite Functions `createExecution`은 **요청/응답형**이라 SSE 스트리밍에 부적합하다. 두 경로:

| | 옵션 A — Appwrite Function (비스트리밍) | 옵션 B — DMZ SSE 게이트웨이 |
|---|---|---|
| 경로 | 웹 → `Functions.createExecution('widdy-chat')` → RAG | 웹 → `fetch('/api/widdy/chat')`(SSE) → RAG |
| 인증 | Appwrite 세션 자동 | 앱 세션/토큰 게이트(sign API 패턴) 필요 |
| UX | 답변 일괄 표시(수 초 대기) | **토큰 스트리밍**(즉시 반응) |
| 구현 | 최단(기존 SDK) | 게이트웨이·인증 추가 |

→ **1차: 옵션 A로 출시**(가장 빠르고 인증 재사용), **2차: 옵션 B로 스트리밍 고도화**. `widdyChat.repo`가 유일 호출 지점이므로 UI 변경 없이 A→B 교체 가능.

### 10.4 ChatbotPanel UI 상태
- 초기: Widdy 인사 + 추천 칩(실제 질의 트리거).
- 전송 중: 사용자 말풍선 즉시(optimistic) + 타이핑 인디케이터(✦).
- 응답: 스트리밍 렌더(옵션 B) 또는 일괄(옵션 A).
- **출처(citations)**: 답변 하단 칩 → 클릭 시 Garage 원본 URL/결재문서 뷰로 이동.
- 빈 응답: "제공된 문서에서 관련 내용을 찾을 수 없습니다"(백엔드 grounding 프롬프트와 일치).
- 에러: 재시도 버튼. Appwrite 미설정 시 셸 안 깨지게 graceful degrade(안내 메시지).

### 10.5 대화 이력·컨텍스트
- `widdyChats`(Appwrite) 컬렉션에 턴 저장(userId, sessionId, role, content, citations, at).
- `useWiddyChat`가 최근 N턴을 `history`로 전달 → 멀티턴. 세션 전환/초기화 지원.

### 10.6 웹 연계 완료 기준
- [ ] 도크 Widdy에서 질문 입력·전송 → 사내 문서 근거 답변 표시
- [ ] 답변에 출처 칩 노출 및 원본 이동 동작
- [ ] 타 사용자 문서 근거가 답변에 섞이지 않음(§2 ACL 연동 검증)
- [ ] 로딩·빈응답·에러 상태 처리, 목업 완전 제거
- [ ] 멀티턴 이력 저장·복원
