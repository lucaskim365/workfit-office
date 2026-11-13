# 대체휴무 원장(분 단위)·반차 4시간 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 결재 완료된 휴일근로를 분 × 1.5 로 대체휴무 원장에 자동 지급·취소 시 자동 차감하고, 잔여를 분 단위로 계산하며, 반차를 근무 4시간으로 판정한다.

**Architecture:** 순수 도메인(`substituteLedger.ts`) → 원장 저장소(공용 목록 스토어, 앱 시작 때 불러옴) → 결재 완료/취소완료 처리 뒤 기록 + 대조 스크립트 → 잔여 계산(`userLeaveBalance`)과 화면 소비처를 분 값으로.

**Tech Stack:** TypeScript, zod, Appwrite(node-appwrite 스크립트), react-query, 테스트 `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-substitute-holiday-minutes-design.md`

## Global Constraints

- 사용자에게 보이는 글은 한국어, 이모지 금지, 화면에 ID·코드·개발 안내문 금지.
- `approvalDocs`·`approvalForms` 는 읽기만(원장 기록은 새 컬렉션에만).
- 분 단위 정수. 지급 = `Math.floor(근로분 × 1.5)`. 대체휴무 사용: 종일 480 · 반차 240 · 반반차 120.
- 휴일근로 = 서식 `휴일근무`/`연장근로` 이면서 근무 구분(`workKind`)이 `휴일`(값 없으면 근무일이 주말이면 휴일).
- 유효기간 = 근무일 + 1년(같은 월일, 하루 전 아님 — 지금 수동 부여와 같은 `+1년`).
- 운영 DB·배포는 사용자 지시 후.

## Review Focus

1. 자정을 넘긴 휴일근로(22:00~02:00) → 240분 근로, 360분 지급. (Task 1 테스트)
2. 휴게시간을 걸친 근로(09:00~18:00, 휴게 12:30~13:30) → 480분, 720분 지급. (Task 1)
3. 같은 문서로 지급이 두 번 들어가지 않음 — 대조를 두 번 돌려도 줄 수 그대로. (Task 1·3)
4. 취소완료된 문서는 지급 + 차감 두 줄, 잔여에 0 반영. 지급 줄이 없던(예전) 취소완료 문서는 아무것도 넣지 않음. (Task 1)
5. 만료된 지급은 잔여에서 빠지고, 사용은 오래된 지급부터. (Task 1)

---

### Task 1: 원장 도메인

**Files:** Create `src/domain/leave/substituteLedger.ts`, Test `src/domain/leave/substituteLedger.test.ts`

**Produces:**
- `substituteLedgerEntrySchema`, `type SubstituteLedgerEntry = { id; userId; kind: 'GRANT'|'REVOKE'; minutes: number; sourceDocId; sourceDocNo; workDate; expiresOn; workMinutes: number; createdAt; createdBy; note }`
- `SUBSTITUTE_RATE = 1.5`, `DAY_MIN = 480`
- `isHolidayWorkDoc(doc): boolean`
- `holidayWorkMinutes(doc, policy: Pick<CommutePolicy,'breakStartTime'|'breakEndTime'>): number` — 출근~퇴근(자정 넘김 +1440) − 휴게 겹침, 시각은 `clockOf` 로 읽음(표시 붙은 값 OK)
- `grantEntryOf(doc, policy, now: string): SubstituteLedgerEntry | null` — 완료 + 휴일근로 + 근로>0, id `SHL-G-{doc.id}`
- `revokeEntryOf(grant: SubstituteLedgerEntry, now: string): SubstituteLedgerEntry` — id `SHL-R-{grant.sourceDocId}`, minutes = −grant.minutes
- `missingLedgerEntries(docs, ledger, policy, now): SubstituteLedgerEntry[]` — 완료 문서에 GRANT 없으면 GRANT, 취소완료 문서에 GRANT 있고 REVOKE 없으면 REVOKE
- `substituteUseMinutes(days: number): number` = round(days × 480)
- `allocateSubstitute(entries: SubstituteLedgerEntry[], usedMin, pendingMin, refDate): { totalMin; usedMin; pendingMin; remainingMin; expiringSoonCount; detailList: Array<{ entry: SubstituteLedgerEntry; netMin: number; usedMin: number; pendingMin: number; status: 'USED'|'AVAILABLE'|'EXPIRED'|'REVOKED' }> }` — 문서별로 GRANT+REVOKE 합친 net, 만료·취소 빼고 근무일 오래된 순 선입선출
- `formatMinutes(min: number): string` — `12시간 45분`, `8시간`, `30분`, 0이면 `0시간`

- [ ] 테스트: 510분→765, 자정 넘김, 휴게 걸침, 연장(평일) 제외, 미완료 제외, 대조 멱등, 취소완료 차감, 예전 취소완료(지급 없음) 무시, FIFO·만료, formatMinutes
- [ ] 실패 확인 → 구현 → 통과 → 커밋 `feat(휴가): 대체휴무 원장 도메인 — 휴일근로 분×1.5 지급·취소 차감·대조·선입선출`

### Task 2: 반차 4시간·대체휴무 단위

**Files:** Modify `src/domain/commute/engine.ts`(halfDayWindows), `src/domain/leave/policy.ts`(calculateLeaveDays·isHalfDayLeave/isQuarterDayLeave 에 단위 반영), `src/domain/leave/legacyAdapter.ts`(leaveUnit 읽기), `src/domain/commute/approvalDayIndex.ts`(leaveUnit 전달). Tests: 기존 engine/policy 테스트에 추가.

- 반차 = 실근무 타임라인 0~240(오전)·240~480(오후).
- `leaveUnit`(`종일|오전반차|오후반차|반반차`, fieldValues) — 대체휴무에서 반차·반반차 판정·일수(0.5·0.25)·시간대에 쓴다. 다른 휴가 종류는 지금처럼 종류로.
- [ ] 테스트: 점심 11:30~12:30 정책에서도 오전반차 부재 = 4시간 근무분, 오후반차 = 나머지 4시간; 대체휴무+leaveUnit 반차 → 0.5일·반차 시간대
- [ ] 커밋 `fix(근태): 반차는 근무 4시간 — 점심 위치와 무관, 대체휴무 반차·반반차 단위`

### Task 3: 원장 저장소·기록·대조

**Files:** `scripts/appwrite-schema.ts`(컬렉션 `substituteHolidayLedger`, 색인 userId·sourceDocId), `package.json`(`appwrite:schema:subledger`), Create `src/data/substituteLedger/substituteLedger.repo.ts`(공용 목록 스토어 + `recordForDoc(doc)`), Modify `src/features/sharedSettings/SharedSettingsGate.tsx`(hydrate), `src/data/approvalDoc/approvalDoc.repo.ts`(완료 처리 뒤·취소완료 처리 뒤 `recordForDoc`, 실패는 로그만), Create `scripts/reconcile-substitute-ledger.ts`, `scripts/report-manual-substitute.ts`(읽기 전용 보고).

- [ ] `recordForDoc` 테스트(가짜 백엔드): 완료 → GRANT insert, 이미 있으면 건너뜀(DocumentExistsError 무시), 취소완료 → REVOKE
- [ ] 개발 DB 컬렉션 생성(`--dry-run` 먼저), 대조 `--dry-run` → 적용 → 다시 `--dry-run` 0건
- [ ] 커밋

### Task 4: 잔여 계산·소비처

**Files:** `src/domain/leave/userLeaveBalance.ts`(옵션 `substituteLedger`, 분 단위 결과, 수동 부여 제거), `src/features/gw/useLeave.ts`, 소비처 `MyCommuteLeaveTab.tsx`·`ApprovalDraftDocumentSheet.tsx`·`ApprovalDraftScreen.tsx`·`modules/exec/widgets.tsx`·`MobileLeaveHistory.tsx`·`LeaveLedgerTable.tsx`, `CommuteScreen.tsx`(일괄 부여 단추 숨김).

- `substituteHoliday` 결과 이름을 `totalMin/usedMin/pendingMin/remainingMin/expiringSoonCount/detailList` 로 바꿔 타입이 모든 소비처를 잡게 한다. 표시는 `formatMinutes`. 휴가 신청 잔여 검사는 분으로(사용 분 > 잔여 분이면 막음).
- [ ] userLeaveBalance 테스트 갱신·추가(원장 지급 765 − 반차 사용 240 = 525)
- [ ] tsc 0, 전체 테스트, 빌드, 개발 화면 확인(근태 › 내 휴가, 홈 위젯)
- [ ] 커밋

### Task 5: 보고

- [ ] 수동 부여 사용 이력 보고(운영 읽기 — 막히면 사용자에게 실행 요청), 운영 반영 순서(컬렉션 → 대조 `--prod --dry-run` 결과 → 배포 → 수동 부여 백업·폐기) 보고.
