# WorkFit 전자결재 시스템 병렬 결재(Parallel Approval) 기능 및 개발 계획서

> **📌 문서 개요**:  
> 본 문서는 WorkFit 전자결재 시스템의 **병렬 결재(Parallel Approval) 및 병렬 합의(Parallel Agreement) 기능 정의**, **데이터 스키마 및 결재 엔진 처리 로직**, **기안 작성 모달의 병렬 그룹 UI 구성**, 그리고 **`/base/approval-process` (결재 프로세스 설정)에서의 기능 사용 여부(ON/OFF) 관리 사양**을 정의하는 3단계 상세 개발 계획서입니다.  
> 
> ⚠️ **원칙 준수 사항 (Rule Compliance & Data Integrity)**:  
> • `[Strict Rule: 데이터베이스 불변성 및 무결성 보장]`에 따라 기존 결재 문서(`approvalDocs`) 및 서식 마스터(`approvalForms`) 데이터를 훼손하지 않으며, 결재 단계 승인 상태 및 병렬 스테이지 전진은 원자적(Atomic) 데이터 업데이트로 처리합니다.

---

## 💡 병렬 결재(Parallel Approval)의 정의 및 WorkFit 시스템 적용 방향

### 1. 개념 및 필요성
- **병렬 결재 (Parallel Approval / Agreement)**: 동일한 결재 단계(Stage)에 복수의 결재자/합의자를 지정하여, 하위 순서의 결재자가 상위 결재자의 승인을 기다리지 않고 **동시에 문서를 확인하고 승인/의견을 제출할 수 있는 비동기 동시 결재 방식**입니다.
- **주요 활용 상황**:
  1. **부서 간 합의 (Cross-Department Agreement)**: 신규 사업 품의 시 재무팀, 법무팀, IT팀이 동시에 문서 검토를 진행하는 경우.
  2. **동일 직급/팀장 동시 승인**: 공동 프로젝트 진행 시 복수의 공동 팀장이 병렬로 동시 승인하는 경우.
  3. **결재 대기 시간 단축**: 순차 결재 시 발생하는 병목 현상을 줄이고 의사결정 속도를 극대화.

### 2. WorkFit 시스템 아키텍처 내 적용 위치
WorkFit 아키텍처 분류에 따라:
- **기본 결재 (Core)**: 기본 결재 승인 방식으로서 **순차 결재(Sequential) vs 병렬 결재(Parallel)** 옵션 제공.
- **커스텀 합의 (Custom Option)**: `부서 간 합의` ON 활성화 시 **순차 합의 vs 병렬 합의(기본)** 옵션으로 작동.

---

## 🛠️ Step 1. 실제 스키마 및 엔진 로직 구현 사양

### 1.1 데이터 스키마 정의 (`ApprovalStep`)

[schema.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/domain/approvalDoc/schema.ts)의 `approvalStepSchema` 및 `ApprovalDoc` 스키마를 다음과 같이 유지/확장합니다.

```typescript
// src/domain/approvalDoc/schema.ts

/** 결재 구분 — 각 결재선 노드의 역할 */
export const STEP_KINDS = ['결재', '합의', '참조', '전결', '대결'] as const;
/** 노드 결정 상태 */
export const STEP_DECISIONS = ['대기', '승인', '반려', '보류'] as const;

/** 결재선 노드 (ApprovalStep) */
export const approvalStepSchema = z.object({
  /** 직렬 순서 (Stage 순번, 1부터 시작) */
  seq: z.number().int().min(1),
  
  /** 
   * 병렬 그룹 태그 — 동일 그룹명(예: 'p-group-1')을 가진 노드들은 동시 활성화(병렬 처리).
   * null 인 경우 직렬(순차) 결재 노드로 처리.
   */
  parallelGroup: z.string().nullable().default(null),
  
  /** 승인 방식 — 'sequential' (순차) | 'parallel' (병렬) */
  executionType: z.enum(['sequential', 'parallel']).default('sequential'),
  
  /** 결재 구분 (결재 | 합의 | 참조 | 전결 | 대결) */
  kind: z.enum(STEP_KINDS),
  
  /** 결재자 user ID */
  approverId: z.string().min(1),
  approverName: z.string().nullable().optional(),
  approverPos: z.string().nullable().optional(),
  approverDept: z.string().nullable().optional(),
  
  /** 노드 결정 상태 (대기 | 승인 | 반려 | 보류) */
  decision: z.enum(STEP_DECISIONS).default('대기'),
  decidedAt: z.string().nullable().default(null),
  comment: z.string().default(''),
});

export type ApprovalStep = z.infer<typeof approvalStepSchema>;
```

---

### 1.2 병렬 결재 엔진 판정 로직 (`Approval Engine`)

문서 진행 중 특정 결재자가 승인/반려 처리를 수행할 때 다음 **4대 엔진 규칙**에 따라 결재 단계를 계산합니다.

```
                  결재 승인/반려 요청 (approverId)
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
       [승인 (Approved)]                     [반려 (Rejected)]
              │                                     │
  현재 parallelGroup 노드 확인             합의 거부 옵션 확인
              │                                     │
   ┌──────────┴──────────┐               ┌──────────┴──────────┐
   │                     │               │                     │
미승인 노드 존재    모든 병렬 노드 승인    합의거부 즉시반려ON    일반 반려
   │                     │               │                     │
[현재 Stage 유지]  [다음 Stage 전진]    [문서 전체 반려]      [문서 전체 반려]
 (상태: 진행중)      (status: 진행중/완료)  (status: 반려)        (status: 반려)
```

1. **현재 결재 가능한 대상자 판정 (`getCurrentApprovers`)**:
   - `decision === '대기'`인 노드 중, 가장 낮은 `seq`를 가진 스테이지를 찾습니다.
   - 해당 `seq`에 속한 모든 노드 중 `parallelGroup`이 동일한 노드들은 **동시에 모두 '현재 결재 진행 대상자'**로 판정합니다.
2. **동시 승인 및 스테이지 전진 (`advanceWorkflowOnApprove`)**:
   - 병렬 그룹 내 특정 결재자가 승인하더라도 `parallelGroup` 내 남아있는 타 결재자들의 `decision`이 여전히 `'대기'`라면 문서 상태는 `'진행중'`을 유지합니다.
   - 해당 `parallelGroup` (또는 동일 `seq`)의 **모든 결재 노드가 `'승인'` 완료되는 순간**, 비로소 차순위 `seq` 단계로 결재가 전진합니다.
3. **병렬 합의 거부 시 처리 (`advanceWorkflowOnReject`)**:
   - 설정의 `agreement_reject_cancel` (합의 거부 시 즉시 반려) 옵션이 **ON**인 경우, 병렬 합의자 중 1명이라도 반려 시 문서는 차순위 진행 없이 즉시 `'반려'`로 종료됩니다.

---

## 🎨 Step 2. 기안 작성 모달의 결재선 설정 섹션 UI 구현

기안 작성 모달([ApprovalFormScreen.tsx](file:///c:/WorkFit/전자결재시스템/workfit-office/src/modules/base/approvalForm/ApprovalFormScreen.tsx) 및 결재선 빌더) 내에서 기안자가 직관적으로 병렬 결재 그룹을 지정하고 시각화할 수 있는 UI를 구축합니다.

### 2.1 병렬 그룹 추가 UI UX 구성

```
[결재선 설정 영역]
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ + 결재자 추가   + 병렬(합의) 그룹 추가   [초기화]                        │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ 1단계 (순차) : [기안자] 홍길동 팀장                                     │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ 2단계 (병렬 그룹 #1) 🔗 [병렬 처리 중]                                   │
 │   ├─ [결재/합의] 김재무 차장 (재무팀)   [⬆][⬇][❌]                      │
 │   └─ [결재/합의] 이법무 과장 (법무팀)   [⬆][⬇][❌]                      │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ 3단계 (순차) : [최종결재] 박대표 대표이사                               │
 └─────────────────────────────────────────────────────────────────────────┘
```

1. **`[+ 병렬 그룹 추가]` 버튼**:
   - 클릭 시 동일한 `seq` 및 `parallelGroup` 식별자(예: `p-group-${Date.now()}`)를 공유하는 병렬 카드 묶음 영역 생성.
2. **드래그 앤 드롭 & 그룹 드롭존 (Drop Zone)**:
   - 조직도에서 사용자를 드래그하여 병렬 그룹 영역 안으로 드롭하면 동일한 병렬 그룹으로 자동 묶임.
3. **병렬 그룹 시각적 디스플레이 (Visual Grouping)**:
   - 병렬 그룹 노드들은 연한 테두리 배경 박스(보라색/민트색 계열)와 `🔗 병렬 동시 결재` 뱃지로 묶어서 수직/수평 결합 연출.

---

## ⚙️ Step 3. `/base/approval-process` 병렬 사용 ON/OFF 및 옵션 관리

관리자 메뉴([ApprovalProcessScreen.tsx](file:///c:/WorkFit/전자결재시스템/workfit-office/src/modules/base/approvalProcess/ApprovalProcessScreen.tsx))에서 병렬 결재 및 합의 기능을 통합 제어할 수 있도록 옵션을 구축합니다.

### 3.1 프로세스 옵션 리포지토리 확장 (`approvalProcess.repo.ts`)

[approvalProcess.repo.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/data/approvalProcess/approvalProcess.repo.ts)에 병렬 사용 및 실행 방식 설정 옵션을 추가합니다.

```typescript
// src/data/approvalProcess/approvalProcess.repo.ts

export const DEFAULT_PROCESS_OPTIONS: ProcessOption[] = [
  // 1. 결재 프로세스
  {
    id: 'parallel_approval_toggle',
    category: '결재 프로세스',
    name: '병렬 결재 기능',
    description: '동일 결재 단계에 복수의 결재자를 지정하여 동시에 결재를 진행할 수 있는 병렬 결재 기능을 허용합니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'parallel_approval_mode',
    category: '결재 프로세스',
    name: '기본 결재 승인 방식',
    description: '기본 결재 승인 방식을 설정합니다. (순차 결재 / 병렬 결재)',
    enabled: true,
    isImplemented: true,
  },

  // 2. 합의 프로세스
  {
    id: 'dept_agreement',
    category: '합의 프로세스',
    name: '부서 간 합의',
    description: '문서 기안 시 타 부서와의 병렬 또는 순차 합의 결재선을 추가하고 의견을 수렴할 수 있는 합의 프로세스를 지원합니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'parallel_agreement_mode',
    category: '합의 프로세스',
    name: '기본 합의 승인 방식',
    description: '합의 진행 시 승인 방식을 설정합니다. (병렬 합의 기본 / 순차 합의)',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'agreement_reject_cancel',
    category: '합의 프로세스',
    name: '합의 거부 시 즉시 반려',
    description: '병렬/순차 합의 단계에서 1명 이상의 합의자가 거부 처리할 경우 문서를 즉시 반려 처리합니다.',
    enabled: true,
    isImplemented: true,
  },
  // ... 기존 기타 옵션 유지
];
```

---

### 3.2 ON/OFF 설정에 따른 시스템 동작 가이드

1. **`parallel_approval_toggle` 이 OFF 인 경우**:
   - 기안 작성 모달의 결재선 빌더에서 `[+ 병렬 그룹 추가]` 버튼이 비활성화(숨김) 처리됨.
   - 기존의 순차(직렬) 결재선 빌더만 제공하여 기본 결재선 무결성 유지.
2. **`parallel_approval_toggle` 이 ON 인 경우**:
   - 결재선 빌더에서 병렬 그룹 추가 기능 활성화.
   - 상신된 문서는 병렬 결재 엔진(`getCurrentApprovers`)에 의해 동시 결재 진행.

---

## 📅 단계별 구현 이행 로드맵 (Execution Plan)

| 단계 | 작업 내용 | 담당 파일 |
| :--- | :--- | :--- |
| **Phase 1: 데이터 스키마 & 엔진 로직** | • `ApprovalStep` 내 `parallelGroup`, `executionType` 스키마 점검<br>• 병렬 동시 결재자 추출(`getCurrentApprovers`) 및 전진 로직 구현 | [schema.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/domain/approvalDoc/schema.ts)<br>[useApprovalDocs.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/features/gw/useApprovalDocs.ts) |
| **Phase 2: `/base/approval-process` UI 확장** | • `approvalProcess.repo.ts`에 병렬 옵션 추가<br>• `ApprovalProcessScreen.tsx`에 병렬 사용 ON/OFF 토글 및 순차/병렬 라디오 제어 UI 추가 | [approvalProcess.repo.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/data/approvalProcess/approvalProcess.repo.ts)<br>[ApprovalProcessScreen.tsx](file:///c:/WorkFit/전자결재시스템/workfit-office/src/modules/base/approvalProcess/ApprovalProcessScreen.tsx) |
| **Phase 3: 기안 작성 모달 병렬 UI** | • 결재선 빌더 내 `[+ 병렬 그룹 추가]` 버튼 및 병렬 박스 묶음 UI 구현<br>• ON/OFF 설정 연동 조건부 렌더링 적용 | `src/modules/gw/approval/ApprovalLineBuilder.tsx`<br>[ApprovalFormScreen.tsx](file:///c:/WorkFit/전자결재시스템/workfit-office/src/modules/base/approvalForm/ApprovalFormScreen.tsx) |
| **Phase 4: 문서 상세 및 병렬 결재선 시각화** | • `ApprovalDocumentView.tsx` 수평 결재선 카드 영역에 병렬 그룹 동시 표기 카드 레이아웃 구현 | [ApprovalDocumentView.tsx](file:///c:/WorkFit/전자결재시스템/workfit-office/src/modules/gw/approval/ApprovalDocumentView.tsx) |

---
*본 문서는 WorkFit 전자결재 시스템의 병렬 결재 기능 구현을 위한 공식 계획서입니다.*
