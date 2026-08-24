# [정규화] 다중 소속 부서 및 관계형 직책 아키텍처 재구축 계획서

이 계획서는 임시 방편으로 사용했던 우회 직렬화(`::` 병합)를 걷어내고, **Appwrite 콘솔의 스키마 정규화 단계부터 프런트엔드 데이터 레이어의 조인(Join), 다중 겸직별 개별 직책을 입력하는 어드민 UI까지** 정석대로 시스템을 재구축하기 위한 전체 마일스톤입니다.

---

## 1. [1단계] Appwrite DB 콘솔 개편 및 인덱스 설계

가장 먼저 Appwrite 콘솔에 접속하여 컬렉션 구조와 인덱스를 다음과 같이 구성합니다.

### A. 신규 `user_departments` 컬렉션 생성 (교차 엔티티)
사용자와 부서 간의 다대다 관계를 1:N 관계로 풀어내고, 각 부서별 직책을 저장할 테이블입니다.

#### ① Attributes (속성 정의)
* **`id`**: 유형 `String` (Size: 36, Required: true) - 관계 고유 식별자 (또는 Appwrite `$id` 대체)
* **`userId`**: 유형 `String` (Size: 36, Required: true) - `users` 컬렉션의 고유 식별자 FK
* **`deptId`**: 유형 `String` (Size: 36, Required: true) - `departments` 컬렉션의 고유 식별자 FK
* **`isPrimary`**: 유형 `Boolean` (Required: true, Default: false) - 주부서 여부
* **`jobTitle`**: 유형 `String` (Size: 50, Required: true, Default: "팀원") - 해당 부서 내에서의 개별 직책 (예: 본부장, 부팀장, 간사 등)

#### ② Indexes (인덱스 정의)
실시간 조인 쿼리 속도 보장 및 중복 방지를 위한 핵심 설정입니다.
* **`idx_userId`**: Type `key`, Attributes: `["userId"]` (특정 사용자의 소속 목록 조회 최적화)
* **`idx_deptId`**: Type `key`, Attributes: `["deptId"]` (특정 부서의 소속원 목록 조회 최적화)
* **`idx_unique_user_dept`**: Type `unique`, Attributes: `["userId", "deptId"]` (동일 부서에 한 사람이 중복 소속되는 것 차단)

### B. 기존 `users` 컬렉션 Attributes 정리
* **`jobTitle` 속성:** 콘솔에서 **삭제(Delete)** 합니다.
* **`dept` 속성:** 기존 한글 부서명을 저장하던 열에서, 하위 호환성 유지를 위해 **삭제**하거나 **선택사항(Required: false)**으로 변경합니다. (모든 관계 정보는 `user_departments`로 이관됩니다).

---

## 2. [2단계] 도메인 스키마 및 데이터 레이어 개편

데이터베이스 구조가 바뀜에 따라 프런트엔드 도메인 객체 및 데이터 레포지토리를 수정합니다.

### A. [`user/schema.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/domain/user/schema.ts) 개편
* 사용자 도메인 객체 `User` 정의에서 `dept`와 `jobTitle`을 직접 소유하지 않고, 겸직 관계를 포함한 구조로 명세를 확장합니다.
```typescript
export interface UserAffiliation {
  deptId: string;
  deptName: string;
  jobTitle: string;
  isPrimary: boolean;
}

// User 객체의 필드 확장
export interface User {
  id: string;
  empNo: string;
  name: string;
  email: string;
  status: '사용' | '잠금' | '미사용';
  // ... 기본 시스템 정보
  affiliations: UserAffiliation[]; // 정규화 조인 결과 담는 배열
  dept: string;       // 주부서명 (하위 호환성용 getter/computed)
  jobTitle: string;   // 주부서 직책 (하위 호환성용 getter/computed)
}
```

### B. [`userDepartment.repo.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/data/userDepartment/userDepartment.repo.ts) [NEW] 생성
* `user_departments` 컬렉션의 데이터 쓰기/조회를 전담하는 Repository를 생성합니다.

### C. [`user.repo.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/data/user/user.repo.ts) 조인 쿼리 구현
* **`list()` 메서드 개편 (조인 수행):**
  1. `users` 원시 데이터 목록 로드.
  2. `user_departments` 소속 목록 로드.
  3. `departments` 부서 마스터 목록 로드.
  4. 세 목록을 메모리 맵 상에서 조인하여 `User.affiliations` 배열을 만들고, 주부서(`isPrimary === true`) 정보를 기준으로 `User.dept` 및 `User.jobTitle` 필드를 동적 계산하여 채워 반환합니다.
* **`save()` / `create()` / `update()` 개편 (트랜잭션/순차 처리):**
  * 사용자의 기본 정보는 `users` 컬렉션에 저장합니다.
  * 기존의 소속 관계 데이터를 모두 삭제한 뒤, 편집된 관계 목록(`affiliations`)을 `user_departments` 컬렉션에 새롭게 낱개 행으로 벌크 인서트(Bulk Insert) 합니다.

---

## 3. [3단계] 어드민 및 기안 화면 UI/UX 고도화

### A. [`UserFormModal.tsx`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/modules/base/user/UserFormModal.tsx) 개편
* **겸직별 개별 직책 지정 UI 장착:**
  * 단순히 체크박스만 나열하는 대신, 선택한 부서 옆에 해당 부서 내에서의 직책명(예: `AX지능화본부` - `본부장`, `경영기획팀` - `부팀장`)을 개별적으로 선택하거나 직접 입력할 수 있는 유연한 테이블/리스트 UI를 제공합니다.
  * 주부서 지정을 위한 라디오 버튼 인터페이스를 함께 구현합니다.

### B. [`ApprovalDraftScreen.tsx`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/modules/gw/approval/ApprovalDraftScreen.tsx) 연동
* `user.affiliations` 목록을 드롭다운에 바인딩하여, 기안자가 기안 상신 시 본인의 소속 부서들 중 하나를 선택하면 해당 소속 자격의 직책 및 상위 결재선이 완벽히 트리거되도록 마크업을 다듬습니다.

---

## 4. [4단계] 데이터 이관 (Migration) 스크립트 실행

* 데이터베이스가 개편된 후 기존에 박제되어 있던 `users`의 한글 부서명(`dept`) 및 직책(`jobTitle`)을 읽어, 신규 `user_departments` 테이블로 자동 이관해 주는 일회성 데이터 마이그레이션 스크립트를 작성하고 실행합니다.

---

## 5. [5단계] 정적 빌드 및 배포 검증
* `npx tsc --noEmit` 검사를 수행하여 전체 컴포넌트 오류 유무 확인 및 최종 원격 push를 실행합니다.
