# 업무계획 항목형 개편 (팀즈식 일정 창) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 업무계획 칸을 자유 글 대신 "항목 칩"으로 바꾸고, 칸 더블클릭/[+]로 팀즈식 일정 창(태그별 입력 + 세로 시간표 + 회의실 예약)을 연다. PC·모바일 동일 기능.

**Architecture:** 일반 항목은 새 컬렉션 `workPlanItems`, 태그는 `workPlanTags`. 회의는 기존 `calendarEvents`(+ `location`·`reservationId` 칸), 외근·출장은 기존 `outsideWorks`에 그대로 저장한다. 칸 내용은 순수 함수 `indexDayEntries`가 모든 출처를 모아 만들고, 시간표 계산은 순수 함수 `timeGrid`, 회의+회의실 저장 순서는 `meetingWithRoom`이 맡는다. 화면은 이 셋을 조립만 한다.

**Tech Stack:** React 18 + TypeScript, TanStack Query, zod, Tailwind(디자인 토큰), lucide-react, Appwrite(crudBackend), 테스트 `node:test` + `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-19-workplan-items-design.md` (반드시 함께 읽을 것)

## Global Constraints

- 답변·주석·화면 문구는 한국어. 화면에 ID·내부 코드·개발용 설명 안내문("~에 저장되어 표시" 등) 금지.
- 아이콘은 lucide-react만(이모지 금지). 창 틀은 `@/shared/ui/Modal`, 버튼은 `@/shared/ui/Button` variant, 입력은 `@/shared/ui/form/Field`·`TextField`.
- `approvalDocs`·`approvalForms`는 읽기만. `workPlans`·`calendarEvents`·`outsideWorks`·`reservations` 기존 문서를 수정·삭제하는 새 코드 금지(예외: 전사 공통 일정 줄 기존 동작, 본인 회의·외근·출장·연결 예약의 기존 방식 수정).
- 자원예약 화면 파일(`src/modules/gw/resource/**`, `src/mobile/resource/**`, `src/mobile/MobileResourceScreen.tsx`) 수정 금지 — 이재원 작업 영역. `reservationRepo`·`resourceRepo`·`src/domain/reservation/**`는 호출만.
- 메신저 파일은 이 작업과 무관 — 건드리지 않는다.
- 시간 단위: 시간표 클릭·끌기는 30분(`SLOT_MINUTES = 30`). 직접 입력은 30분 단위 강제 없음.
- 제목 100자, 일반 메모 1000자, 회의 메모 2000자, 태그 이름 10자, 장소 100자.
- 테스트: `npx tsx --test <file>` (vitest 아님). 전체: `npx tsx --test $(git ls-files 'src/**/*.test.ts' 'src/**/*.test.tsx')`.
- 각 Task 끝 검증: `npx tsc --noEmit` 통과. 커밋 메시지는 `feat(업무계획): …` 형식 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 운영 DB·운영 배포(`git push origin main`)는 이 계획 범위에서 하지 않는다(Task 13에서 사용자 지시 대기).

## Review Focus

1. **자정 근처·24:00 경계** — 23:30 칸을 끌어 내리거나 끝을 늘리면 종료가 `23:59`로 멈춰야 한다(`timeSchema`는 24:00을 못 받음). → Task 4 `resizeEnd`/`rangeFromDrag` 테스트에 포함.
2. **회의실 예약은 됐는데 회의 저장 실패** — 예약이 남으면 방이 계속 막힌다. 되돌리기(cancel)와, 그마저 실패할 때 안내 문구. → Task 5 테스트 "회의 생성 실패 시 예약 취소", "되돌리기 실패 시 RoomRollbackError".
3. **창을 연 사이 다른 사람이 같은 방 예약** — 목록에선 비어 보였어도 저장 순간 충돌로 막혀야 하고, 회의도 만들어지면 안 된다. → Task 5 테스트 "저장 직전 충돌이면 회의를 만들지 않는다".
4. **동명이인·계정 이관된 결재 기안자** — 결재 외근·휴가가 이름으로 이어지는 기존 규칙이 새 조립 함수에서도 유지돼야 한다. → Task 3 테스트 "기안자 id가 다르면 이름으로 잇는다".
5. **캘린더 화면에서 고친 회의가 `location`·`reservationId`를 지우지 않음** — 기존 창은 두 칸을 모른다. → Task 2 테스트 "draft에 없으면 기존 값 유지".

---

## File Structure

| 파일 | 역할 |
|---|---|
| `src/domain/workPlan/item.ts` (신규) | `workPlanItems` zod 스키마·타입·쓰기 규칙 |
| `src/domain/workPlan/tag.ts` (신규) | 고정 태그 상수, `workPlanTags` 스키마, 이름 중복·표시 규칙 |
| `src/domain/workPlan/dayEntries.ts` (신규) | 칸 목록 조립 `indexDayEntries`/`buildDayEntries` |
| `src/domain/workPlan/timeGrid.ts` (신규) | 시간표 계산(30분 칸·끌기·옮기기·늘리기·겹침 배치·길이 표시) |
| `src/domain/calendarEvent/schema.ts` (수정) | `location`·`reservationId` 칸 |
| `src/data/workPlan/workPlanItem.repo.ts` (신규) | 항목 저장소 |
| `src/data/workPlan/workPlanTag.repo.ts` (신규) | 태그 저장소 |
| `src/features/workPlan/useWorkPlanItems.ts` (신규) | 항목·태그 query/mutation 훅 |
| `src/features/workPlan/meetingWithRoom.ts` (신규) | 회의 + 회의실 예약 저장 순서·되돌리기, 회의실 가용 판정 |
| `src/modules/gw/task/event/` (신규 폴더) | 일정 창 PC·모바일 공용 부품 |
| `├ WorkPlanEventModal.tsx` | PC 창 틀(상단 C안 도구 막대 + 좌 입력 + 우 시간표) |
| `├ useWorkPlanEventForm.ts` | 창 상태·검증·저장(태그별 분기) — PC·모바일 공용 |
| `├ EventFields.tsx` | 태그별 입력 칸(일반·회의·외근출장) |
| `├ RoomPicker.tsx` | 회의실 선택(가용/비활성) |
| `├ TimeGrid.tsx` | 세로 시간표 화면(PC 끌기, 모바일 탭+끝 끌기) |
| `└ MobileWorkPlanEventSheet.tsx` | 모바일 전체 화면 창(빠른 입력 + [자세히]) |
| `src/modules/gw/task/components/WorkPlanTeamMonthlyMatrix.tsx` (수정) | 칩 표시·진입점·이전 메모, 편집기 제거 |
| `src/modules/gw/task/WorkPlanScreen.tsx` (수정) | 창 연결, 편집 리본·저장 로직 제거 |
| `src/modules/gw/task/components/WorkPlanConfigModal.tsx` (수정) | 태그 관리 → `workPlanTags` |
| `src/modules/gw/calendar/CalendarEventModal.tsx` (수정, 최소) | 연결 예약 같이 바꾸기·취소 |
| `src/mobile/MobileTaskScreen.tsx` (수정) | 모바일 목록·진입·태그 관리 |
| `scripts/appwrite-schema.ts` (수정) | 새 컬렉션 2개 + calendarEvents 칸 2개 |
| `scripts/provision-work-plan-tags.ts` (신규) | 기본 일반 태그 5건 1회 생성 |

---

### Task 1: 항목·태그 도메인 규칙

**Files:**
- Create: `src/domain/workPlan/item.ts`, `src/domain/workPlan/tag.ts`
- Test: `src/domain/workPlan/item.test.ts`, `src/domain/workPlan/tag.test.ts`

**Interfaces:**
- Produces:
  - `workPlanItemSchema` (zod), `type WorkPlanItem`, `type WorkPlanItemDraft = Pick<WorkPlanItem, 'date'|'allDay'|'startTime'|'endTime'|'tagId'|'title'|'memo'>`
  - 칸: `id` (`/^WI-\d{8}-\d{4}$/`), `ownerUserId`, `date`(`isValidCalendarDate`), `allDay`, `startTime`/`endTime`(`HH:mm`|null), `tagId`(1~64), `title`(trim 1~100), `memo`(trim 0~1000), `createdBy`, `createdAt`, `updatedAt`(datetime)
  - `FIXED_WORK_PLAN_TAGS: readonly [{ id: 'MEETING', name: '회의', colorId: 'purple' }, { id: 'OUTSIDE', name: '외근', colorId: 'amber' }, { id: 'TRIP', name: '출장', colorId: 'indigo' }]`, `type FixedTagId = 'MEETING'|'OUTSIDE'|'TRIP'`, `isFixedTagId(id: string): id is FixedTagId`
  - `workPlanTagSchema`: `id`(`/^WT-\d{4}$/`), `name`(trim 1~10), `colorId`(1~32), `order`(int), `hidden`(bool); `type WorkPlanTag`; `type WorkPlanTagDraft = Pick<WorkPlanTag,'name'|'colorId'|'order'|'hidden'>`
  - `class WorkPlanTagError extends Error { code: 'DUPLICATE'|'FIXED'|'INVALID_INPUT' }`
  - `assertTagNameAvailable(tags: WorkPlanTag[], name: string, excludeId?: string): void` — 숨기지 않은 태그끼리 trim 후 대소문자 무시 비교, 고정 태그 이름(회의·외근·출장)과도 중복 불가
  - `resolveTag(tags: WorkPlanTag[], tagId: string): { id: string; name: string; colorId: string; fixed: boolean; unknown: boolean }` — 고정 → 상수, 일반(숨김 포함) → 그 태그, 없음 → `{ name: '기타', colorId: 'slate', unknown: true }`
  - `selectableGeneralTags(tags: WorkPlanTag[]): WorkPlanTag[]` — `hidden=false`, `order` 오름차순, 같으면 이름
  - `DEFAULT_GENERAL_TAGS: ReadonlyArray<{ name: string; colorId: string }>` = 업무 blue · 보고 teal · 교육 emerald · 마감 rose · 집중 pink

- [ ] **Step 1: 실패 테스트 작성** — `item.test.ts`:
  - `종일이면 시각이 없어야 한다` — `allDay: true, startTime: '09:00'` → `safeParse` 실패
  - `시간 항목은 시작·종료가 모두 필요하고 시작<종료` — `('10:00','10:00')` 실패, `('10:00','10:30')` 성공
  - `제목은 1~100자` — `' '` 실패, 101자 실패
  - `메모 1000자 초과 실패`
  
  `tag.test.ts`:
  - `고정 태그 이름과 같은 일반 태그는 만들 수 없다` — `assertTagNameAvailable([], '회의')` throws `code === 'DUPLICATE'`
  - `숨긴 태그 이름은 다시 쓸 수 있다` — hidden 태그 '보고'가 있어도 `'보고'` 통과
  - `수정 중인 자기 자신은 제외` — excludeId
  - `못 찾는 태그는 기타(slate)` — `resolveTag([], 'WT-9999')` → `{ name: '기타', colorId: 'slate', unknown: true }`
  - `숨긴 태그도 이름은 보인다` — hidden 태그 resolve → 그 이름, `unknown: false`
  - `선택 목록은 숨김 제외·순서대로`

- [ ] **Step 2: 실패 확인** — `npx tsx --test src/domain/workPlan/item.test.ts src/domain/workPlan/tag.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3: 구현** — 시각 regex는 `src/domain/calendarEvent/schema.ts`의 `timeSchema`와 같은 식, 시작<종료는 문자열 비교. `superRefine`으로 종일/시간 규칙.
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS
- [ ] **Step 5: 커밋** — `feat(업무계획): 항목·태그 도메인 규칙`

---

### Task 2: 저장소·훅·DB 정의 (항목·태그·회의 장소/예약 칸)

**Files:**
- Create: `src/data/workPlan/workPlanItem.repo.ts`, `src/data/workPlan/workPlanTag.repo.ts`, `src/features/workPlan/useWorkPlanItems.ts`, `scripts/provision-work-plan-tags.ts`
- Modify: `src/domain/calendarEvent/schema.ts`, `scripts/appwrite-schema.ts` (calendarEvents 정의 ~729행, workPlans 뒤에 새 정의 2개)
- Test: `src/data/workPlan/workPlanItem.repo.test.ts`, `src/data/workPlan/workPlanTag.repo.test.ts`, `src/data/calendarEvent/calendarEvent.repo.test.ts`(추가)

**Interfaces:**
- Consumes: Task 1 전부
- Produces:
  - `interface WorkPlanItemActor { userId: string; active: boolean }`
  - `class WorkPlanItemError extends Error { code: 'FORBIDDEN'|'NOT_FOUND'|'INVALID_INPUT'|'INVALID_RANGE'|'CONFLICT' }`
  - `workPlanItemRepo.listRange(filter: { from: string; to: string }): Promise<WorkPlanItem[]>` (전원, date 범위)
  - `workPlanItemRepo.create(actor, ownerUserId: string, draft: WorkPlanItemDraft): Promise<WorkPlanItem>` — `ownerUserId !== actor.userId` → FORBIDDEN, 비활성 → FORBIDDEN, `createdBy = actor.userId`, ID `WI-{YYYYMMDD}-{seq}` (outsideWork.repo의 `nextId`+`DocumentExistsError` 재시도 5회 패턴 그대로)
  - `workPlanItemRepo.update(actor, id, draft)`, `workPlanItemRepo.remove(actor, id)` — 본인 것만
  - `workPlanTagRepo.list(): Promise<WorkPlanTag[]>`(숨김 포함), `create(draft)`, `update(id, draft)` — 이름 규칙 `assertTagNameAvailable`, ID `WT-{seq}`. 권한 판정은 화면(`S_GW_WORK_PLAN_ADMIN` update 또는 슈퍼관리자)에서 — repo는 actor 불필요(기존 설정류와 동일).
  - 훅: `useWorkPlanItems(range: {from,to}, enabled?)`, `useCreateWorkPlanItem()`, `useUpdateWorkPlanItem()`, `useRemoveWorkPlanItem()`, `useWorkPlanTags()`, `useSaveWorkPlanTag()` — query key `'workPlanItems'`·`'workPlanTags'`, 성공 시 invalidate (`useOutsideWorks.ts` 패턴)
  - `calendarEventSchema`에 `location: z.string().trim().max(100).nullable().default(null)`, `reservationId: z.string().max(64).nullable().default(null)`. `CalendarEventDraft`에서 두 칸은 **선택**(`location?: string|null; reservationId?: string|null`) — 기존 `CalendarEventModal`이 안 넣어도 컴파일되고, repo `update`의 `{...current, ...draft}`가 기존 값을 유지한다.
  - appwrite-schema: calendarEvents에 `S('location', 100)`, `S('reservationId', 64)`; 새 `workPlanItems`(속성 = Task 1 칸, `startTime`/`endTime` S 8, `memo` S 1000, 인덱스 `wiOwner`[ownerUserId], `wiDate`[date]), `workPlanTags`(`id` S64 필수, `name` S10 필수, `colorId` S32, `order` INT, `hidden` BOOL false). 권한은 `workPlans` 정의와 같은 방식.
  - `scripts/provision-work-plan-tags.ts [--prod]` — `appwrite-provision-commute-policy.ts`처럼 `loadAppwriteConfig` 사용. `workPlanTags`가 비어 있을 때만 `DEFAULT_GENERAL_TAGS`를 `WT-0001`~`WT-0005`, order 1~5로 생성, 하나라도 있으면 아무것도 안 하고 종료.

- [ ] **Step 1: 실패 테스트** — `workPlanItem.repo.test.ts`(메모리 백엔드, outsideWork.repo.test.ts 형식):
  - `본인 항목을 만들고·고치고·지운다` — id `/^WI-20261021-\d{4}$/`, `createdBy === owner.userId`
  - `남의 칸에는 만들 수 없다` — `create(owner, 'U012', …)` rejects FORBIDDEN
  - `남의 항목은 고치거나 지울 수 없다` — FORBIDDEN
  - `사용 중지 계정은 만들 수 없다`
  - `날짜 범위로 전원 것을 읽는다`
  
  `workPlanTag.repo.test.ts`: `이름 중복이면 DUPLICATE`, `숨김으로 바꾸면 같은 이름을 새로 만들 수 있다`, `id는 WT-0001부터`.
  
  `calendarEvent.repo.test.ts` 추가: `draft에 location·reservationId가 없으면 기존 값 유지` — location '3층 대회의실'·reservationId 'R-1'로 만든 회의를 두 칸 없는 draft로 update → 두 값 그대로. `새 일정은 두 칸이 null`.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/data/workPlan/workPlanItem.repo.test.ts src/data/workPlan/workPlanTag.repo.test.ts src/data/calendarEvent/calendarEvent.repo.test.ts` → FAIL
- [ ] **Step 3: 구현** — 위 Interfaces 그대로. crudBackend `coll: 'workPlanItems'`/`'workPlanTags'`, `seed: []`.
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS, `npx tsc --noEmit` 통과
- [ ] **Step 5: 개발 DB 반영** — `npx tsx scripts/appwrite-schema.ts --only=calendarEvents,workPlanItems,workPlanTags` 후 `npx tsx scripts/provision-work-plan-tags.ts` (개발 프로젝트만. `--prod` 금지). 출력에 오류 없음 확인.
- [ ] **Step 6: 커밋** — `feat(업무계획): 항목·태그 저장소, 회의 장소·예약 연결 칸`

---

### Task 3: 칸 목록 조립 `indexDayEntries`

**Files:**
- Create: `src/domain/workPlan/dayEntries.ts`
- Test: `src/domain/workPlan/dayEntries.test.ts`

**Interfaces:**
- Consumes: `WorkPlanItem`, `WorkPlanTag`/`resolveTag`(Task 1), `CalendarEvent`, `OutsideWork`, `StandardScheduleInfo`·`isDateInSchedule`(`@/domain/approvalDoc/scheduleEngine`), `fromOutsideWork`·`fromApprovalSchedule`·`OutsideScheduleView`(`@/domain/outsideWork/view`), `isOfficialCalendarEvent`, `isWorkPlanDerivedEvent`, `WorkPlan`, `Reservation`
- Produces:
  ```ts
  export type DayEntrySource = 'MEETING' | 'CALENDAR' | 'OUTSIDE' | 'APPROVAL' | 'ITEM';
  export interface DayEntry {
    key: string;                 // 출처+원본id(+동행 사용자) — React key
    source: DayEntrySource;
    allDay: boolean; startTime: string | null; endTime: string | null;
    title: string;               // 화면에 쓸 제목(회의 [회의]/[미팅] 접두 제거, 외근은 행선지)
    tag: { name: string; colorId: string; unknown: boolean } | null; // ITEM만
    companionOf?: string;        // 동행 칸이면 등록자 userId
    roomStatus: 'PENDING' | 'REJECTED' | null; // MEETING에 연결 예약이 대기/반려일 때
    item?: WorkPlanItem; event?: CalendarEvent; outside?: OutsideScheduleView; schedule?: StandardScheduleInfo;
  }
  export interface DayEntryInput {
    items: WorkPlanItem[]; tags: WorkPlanTag[]; events: CalendarEvent[]; outsideWorks: OutsideWork[];
    approvedSchedules: StandardScheduleInfo[]; legacyPlans: WorkPlan[]; reservations: Reservation[];
    members: Array<{ id: string; name: string }>;
  }
  export interface DayCell { entries: DayEntry[]; legacyMemo: string | null }
  export function indexDayEntries(input: DayEntryInput, dates: string[]): (userId: string, date: string) => DayCell;
  export function buildDayEntries(userId: string, date: string, input: DayEntryInput): DayCell; // = indexDayEntries(input,[date])(userId,date)
  ```
  - 포함 규칙은 spec 4.4 표. `MEETING` = `eventType==='MEETING'`, `CALENDAR` = 그 외 `isOfficialCalendarEvent` 통과(사내행사·OUTSIDE·VACATION·CAL-APPR-*·제목 회의/미팅). 둘 다 `isWorkPlanDerivedEvent` 제외, 대상 = 주최자 + 참석자.
  - 결재 일정 소유자: `members`에 `drafterId`가 있으면 그것, 없으면 공백 제거한 이름으로 찾은 id, 없으면 `drafterId` (현재 `WorkPlanTeamMonthlyMatrix.tsx:268-273`과 같은 규칙).
  - `legacyMemo`: 그 사람·그 날 `workPlans.content`에서 체크 메타·서식을 걷어 낸 글(`parseWorkPlanItems(content)`(`@/domain/workPlan/engine`)로 줄을 나눠 각 `text`에 `stripInlineMarks`(`@/domain/workPlan/richText`)를 적용하고, 태그가 있던 줄은 `[태그] ` 접두를 붙여 `
`으로 잇는다), 빈 글이면 null. `__COMPANY__`는 legacy 대상 아님.
  - 정렬: 종일 먼저 → `startTime` 오름차순 → 출처 순 `MEETING, CALENDAR, OUTSIDE, APPROVAL, ITEM` → title.

- [ ] **Step 1: 실패 테스트** (각 이름 = 단언):
  - `내 항목만 내 칸에` — 다른 사람 item 제외
  - `회의는 주최자와 참석자 칸 모두에`
  - `WP-SYNC 일정은 빠진다` — memo에 `[WP-SYNC:P1:0]` 포함한 일정
  - `사내행사·휴가 등 회의 외 캘린더 일정은 CALENDAR로 보인다`
  - `외근은 기간 안의 날마다, 동행자 칸에는 companionOf`
  - `결재와 연결된 직접 등록 외근은 빠진다` — `linkedApprovalDocId` 있음
  - `기안자 id가 다르면 이름으로 잇는다` — drafterId 'OLD-1', drafterName '홍 길동', members `{id:'U011', name:'홍길동'}` → U011 칸
  - `정렬: 종일 → 시각 → 출처` — 09:00 ITEM, 09:00 MEETING, 종일 OUTSIDE → [OUTSIDE, MEETING, ITEM]
  - `연결 예약이 PENDING이면 roomStatus PENDING, CONFIRMED면 null`
  - `이전 메모는 서식 없이, 빈 글은 null`
  - `못 찾는 태그는 기타`
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/domain/workPlan/dayEntries.test.ts` → FAIL
- [ ] **Step 3: 구현** — 한 번 훑어 `Map<"userId|date", DayEntry[]>`를 채운 뒤 정렬, 조회 함수 반환(칸마다 전체 배열을 다시 훑지 않음).
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: 커밋** — `feat(업무계획): 칸 목록 조립 순수 함수`

---

### Task 4: 시간표 계산 `timeGrid`

**Files:**
- Create: `src/domain/workPlan/timeGrid.ts`
- Test: `src/domain/workPlan/timeGrid.test.ts`

**Interfaces:**
- Produces (분 단위 정수, 0~1440):
  ```ts
  export const SLOT_MINUTES = 30;
  export const DAY_END = 1440;
  export interface MinuteRange { start: number; end: number }
  export function toMinutes(hhmm: string): number;
  export function toHHmm(minutes: number): string;        // 1440 → '23:59'
  export function rangeFromDrag(anchor: number, current: number): MinuteRange; // 두 점이 속한 30분 칸을 모두 덮음, 최소 30분
  export function moveRange(range: MinuteRange, delta: number): MinuteRange;   // 30분 단위로 반올림 이동, 길이 유지, [0,1440] 안으로
  export function resizeEnd(range: MinuteRange, end: number): MinuteRange;     // end를 30분 단위 올림, 최소 start+30, 최대 1440
  export function durationLabel(range: MinuteRange): string;                    // '30분' | '1시간' | '1시간 30분'
  export function layoutColumns<T extends { key: string } & MinuteRange>(blocks: T[]): Array<T & { col: number; cols: number }>;
  export function quickDefaultRange(now: Date): MinuteRange;                    // 다음 30분 경계 ~ +30 (23:30 이후면 23:30~1440)
  ```
- [ ] **Step 1: 실패 테스트**:
  - `클릭 한 번 = 그 30분 칸` — `rangeFromDrag(605, 605)` → `{start:600,end:630}`
  - `위로 끌어도 같은 구간` — `rangeFromDrag(700, 610)` → `{600, 720}`
  - `옮기기는 길이 유지·경계 안` — 이동량은 `Math.round(delta / 30) * 30`: `moveRange({600,690}, 20)` → `{630,720}`, `moveRange({600,690}, 10)` → `{600,690}`, `moveRange({600,690}, 1000)` → `{1350,1440}`, `moveRange({600,690}, -900)` → `{0,90}`
  - `끝 늘리기는 최소 30분, 최대 24시` — `resizeEnd({600,630}, 590)` → `{600,630}`; `resizeEnd({1380,1410}, 1500)` → `{1380,1440}`
  - `1440은 23:59로` — `toHHmm(1440) === '23:59'`, `toHHmm(570) === '09:30'`
  - `길이 표시` — 30→'30분', 60→'1시간', 90→'1시간 30분'
  - `겹치는 블록은 옆으로 나눈다` — [9-10],[9:30-10:30],[11-12] → cols 2,2,1
  - `빠른 입력 기본값` — 10:07 → `{630,660}`; 23:40 → `{1410,1440}`
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/domain/workPlan/timeGrid.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(업무계획): 시간표 계산(30분 칸·끌기·겹침)`

---

### Task 5: 회의 + 회의실 저장 `meetingWithRoom`

**Files:**
- Create: `src/features/workPlan/meetingWithRoom.ts`
- Test: `src/features/workPlan/meetingWithRoom.test.ts`

**Interfaces:**
- Consumes: `calendarEventRepo`(`create/update/remove/get`), `reservationRepo`(`create/cancel/reschedule/get/list`), `resourceRepo`, `assertNoConflict`·`ReservationError`(`@/domain/reservation/engine`), `RESOURCE_UTC_OFFSET`(`@/domain/reservation/time`), `RESERVATION_CLOSED_STATUSES`
- Produces:
  ```ts
  export interface MeetingActors { calendar: CalendarEventActor; user: User; isAdmin?: boolean }
  export interface MeetingSaveInput { eventId?: string; draft: CalendarEventDraft; roomId: string | null; purpose: string }
  export class RoomRollbackError extends Error {} // 회의 실패 + 예약 취소도 실패 — 화면은 "회의실 예약은 남아 있습니다. 자원예약에서 취소해 주세요."
  export function toReservationWindow(date: string, startTime: string, endTime: string): { startAt: string; endAt: string }; // `${date}T${t}:00+09:00` → toISOString()
  export function isReservationChangeable(row: Reservation, now?: Date): boolean; // PENDING|CONFIRMED 이고 startAt > now
  export function roomAvailability(rooms: Resource[], reservations: Reservation[], window: { startAt: string; endAt: string }, ignoreReservationId?: string): Map<string, boolean>;
  export async function saveMeeting(actors: MeetingActors, input: MeetingSaveInput): Promise<CalendarEvent>;
  export async function removeMeeting(actors: MeetingActors, event: CalendarEvent): Promise<void>;
  ```
  - `rooms` = `resourceRepo` 목록 중 `typeCode==='ROOM' && status==='ACTIVE'`. `roomAvailability`는 `assertNoConflict`를 호출해 던지면 false.
  - `saveMeeting` 규칙(spec 3.3): 새 회의+방 → 예약 create(title=draft.title, purpose=input.purpose||'회의', attendeeUserIds=draft.attendeeUserIds, quantity 1, attendeeCount=참석자+1) → 회의 create(`location`=방 이름, `reservationId`) → 실패 시 cancel('회의 저장 실패'), cancel도 실패면 `RoomRollbackError`. 기존 회의: 방 같고 시간 바뀜 & 예약 changeable → reschedule 먼저(실패면 회의 저장 안 함); 방 바뀜 → (기존 예약 changeable이면 cancel '회의실 변경') + 새 예약 → 회의 update; 방 해제 → changeable이면 cancel; 예약이 changeable 아님 → 예약은 건드리지 않음, 방을 새로 고른 경우만 새 예약.
  - `removeMeeting`: changeable이면 cancel('회의 취소') 후 회의 remove.
- [ ] **Step 1: 실패 테스트**(메모리 백엔드, 회의실은 `resourceRepo`로 테스트 안에서 즉시확정(`approvalMode: 'INSTANT'`)·승인필요(`'APPROVAL'`) ROOM 2개를 만들어 쓴다 — 시드(`RES-0001` 대회의실 등)의 설정에 기대지 않는다):
  - `방을 고르면 예약과 회의가 함께 생기고 연결된다` — event.reservationId === 예약 id, event.location === 방 이름
  - `승인 필요 방은 예약이 PENDING`
  - `저장 직전 충돌이면 회의를 만들지 않는다` — 같은 시간 기존 예약 → rejects ReservationError CONFLICT, 그 날 회의 0건
  - `회의 생성 실패 시 예약 취소` — draft.title 101자 → rejects, 예약 상태 CANCELLED
  - `되돌리기 실패 시 RoomRollbackError` — reservationRepo.cancel을 테스트에서 일시 교체(throw)해 확인 후 복원
  - `시간 변경은 예약도 reschedule`
  - `시간 변경이 다른 예약과 겹치면 회의도 그대로`
  - `방 변경은 기존 예약 취소 + 새 예약`
  - `삭제는 예약 취소`
  - `반려된 예약은 건드리지 않고 회의만 고친다` — 승인 필요 방 예약을 reject 후 시간 변경 → 성공, 예약 REJECTED 그대로
  - `roomAvailability: 겹치는 방 false, 자기 예약은 무시`
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/features/workPlan/meetingWithRoom.test.ts` → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(업무계획): 회의와 회의실 예약을 함께 저장·되돌리기`

---

### Task 6: 캘린더 화면 일정 창 최소 연동

**Files:**
- Modify: `src/modules/gw/calendar/CalendarEventModal.tsx` (submit ~233행, remove ~253행)

**Interfaces:**
- Consumes: `saveMeeting`, `removeMeeting`, `MeetingActors` (Task 5)

- [ ] **Step 1:** `event?.reservationId`가 있을 때만: 저장은 `saveMeeting(actors, { eventId: event.id, draft: draft(), roomId: <기존 예약의 resourceId>, purpose: draft().memo })`, 삭제는 `removeMeeting`. 그 외 경로·화면은 그대로. 저장 후 `['calendarEvents']`·`['reservations']` query invalidate. `actors.user`는 `useAuth().user`.
- [ ] **Step 2:** `npx tsc --noEmit` 통과, `npx tsx --test src/data/calendarEvent/*.test.ts` 통과
- [ ] **Step 3: 커밋** — `feat(캘린더): 회의실 연결 회의는 예약도 함께 바꾸고 취소`

---

### Task 7: 세로 시간표 부품 `TimeGrid`

**Files:**
- Create: `src/modules/gw/task/event/TimeGrid.tsx`

**Interfaces:**
- Consumes: Task 4 전부, `DayEntry`(Task 3)
- Produces:
  ```ts
  export interface TimeGridBlock { key: string; start: number; end: number; label: string; tone: 'meeting' | 'outside' | 'item' | 'room'; }
  export function TimeGrid(props: {
    date: string; onDateChange: (date: string) => void;
    blocks: TimeGridBlock[];               // 남의 일정(흐리게), 'room' = 고른 회의실 예약
    value: MinuteRange | null; allDay: boolean;
    onChange: (range: MinuteRange) => void;
    mode: 'desktop' | 'touch';
  }): JSX.Element;
  export function entriesToBlocks(entries: DayEntry[], ownerName?: string): TimeGridBlock[]; // 시간 있는 항목만
  ```
  - 보이는 범위 기본 08:00~19:00(마운트 시 그 위치로 스크롤), 전체 0~24시, 1칸 = 30분. 맨 위 "종일" 줄.
  - desktop: 빈 곳 mousedown→move→up = `rangeFromDrag`; 내 막대 몸통 끌기 = `moveRange`; 막대 아래 끝 손잡이 = `resizeEnd`. touch: 탭 = 30분 칸, 막대 아래 끝 손잡이만 끌기(pointer events, `touch-action: none`은 손잡이에만).
  - body `zoom: var(--font-scale)` 때문에 좌표는 `getBoundingClientRect()` 기준 비율로 계산(clientY − rect.top) / rect.height × 표시 분 범위 — 픽셀 상수 금지.
  - 색: meeting=blue 계열, outside=amber, item=ink3/회색, room=점선 테두리. 내 막대는 진한 blue.
- [ ] **Step 1:** 구현. **Step 2:** `npx tsc --noEmit`. **Step 3:** 커밋 `feat(업무계획): 세로 시간표 부품`

---

### Task 8: 일정 창 상태·저장 훅 `useWorkPlanEventForm`

**Files:**
- Create: `src/modules/gw/task/event/useWorkPlanEventForm.ts`

**Interfaces:**
- Consumes: Task 2 훅, Task 5 `saveMeeting`/`removeMeeting`, `useCreateOutsideWork`/`useUpdateOutsideWork`/`useRemoveOutsideWork`, `outsideWorkSchema`, `OUTSIDE_WORK_SUBTYPES`, `findSimilarMeetings`/`canJoinMeeting`/`useJoinMeeting`, `MEETING_DEFAULT_VISIBILITY`
- Produces:
  ```ts
  export type EventKind = 'ITEM' | 'MEETING' | 'OUTSIDE' | 'TRIP';
  export type EventTarget =
    | { mode: 'create'; date: string; owner: User; allowed: EventKind[] }   // 남의 칸이면 ['MEETING']
    | { mode: 'edit'; entry: DayEntry }                                     // ITEM·MEETING·OUTSIDE(본인 등록)
    | { mode: 'view'; entry: DayEntry };
  export interface EventFormState { kind: EventKind; tagId: string; title: string; date: string; endDate: string; allDay: boolean;
    range: MinuteRange | null; memo: string; attendeeIds: string[]; visibility: CalendarVisibility;
    locationMode: 'text' | 'room'; locationText: string; roomId: string | null;
    subType: string; destination: string; purpose: string; companionIds: string[]; transportation: string; contact: string; }
  export function useWorkPlanEventForm(target: EventTarget, actor: User, deptId: string | null): {
    state: EventFormState; set: <K extends keyof EventFormState>(k: K, v: EventFormState[K]) => void;
    setKind: (kind: EventKind) => void;   // 수정 모드에선 같은 출처 안에서만
    readOnly: boolean; similarMeetings: CalendarEvent[]; join: (e: CalendarEvent) => Promise<void>;
    error: string; saving: boolean; save: () => Promise<boolean>; remove: (() => Promise<boolean>) | null;
  };
  ```
  - 남의 칸 create: `attendeeIds` 초기값 `[owner.id]`, 주최자 = actor.
  - 외근·출장 subType 기본 = `OUTSIDE_WORK_SUBTYPES[category][0]`.
  - 저장 전 검증은 각 zod 스키마 `safeParse`로 첫 오류 메시지. 실패 시 `error` 설정·`false` 반환(창 유지). `RoomRollbackError`면 그 문구.
  - 방 선택 중 시간이 바뀌어 `roomAvailability`가 false가 되면 `roomId=null`, `error='고른 시간에 이미 예약된 회의실이라 선택을 해제했습니다.'`
- [ ] **Step 1:** 구현. **Step 2:** `npx tsc --noEmit`. **Step 3:** 커밋 `feat(업무계획): 일정 창 상태·저장 훅`

---

### Task 9: PC 일정 창 `WorkPlanEventModal` (+ `EventFields`, `RoomPicker`)

**Files:**
- Create: `src/modules/gw/task/event/WorkPlanEventModal.tsx`, `EventFields.tsx`, `RoomPicker.tsx`

**Interfaces:**
- Consumes: Task 7 `TimeGrid`/`entriesToBlocks`, Task 8 훅, `indexDayEntries` 결과(부모가 넘김), `MemberPicker`(`@/modules/gw/task/MemberPicker`), `useResources`, `useReservations`
- Produces: `export function WorkPlanEventModal(props: { target: EventTarget; actor: User; deptId: string | null; users: User[]; cellOf: (userId: string, date: string) => DayCell; onClose: () => void; onSaved: (message: string) => void }): JSX.Element`
  - 시안: `.superpowers/brainstorm/427-1792453662/content/modal-layout-v2.html` C안 + 전체 창. 폭 760, 2열(좌 입력 / 우 220~260px 시간표).
  - 도구 막대: 분할 버튼 [회의][외근][출장][일반 ▾](lucide `Users`·`MapPin`·`Plane`·`ChevronDown`), `allowed`에 없는 건 disabled. 오른쪽 [리마인드](`Bell`)·[루틴](`Repeat`) disabled, 툴팁 없음.
  - 입력 칸 = spec 3.2 표. 아이콘 열: `Clock`·`Users`·`MapPin`·`AlignLeft`.
  - `RoomPicker`: 직접 적기/회의실 토글, 방 목록 = 이름 + 수용 인원, 비어 있지 않은 방은 disabled + "예약 있음".
  - 시간표 blocks = 대상자 + (회의면) 참석자 각각 `cellOf(id, date).entries` → `entriesToBlocks` + 고른 방의 그날 예약(tone 'room').
  - 바닥: [취소][저장], 수정 모드 왼쪽 [삭제](danger → 확인 후 dangerSolid). 보기 모드는 [닫기]만.
  - 저장 성공 메시지: 일반 '업무를 저장했습니다.', 회의 '회의를 저장했습니다.', 외근·출장 '외근·출장을 저장했습니다.'
- [ ] **Step 1:** 구현. **Step 2:** `npx tsc --noEmit`, `npm run build`. **Step 3:** 커밋 `feat(업무계획): 팀즈식 일정 창(PC)`

---

### Task 10: 표 연결 — 칩·진입점·이전 메모, 편집기 제거

**Files:**
- Modify: `src/modules/gw/task/components/WorkPlanTeamMonthlyMatrix.tsx`, `src/modules/gw/task/WorkPlanScreen.tsx`

**Interfaces:**
- Consumes: Task 2 훅, Task 3 `indexDayEntries`, Task 9 `WorkPlanEventModal`

- [ ] **Step 1: 표** — `projectedSchedulesMap`(246~386행)과 `parsed` 글 렌더(840~935행)를 `indexDayEntries` 결과로 교체. 칩 = `종일`/`HH:mm` + `[태그]`(ITEM은 태그 색, 회의 기존 보라, 외근·결재는 기존 `scheduleChip`·`STATUS_TONES`) + 제목, 회의 `roomStatus` PENDING → "대기", REJECTED → "회의실 반려" 작은 표시. 여러 날 막대(`weekBarsOf`)는 entries의 `outside`로 유지. 칸 아래 "이전 메모"(text-ink3, 3줄 넘으면 접기/펼치기).
- [ ] **Step 2: 진입점** — `td` `onClick` 편집 열기 제거. `onDoubleClick` 및 hover 시 오른쪽 위 [+](lucide `Plus`) → `onCreate(date, member)`. 사용 중 아닌 actor면 둘 다 없음. 칩 클릭 → `onOpenEntry(entry)`. 전사 공통 일정 줄(`onOpenCompanySchedule`)은 그대로.
- [ ] **Step 3: 화면** — `WorkPlanScreen`에서 `editingTarget`·`editingContent`·`savePlan`·`removePlan`·`handleToggleItem`·`WorkPlanOfficeRibbonToolbar`·회의/외근 별도 창 상태 제거, `eventTarget` 하나로 `WorkPlanEventModal` 연다. create 허용 태그: 본인 = 4종, 남 = `['MEETING']`. edit 가능: ITEM(본인), MEETING(주최자), OUTSIDE(`outside.self` 본인). 그 외 view. 결재 건(`APPROVAL`)과 동행 외근은 기존 `OutsideWorkDetailModal`로. 전사 공통 일정 저장 로직(`create/update/remove` 훅 사용 부분)은 남긴다.
- [ ] **Step 4: 죽은 코드** — `WorkPlanRichEditor`·`WorkPlanOfficeRibbonToolbar`·`WorkPlanFormatButtons`·`WorkPlanInlineText`를 `grep -rn`으로 다른 사용처 확인 후, 없으면 삭제. `workPlanCalendarBridge`의 새 동기화 생성 호출이 남아 있으면 제거(정리 함수 `isWorkPlanDerivedEvent`는 유지).
- [ ] **Step 5:** `npx tsc --noEmit`, 전체 테스트, `npm run build` 통과
- [ ] **Step 6: 커밋** — `feat(업무계획): 칸을 항목 칩으로, 더블클릭·[+]로 일정 창`

---

### Task 11: 태그 관리 (PC)

**Files:**
- Modify: `src/modules/gw/task/components/WorkPlanConfigModal.tsx`

**Interfaces:**
- Consumes: `useWorkPlanTags`, `useSaveWorkPlanTag`, `FIXED_WORK_PLAN_TAGS`, `TAG_COLOR_PRESETS`(`@/features/workPlan/useWorkPlanConfig`)
- Produces: `export function WorkPlanTagManager(props: { canEdit: boolean }): JSX.Element` (모바일 Task 12도 사용) — 같은 파일 또는 `src/modules/gw/task/event/WorkPlanTagManager.tsx`

- [ ] **Step 1:** 고정 3개는 `Lock` 아이콘과 함께 읽기 전용. 일반: 이름(10자)·색 선택·위/아래 순서·[숨기기]/[다시 보이기]·추가. 오류(`WorkPlanTagError`)는 칸 아래 문구. 권한 없는 사람은 보기만.
- [ ] **Step 2:** 루틴 템플릿·개인 태그(localStorage) 편집 UI 제거. `useWorkPlanConfig`의 `tagMap`은 `CalendarScreen`·`MobileWorkPlanAdminScreen`이 아직 쓰므로 훅 자체는 남긴다.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run build`. **Step 4:** 커밋 `feat(업무계획): 관리자 태그 관리를 공용 태그로`

---

### Task 12: 모바일

**Files:**
- Create: `src/modules/gw/task/event/MobileWorkPlanEventSheet.tsx`
- Modify: `src/mobile/MobileTaskScreen.tsx`

**Interfaces:**
- Consumes: Task 8 훅(같은 저장), Task 7 `TimeGrid` mode 'touch', `quickDefaultRange`, Task 11 `WorkPlanTagManager`, Task 3 `indexDayEntries`
- Produces: `export function MobileWorkPlanEventSheet(props: { target: EventTarget; actor: User; deptId: string | null; users: User[]; cellOf: (userId: string, date: string) => DayCell; onClose: () => void; onSaved: (message: string) => void }): JSX.Element`

- [ ] **Step 1: 시트** — 전체 화면. 머리줄: 닫기 · "새 일정/일정 수정" · ⋯ 메뉴(리마인드·루틴 비활성). 처음 보이는 것: 태그 버튼 줄(가로 스크롤 없이 4칸), 제목(외근·출장은 행선지), 날짜·시간(새 일정 기본 `quickDefaultRange(new Date())`), 외근·출장이면 세부 구분 한 줄. [시간표] 접힘 → `TimeGrid mode="touch"`. [자세히] 접힘 → 나머지 칸 전부(회의면 참석자 칸은 처음부터 펼침). 하단 고정 [저장].
- [ ] **Step 2: 목록** — `MobileTaskScreen`의 To-Do 입력·체크 UI를 그 날 `cellOf(user, date).entries` 시간순 목록 + 이전 메모로 교체(나/팀원 전환·부서 필터는 유지). [+] → 시트(본인 4종 / 팀원 보기 중이면 회의만). 항목 탭 → edit/view. 관리자에게 [태그 관리] 진입(`WorkPlanTagManager`를 시트로).
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run build`. **Step 4:** 커밋 `feat(업무계획): 모바일 빠른 입력 일정 창·항목 목록`

---

### Task 13: 화면 확인·정리

- [ ] **Step 1:** 전체 검증 — `npx tsc --noEmit`, 전체 테스트, `npm run build` 모두 통과
- [ ] **Step 2:** 개발 서버에서 확인(`run-app` 스킬, 로그인 계정은 사용자에게 받는다 — seed 계정은 운영 Appwrite에서 실패). PC 1440px·모바일 390px 각각:
  - 본인 칸 더블클릭·[+] → 일반 항목 추가·수정·삭제, 시간표 클릭·끌기·옮기기·늘리기가 왼쪽 시간과 맞는지
  - 다른 사람 칸 → 회의만 선택 가능, 그 사람이 참석자로 들어감, 그 사람 칸·캘린더에 표시
  - 회의실: 즉시확정 방(확정), 승인 필요 방(칩 "대기"), 예약 있는 방 비활성, 시간 바꿔 겹치면 선택 해제
  - 외근·출장 등록(여러 날 막대), 세부 구분 기본값
  - 캘린더 화면에서 연결 회의 시간 변경·삭제 → 자원예약에 반영
  - 이전 메모 표시, 전사 공통 일정 줄 작성·수정
  - 태그 관리(추가·숨김·순서), 숨긴 태그 항목은 계속 보임
- [ ] **Step 3:** 확인에 쓴 시험 데이터 삭제(새 컬렉션 문서, 시험으로 만든 회의·예약만).
- [ ] **Step 4:** 커밋(수정분이 있으면) 후 develop을 `origin`·`gitlab`·`fork`의 develop에 push(rule-git-sync 절차). **운영 DB(`--prod`)와 `origin main`은 사용자 지시가 있을 때만**: 순서 = `appwrite-schema.ts --prod --only=calendarEvents,workPlanItems,workPlanTags` → `provision-work-plan-tags.ts --prod` → main 병합·검증 → 사용자가 `git push origin main`.
