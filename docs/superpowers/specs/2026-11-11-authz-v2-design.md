# 권한 체계 전면 개편 설계 (기능 권한 + 역할 + 범위)

- 작성일: 2026-11-11
- 브랜치: `feature/admin-console`
- 이 문서가 `2026-11-11-admin-permission-stage12-design.md`(메뉴별 권한표 위의 1·2단계)를 대신한다. 그 문서의 변경 기록·잠금 방지·사람별 권한 확인은 이 설계 안에 그대로 들어온다.
- 사용자 결정 (11-11)
  - 모델: 기능 권한 + 역할 + 범위
  - 적용: 업무 화면까지 전부
  - 기존 데이터: 새 체계로 변환하고, 옛 데이터는 지우지 않고 남김

---

## 1. 왜 바꾸나 — 지금 체계의 문제

지금 권한은 두 갈래가 섞여 있다.

**(가) 화면 × 보기·작성·수정·삭제 표**
- `roleGroups.menuPermissions` 에 저장하고, 대상은 `roleMappings` 에 둔다.
- `canAccess(url)`, `canAction(화면, 작업)` 이 이 표를 본다.

**(나) 표 밖에서 코드가 직접 판정**

| 판정 | 쓰는 곳 | 근거 |
|---|---|---|
| `isExecutive` | 결재 보안 문서 열람, 전사 일정 관리, 좌석 배치 편집, 근태 전사 조회 | 그룹 코드 EXEC·OPERATOR, 직급의 `isExecutiveRole`, 직급·직책 **이름**(대표·상무·이사…) |
| `isLeader` | 근태 부서 조회 | 조직도 부서장, 겸직 HEAD, 직급의 `isLeaderRole`, 직책·**이름**(팀장·부서장…) |
| `isOperator` | 후열 전달, 전사 일정, 좌석 배치 | 그룹 코드 OPERATOR, 사용자 `role` 칸 |
| `isSuperAdmin` | 테스트 계정 표시, 메신저 관리, 회의 삭제, 업무계획 정렬·태그, 발주·자원·문서 관리 | ADMIN 그룹, 사용자 `role === 'admin'` |
| 근태 관제 예외 | 최고 관리자도 근태 관제·업무 종합 현황은 자동 통과 안 함 | 코드에 박힌 화면 목록 |

이 구조에서 생기는 문제는 다섯 가지다.

1. **권한표를 바꿔도 안 바뀌는 권한이 많다.** 전사 일정 관리, 보안 문서 열람, 근태 조회 범위는 표에 없다.
2. **이름으로 권한이 정해진다.** 직책을 '팀장'으로 적으면 근태 열람 범위가 바뀐다.
3. **'화면'과 '할 수 있는 일'이 맞지 않는다.** 예를 들어 게시판 '작성'이 공지 작성인지 일반 글 작성인지 구분이 안 된다.
4. **범위가 없다.** "우리 본부만" 같은 지정을 할 수 없다.
5. **관리자 역할을 나눌 수 없다.** 최고 관리자가 모든 데이터를 보는 구조라, 근태처럼 예외를 코드에 박아야 했다.

## 2. 새 모델 한눈에

```
권한(코드에 정의)       역할(DB, 권한 묶음)          지정(DB)
──────────────         ────────────────            ─────────────────────────
calendar.company   ─┐
commute.view       ─┼─▶  임원 ─────────────────▶  대상: 직급 '이사' 이상  범위: 전사
approval.secure    ─┘
commute.view       ───▶  부서장 ───────────────▶  대상: 조직도 부서장      범위: 본인 부서와 하위
admin.user.manage  ───▶  인사 관리자 ───────────▶  대상: 홍길동            범위: AX지능화본부와 하위
```

- **권한:** "무엇을 할 수 있나"의 최소 단위다. 코드에 정의하고, 화면과 버튼은 이 권한만 본다.
- **역할:** 권한의 묶음이다. 관리자가 콘솔에서 만들고 고친다.
- **지정:** 역할을 누구에게 어느 범위로 줄지 정한다. 한 역할을 여러 대상에게, 서로 다른 범위로 줄 수 있다.
- **최종 권한:** 내가 받은 모든 지정을 합친 것(합집합)이다. 범위도 합친다. "막는 권한"은 두지 않는다 — 단순함을 위해.

## 3. 권한 목록 (코드에 정의)

파일: `src/domain/authz/permissions.ts`

```ts
interface PermissionDef {
  key: string;            // 'calendar.company'
  name: string;           // '전사 일정 관리'
  desc: string;           // 화면에 보이는 한 줄 설명
  area: AreaId;           // 권한 화면에서 묶어 보이는 영역
  scoped?: boolean;       // 범위를 받는 권한인가(조직 범위)
  grantable?: false;      // false = 최고 관리자 전용, 역할에 넣을 수 없음
  adminConsole?: boolean; // 콘솔 화면 권한 — 전 직원 역할에는 넣을 수 없음
  implies?: string[];     // 이 권한이 있으면 따라오는 권한(관리 → 보기)
}
```

### 3-1. 업무

| 영역 | 키 | 이름 | 범위 | 지금의 근거 |
|---|---|---|---|---|
| 전자결재 | `approval.use` | 기안·결재 | | 전자결재 보기·작성 |
| | `approval.secure` | 보안·비공개 문서 열람 | O | `isExecutive`(문서 보기·모바일) |
| | `approval.postread.forward` | 후열 전달 | | `isOperator \|\| isAdmin` |
| 근태·휴가 | `commute.self` | 내 근태·휴가 | | 근태관리·휴가관리 보기 |
| | `commute.view` | 다른 사람 근태·휴가 열람 | O | `resolveCommuteScope`(임원 전사, 팀장 부서) |
| | `commute.manage` | 근태 수정·연차 대장 관리 | O | 근태 관제 수정 |
| 업무계획·프로젝트 | `workplan.use` | 업무계획·프로젝트 | | 업무계획·프로젝트 보기 |
| | `workplan.view` | 다른 사람 업무계획 열람 | O | `resolveWorkPlanScope`(지금은 모두 전사) |
| | `workplan.overview` | 팀·전사 업무 종합 현황 | O | 업무 종합 현황 보기 |
| | `workplan.manage` | 명단 순서·태그 관리 | | `isSuperAdmin \|\| 업무 종합 현황 수정` |
| | `project.create` | 프로젝트 만들기 | | 프로젝트 작성 |
| 게시판·소통 | `board.use` | 게시판 읽기·쓰기 | | 게시판 보기·작성 |
| | `board.manage` | 게시판 관리(다른 사람 글 수정·삭제) | | 게시판 수정·삭제 |
| | `survey.use` | 설문 응답 | | 전자설문 보기 |
| | `survey.manage` | 설문 만들기 | | 전자설문 작성 |
| | `gallery.use` / `mail.use` / `messenger.use` | 갤러리·메일·메신저 | | 각 보기 |
| | `messenger.manage` | 메신저 관리(방 정리·공지) | | `isSuperAdmin` |
| 일정·자원 | `calendar.use` | 캘린더 | | 캘린더 보기 |
| | `calendar.company` | 전사 일정 관리 | | `isOperator \|\| isExecutive` |
| | `resource.use` | 자원 예약 | | 자원예약 보기·작성 |
| | `resource.manage` | 자원 등록·관리 | | `isAdmin \|\| 자원예약 수정` |
| 조직 | `org.view` | 조직도·인명 | | 조직도·인명관리 보기 |
| | `seat.manage` | 좌석 배치 편집 | | `isOperator \|\| isExecutive` |
| 문서관리 | `document.view` / `document.manage` | 문서 열람 / 등록·수정 | | 문서관리 보기·작성·수정 |
| 사업관리 | `biz.vendor.view` / `.manage` | 도입기업 | | 도입기업 보기 / 작성·수정·삭제 |
| | `biz.project.view` / `.manage` | 사업 현황 | | 사업 현황 |
| | `biz.po.view` / `.manage` | 발주 현황 | | `isAdmin \|\| 발주 수정` |
| 경영 | `exec.dashboard` | 경영 현황 위젯 | | 경영 대시보드 |

### 3-2. 관리자 콘솔 (`adminConsole: true`)

| 영역 | 키 | 이름 | 범위 |
|---|---|---|---|
| 구성원·조직 | `admin.user.view` / `.manage` | 사용자 관리 | O (3단계에서 범위 적용, 지금은 전사만) |
| | `admin.org.view` / `.manage` | 부서·조직 관리 | |
| | `admin.position.view` / `.manage` | 직급·직책 관리 | |
| 전자결재 | `admin.approval.form.view` / `.manage` | 결재서식 관리 | |
| | `admin.approval.rule.view` / `.manage` | 결재선 규칙 | |
| | `admin.approval.process.view` / `.manage` | 결재 프로세스 설정 | |
| | `admin.approval.monitor` | 결재문서 모니터링 | |
| 회사·운영 | `admin.company.view` / `.manage` | 회사 정보 | |
| | `admin.holiday.view` / `.manage` | 공휴일 관리 | |
| | `admin.code.view` / `.manage` | 공통코드 | |
| 시스템 | `admin.log.view` | 로그 관리 | |
| | `admin.interface.view` / `.manage` | 인터페이스 관리 | |
| 최고 관리자 전용 (`grantable: false`) | `admin.authz` | 역할·권한 관리 | |
| | `admin.backup` | 데이터 백업 | |
| | `admin.testAccounts` | 테스트 계정 보기 전환 | |

- `.manage` 는 같은 이름의 `.view` 를 포함한다(`implies`).
- 콘솔 출입 = `adminConsole` 권한이 하나라도 있음.

### 3-3. 메뉴·화면 연결

menu-tree 의 각 화면에 필요한 권한을 적는다. 그중 하나라도 있으면 메뉴가 보이고 주소로 들어갈 수 있다.

```ts
{ id: 'S_GW_COMMUTE_ADMIN', name: '근태/휴가 관제 센터', url: '/gw/commute/admin', perms: ['commute.view', 'commute.manage'] }
{ id: 'S_BASE_APFORM', name: '결재서식 관리', url: '/base/approval-form', perms: ['admin.approval.form.view'] }
```

- `SYSTEM_SCREENS`(권한표 화면 목록)는 메뉴와 권한을 잇는 역할을 끝낸다. 로그 표시용 화면 이름만 남긴다.

## 4. 역할

### 4-1. 데이터 — 새 컬렉션 `authRoles`

| 칸 | 형 | 설명 |
|---|---|---|
| `$id` | | `ROLE-` + 짧은 무작위 문자열 |
| `name` | 문자열 128 | 화면 표시 이름(중복 불가) |
| `desc` | 문자열 512 | |
| `permissions` | JSON 문자열 배열 | 권한 키 목록 |
| `kind` | `super` \| `base` \| `custom` | 최고 관리자 / 전 직원 기본 / 일반 |
| `use` | 불리언 | |
| `sort` | 정수 | 목록 순서 |
| `migratedFrom` | 문자열 64 | 변환 출처(옛 그룹 코드나 '임원 규칙' 등), 새로 만든 역할은 빈 값 |

### 4-2. 고정 역할

| 역할 | 종류 | 규칙 |
|---|---|---|
| 최고 관리자 | `super` | 콘솔 권한 전부 + 최고 관리자 전용 권한. 권한 목록은 고칠 수 없음. 삭제·끄기 불가 |
| 전 직원 | `base` | 사용 중인 모든 직원에게 자동. 콘솔 권한은 넣을 수 없음. 삭제·끄기 불가 |

**중요:** 최고 관리자는 **시스템 관리 권한만** 가진다. 근태 열람이나 보안 문서 열람 같은 업무 데이터 권한은 자동으로 주지 않는다. 지금 코드에 박힌 '근태 관제 예외'가 모델 자체로 풀리는 셈이다. 최고 관리자이면서 임원인 사람은 임원 역할을 따로 받는다.

## 5. 지정과 범위

### 5-1. 데이터 — 새 컬렉션 `authAssignments`

| 칸 | 형 | 설명 |
|---|---|---|
| `roleId` | 문자열 64 | |
| `targetType` | `USER` \| `DEPT` \| `POSITION` \| `DEPT_HEAD` | 사람 / 부서 / 직급 / 조직도상 부서장 전부 |
| `targetId` | 문자열 64 | 사용자 id, 부서 id, 직급 id. `DEPT_HEAD` 는 빈 값 |
| `targetSub` | 불리언 | 부서 대상일 때 하위 부서 사람 포함 |
| `positionMode` | `EQ` \| `GTE` | 직급 대상일 때: 그 직급만 / 그 직급 이상(서열 기준) |
| `scopeType` | `ALL` \| `OWN_DEPT` \| `DEPTS` | 전사 / 본인 소속 부서 / 지정 조직 |
| `scopeDeptIds` | JSON 문자열 배열 | `DEPTS` 일 때 |
| `scopeSub` | 불리언 | 범위에 하위 부서 포함(기본 켬) |
| `regBy`, `regAt` | | 누가·언제 |

- 범위는 역할 안의 **범위를 받는 권한**(`scoped`)에만 적용된다. 범위가 없는 권한은 지정되면 그냥 켜진다.
- `OWN_DEPT` 는 받는 사람마다 다르게 풀린다. 주 소속, 겸직 부서, 조직도에서 부서장인 부서를 모두 포함한다.
- 사람을 부서나 직급으로 찾을 때는 이름이 아니라 id로 찾는다(소속 ID 백필 완료).

### 5-2. 판정 엔진 — `src/domain/authz/engine.ts` (순수 함수)

```ts
resolveGrants(user, roles, assignments, org): Grants
//  Grants = Map<권한 키, { all: boolean; deptIds: Set<string>; via: { roleId, assignmentId }[] }>

can(grants, key): boolean                       // 범위와 상관없이 하나라도 있으면
canOnDept(grants, key, deptId): boolean         // 그 부서가 범위 안인가
canOnUser(grants, key, targetUser, org): boolean // 대상자의 소속(겸직 포함)이 범위 안인가
explain(grants, key): 근거 목록                  // 사람별 권한 화면용
```

- 사용 안 함('미사용') 사용자에게는 아무 권한도 주지 않는다.
- 꺼진 역할의 지정은 무시한다.
- `implies` 는 미리 펼쳐 둔다.
- 테스트 계정 격리(`useCanDesignate`, 사람 목록 저장소의 숨김)는 권한이 아니므로 그대로 둔다.

### 5-3. 훅

```ts
const { can, canOnUser, canOnDept, scopeOf, isSuperAdmin } = useAuthz();
```

- `isSuperAdmin` = 최고 관리자 역할이 있음(로그·표시용). 화면 판정은 될 수 있으면 `can('…')` 으로 한다.

## 6. 콘솔 화면 — '권한' 영역 개편

지금의 '그룹 권한 관리'(화면 × 작업 표) 하나를 다음 세 화면으로 바꾼다.

| 화면 | 내용 |
|---|---|
| **역할 관리** | 왼쪽: 역할 목록(고정 역할 위). 오른쪽: 이름·설명, 권한 체크 목록(영역별로 묶고 권한마다 설명 한 줄, 범위를 받는 권한은 '범위 지정 가능' 표시), 그리고 이 역할을 받은 대상 목록. '새 역할' 은 빈 역할이나 서식(인사 관리자·결재 관리자·운영 관리자)으로 시작 |
| **역할 지정** | 역할을 골라 대상 추가: 사람·부서(하위 포함)·직급(그 직급만 / 이상)·부서장. 범위 고르기: 전사·본인 소속 부서·지정 조직. 한 줄에 '누구에게 · 어느 범위로' 를 보여줌 |
| **사람별 권한** | 사람을 고르면 받은 역할과 그 이유(전 직원 기본, 개인, 부서, 직급, 부서장), 그리고 권한별 결과와 범위를 보여줌. 콘솔 출입 여부도 보여줌 |

**공통 규칙:**
- **변경 기록:** 역할의 생성·수정·삭제와 지정의 추가·삭제를 `systemLogs`(`변경`)에 사람이 읽는 문장으로 남긴다.
- **잠금 방지:** 저장 결과 최고 관리자가 0명이면 막는다. 본인 해제는 확인을 받는다. 사용자 관리에서 미사용 전환, 부서·직급 변경에도 같은 검사를 한다.
- 전 직원 역할에서 콘솔 권한 체크는 잠근다. 최고 관리자 전용 권한은 목록에 보이되 잠근다.
- 화면에 ID·코드를 보이지 않는다. 권한 키 대신 이름과 설명을 보인다.

## 7. 변환 — 옛 데이터에서 새 역할로

스크립트: `scripts/migrate-authz-v2.ts`. 옛 컬렉션은 **읽기만** 하고, 새 컬렉션에만 쓴다.

### 7-1. 변환 규칙

| 옛것 | 새것 |
|---|---|
| ADMIN 그룹과 그 대상(사람·부서·직급·members) | 최고 관리자 역할 + 같은 대상 지정 |
| 사용자 `role === 'admin'` | 그 사람에게 최고 관리자 지정 |
| USER 그룹 권한표 | 전 직원 역할(표 → 권한 대응표로 변환) |
| 그 밖의 그룹(임원·재무담당자 등) | 같은 이름의 일반 역할 + 같은 대상, 범위는 전사 |
| 이름·플래그로 판정하던 임원 (`isExecutiveRole` 직급, EXEC·OPERATOR 그룹, 임원 직급·직책 이름을 가진 사람) | '임원' 역할: `approval.secure`·`commute.view`·`calendar.company`·`seat.manage`, 범위 전사. 대상은 해당 직급(직급 단위)과 이름으로만 걸리던 사람(개인 지정) |
| 팀장 판정 (조직도 부서장, 겸직 HEAD, `isLeaderRole` 직급, 팀장류 직책 이름) | '부서장' 역할: `commute.view`, 범위 본인 소속 부서. 대상은 `DEPT_HEAD` + `isLeaderRole` 직급 + 이름으로만 걸리던 사람 |
| 운영자(OPERATOR 그룹, `role === 'operator'`) | '운영자' 역할: `approval.postread.forward`·`calendar.company`·`seat.manage` |

**화면 × 작업 → 권한 대응표**는 `src/domain/authz/legacyMap.ts` 에 코드로 둔다(예: `S_GW_BOARD.update|delete → board.manage`, `S_BASE_APFORM.access → admin.approval.form.view`, `create|update|delete → .manage`). 테스트로 모든 화면·작업이 대응되는지 확인한다.

### 7-2. 같은 권한인지 비교 (변환 전에 반드시)

- 스크립트는 기본이 **미리보기**다. 사용 중인 모든 사람에 대해 다음 두 결과를 계산해 표로 낸다.
  - 옛 판정(지금 코드의 `canMenuAccess`·`canMenuAction`·`isExecutive`·`isLeader`·`isOperator`·`resolveCommuteScope`)
  - 새 판정(`resolveGrants`)
- 결과는 세 가지로 나눈다.
  - 같음
  - 의도한 차이: 최고 관리자에게 업무 데이터 권한이 자동으로 따라가지 않는 경우 등
  - 의도하지 않은 차이 — **1건이라도 있으면 쓰지 않는다**
- `--apply` 를 붙여야 실제로 쓴다. 이미 변환된 역할(`migratedFrom` 같음)이 있으면 건너뛴다(두 번 돌려도 중복 없음).
- 개발 DB에서 먼저 돌린다. 운영은 미리보기 결과를 보고드리고 지시를 받은 뒤 돌린다.

### 7-3. 옛 데이터

- `roleGroups`·`roleMappings` 와 직급의 `isLeaderRole`·`isExecutiveRole` 칸은 지우지 않는다.
- 새 코드는 권한 판정에 이것들을 쓰지 않는다. 직급의 두 칸은 명단 정렬(임원 먼저) 같은 **표시 용도**로만 남긴다.
- 직급 관리 화면의 "권한 자동 부여" 체크 문구는 "임원 직급(명단 정렬)" 같은 표시용 이름으로 바꾼다.
- 되돌리기: 옛 코드로 되돌려 배포하면 옛 데이터가 그대로 있어서 바로 예전처럼 동작한다.

## 8. 바꾸는 곳 (약 60곳)

| 묶음 | 파일 예 | 바뀜 |
|---|---|---|
| 메뉴·라우트 | `menu-tree.ts`, `Sidebar`, `Topbar`, `App.tsx` ProtectedRoute, `GroupwarePanel`, `AdminConsole` | `canAccess(url)` → 화면의 `perms` 로 판정 |
| 화면 작업 버튼 | 게시판·자원·사업관리·문서·업무계획·근태·휴가·설문, 콘솔 화면 전부, `ActionBar` | `canAction(화면, 작업)` → `can('…')` |
| 이름·플래그 판정 | `ApprovalDocumentView`, `MobileApprovalDetail`, `CalendarScreen`, `CalendarEventModal`, `MobileCalendarScreen`, `SeatLayoutView`, `ApprovalScreen`(후열), `MessengerPanel`, `MobileChatThread`, `WorkPlanScreen`, `MobileTaskScreen`, `BizPoScreen`, `ResourceAdmin`, `DocumentScreen`, `Topbar`(테스트 계정 전환) | `isExecutive`·`isOperator`·`isSuperAdmin` → `can('…')` |
| 조회 범위 | `CommuteScreen`, `LeaveScreen`, 근태 관제, `WorkPlanScreen`, `CalendarScreen`, `MobileTaskScreen`, `MobileWorkPlanAdminScreen` | `resolveCommuteScope`·`resolveWorkPlanScope`·`canViewWorkPlan` → `canOnUser('commute.view', 대상)` 등 |
| 제거 | `scopeHelper.ts` 의 판정 함수, `useSecurityContext` 의 이름 키워드 목록, `usePermission` | 엔진과 훅으로 대체(명단 정렬용 임원 판정은 표시용으로 분리) |

## 9. 진행 순서

1. **엔진** — `permissions.ts`·`engine.ts`·`legacyMap.ts` + 단위 테스트. 화면 변화 없음.
2. **데이터** — `authRoles`·`authAssignments` 컬렉션 정의(`appwrite-schema.ts`), 저장소·훅, 개발 DB에 생성.
3. **변환 스크립트 + 비교표** — 개발 DB 미리보기 → 차이 0건 확인 → 개발 DB에 적용.
4. **판정 교체(한 번에)** — `usePermission` 을 새 엔진 위의 얇은 어댑터로 바꿔서 모든 화면이 새 데이터를 보게 한다. 개발 서버에서 계정 몇 개로 메뉴·버튼을 비교 캡처.
5. **콘솔 화면** — 역할 관리·역할 지정·사람별 권한, 변경 기록, 잠금 방지. 그룹 권한 관리 화면 제거.
6. **호출부 정리** — 60곳을 `can('…')`·`canOnUser` 로 바꾸고 어댑터·`scopeHelper` 판정 제거.
7. **운영** — 컬렉션 생성 → 미리보기 결과 보고 → 지시 후 적용 → 지시 후 배포.

각 단계마다 타입 검사, 전체 테스트, 빌드를 하고 커밋한다. 4단계 끝에서 한 번, 6단계 끝에서 한 번 화면 전체를 확인한다.

## 10. 범위 밖

- 서버 쪽 강제(Appwrite 문서 권한·함수 검사): 이번 모델은 권한 키가 정리돼 있어서 다음 단계에서 그대로 서버로 옮길 수 있다. 이번에는 하지 않는다.
- 사용자 관리의 조직 범위 적용(`admin.user.manage` 범위): 데이터 구조와 엔진은 준비하지만, 화면 적용은 다음 단계로 미룬다.
- '막는 권한'(거부 규칙): 두지 않는다.
- 결재선·결재 규칙의 결재자 판정: 권한이 아니라 결재 흐름이라 건드리지 않는다.

## 11. 위험과 대응

| 위험 | 대응 |
|---|---|
| 변환 후 누군가 권한을 잃거나 더 얻음 | 7-2 비교표에서 의도하지 않은 차이 0건일 때만 적용, 운영은 보고 후 |
| 이름으로만 임원·팀장으로 판정되던 사람 누락 | 변환 시 그런 사람을 개인 지정으로 옮기고 비교표에 '이름으로만 판정되던 사람' 목록을 따로 표시 |
| 최고 관리자가 근태 등 업무 데이터 권한을 잃음 | 의도한 변경. 최고 관리자 중 임원·부서장인 사람은 해당 역할을 받으므로 실제 차이는 비교표에서 확인 |
| 60곳 교체 중 누락 | 4단계 어댑터로 먼저 전체 전환한 뒤 6단계에서 하나씩 바꾼다. 마지막에 `usePermission`·`isExecutive`·`resolveCommuteScope` 검색 결과 0건을 확인 |
| 결재 문서·서식 데이터 | 읽지도 쓰지도 않음 |
