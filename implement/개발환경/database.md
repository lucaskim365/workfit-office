# [정규화] 임직원-사용자 분리 및 관계형 겸직 아키텍처 재구축 계획서 (최종안)

이 계획서는 **`users` 컬렉션의 중복 인사 데이터를 제거**하고 **`employee_departments` 교차 컬렉션**을 도입하여 계정계와 인사계를 완벽히 정규화하는 구현 계획서입니다. 

사용자가 제시한 4가지 핵심 권장사항(마이그레이션 순서, 원자성 및 멱등성, 생성/삭제 FK 방향성, N+1 성능 최적화)을 전격 수용하여 설계를 고도화하였습니다.

---

## 1. ⚠️ 주요 검토 및 보완 설계안 (최종 반영)

> [!IMPORTANT]
> **1. 데이터 유실 방지를 위한 실행 순서 준수**
> * 레거시 데이터가 담겨 있는 `users` 컬렉션의 필드들을 마이그레이션 완료 전에 삭제하면 원본 데이터가 영구 유실됩니다.
> * 따라서, **[신규 스키마/컬렉션 생성] ➔ [데이터 마이그레이션 스크립트 실행] ➔ [동작 검증] ➔ [레거시 필드 안전 삭제]** 순으로 단계를 엄격히 나누어 진행합니다.

> [!TIP]
> **2. N+1 쿼리 방지 및 병렬 인메모리 조인 (Batch Join)**
> * 사용자 목록 조회 시 루프를 돌며 개별 쿼리를 실행하지 않고, `users`, `employees`, `employee_departments`, `departments`의 전체 문서를 `Promise.all`로 **병렬로 한 번에 조회**합니다.
> * 메모리 상에서 `Map` 자료구조를 생성하여 $O(1)$ 복잡도로 매핑함으로써 성능 병목을 차단합니다.

> [!WARNING]
> **3. Appwrite 트랜잭션 한계 및 멱등성(Idempotency) 보장**
> * Appwrite는 복수 컬렉션 쓰기에 대한 분산 트랜잭션을 지원하지 않습니다.
> * 소속 관계(`employee_departments`)를 갱신할 때 데이터 불일치를 막기 위해 **[기존 소속 조회 ➔ 변경 Diff 계산 ➔ 삭제 및 신규 추가]**의 멱등성 보장형 쓰기 로직을 데이터 레이어에 구현합니다.
> * 저장 중 실패에 대비한 Graceful 롤백 핸들러 및 UI 피드백을 구축합니다.

> [!NOTE]
> **4. 외래키(FK) 라이프사이클 및 생성 흐름 정립**
> * **생성 흐름:** 인사 카드 생성(`Employee` 추가) ➔ 시스템 권한 필요 시 계정 생성(`User` 추가) ➔ 매핑(`employee.userId = user.id`)의 정석 흐름을 따릅니다.
> * **삭제/Cascade 흐름:** 계정이 삭제되더라도 임직원의 과거 인사 기록은 잔존할 수 있도록, `User` 삭제 시 매핑되어 있던 `Employee.userId`를 `null`로 세팅하는 Cascade 안전 장치를 구현합니다.

---

## 2. 데이터베이스 스키마 상세 스펙 (Appwrite)

### A. [계정계] `users` 컬렉션
인증, 세션, 알림을 위한 최소 보안/앱 상태 필드만 유지합니다. (마이그레이션 성공 후 아래 레거시 필드들 완전 제거)
* **기존 유지 속성:** `id`, `email`, `password`, `roleGroup`, `status`, `lastLogin`, `fcmToken`, `activeChatRoomId`
* **삭제 대상 레거시 속성:** `empNo`, `name`, `dept`, `position`, `jobTitle`, `photoUrl`, `sealUrl`, `signUrl`, `signType`, `managerId`, `resignedAt`

### B. [인사계] `employees` 컬렉션
회사 구성원의 공식 인적 마스터 데이터 컬렉션입니다.
* **Attributes:**
  * `id`: 임직원 식별자 (PK)
  * `employeeNo`: 사번 (Unique)
  * `name`: 성명
  * `email`: 이메일
  * `phone`: 연락처
  * `profileImage`: 프로필 이미지 URL
  * `hireDate`: 입사일
  * `employmentStatus`: 재직 상태 (`ACTIVE` / `LEAVE` / `RETIRED`)
  * `position`: 직급 (사원, 대리, 과장, 차장, 부장 등)
  * **`userId` [NEW]**: 계정 매핑 외래키 (FK, `users.id` 참조, Nullable)
  * **`managerId` [NEW]**: 직속 상급자 외래키 (FK, 다른 `employees.id` 참조, Nullable)
  * **`sealUrl` [NEW]**: 전자결재 인감 URL
  * **`signUrl` [NEW]**: 전자결재 사인 URL
  * **`signType` [NEW]**: 서명 방식 (`stamp` / `signature`)

### C. [NEW 관계계] `employee_departments` 컬렉션
임직원의 부서 배정 및 직책 정보를 기록하는 관계 매핑(Junction) 테이블입니다.
* **Attributes:**
  * `id`: 식별자 (PK)
  * **`employeeId`**: FK (`employees.id` 참조) - *Index idx_employeeId 지정*
  * **`deptId`**: FK (`departments.id` 참조) - *Index idx_deptId 지정*
  * **`isPrimary`**: 주부서 여부 (Boolean, Required, Default: false)
  * **`jobTitle`**: 해당 부서 내에서의 직책 (String, 예: '본부장', '팀장', '부팀장', '간사', '팀원' 등)
* **Index 복합 유니크 제약:** `userId`와 `deptId` 속성을 묶어 **`idx_unique_user_dept` (Unique)**로 지정하여 한 사람이 동일 부서에 다중으로 등록되는 것 방지.

---

## 3. 세부 구현 마일스톤

### 1단계: Appwrite 컬렉션 신규 속성/컬렉션 정의 (작업 개시)
1. **`employees` 컬렉션:** `userId`, `managerId`, `sealUrl`, `signUrl`, `signType` 속성 추가.
2. **`employee_departments` 컬렉션:** 컬렉션 생성 및 `employeeId`, `deptId`, `isPrimary`, `jobTitle` 속성 추가 및 인덱스 세팅.

### 2단계: 일회성 마이그레이션 스크립트 작성 및 실행
* [`migration_normalized.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/data/migration/migration_normalized.ts) [NEW] 생성 및 실행.
* 기존 `users` 문서의 `empNo`, `name`, `email`, `photoUrl`, `position`, `sealUrl`, `signUrl`, `signType` 등을 읽어 대응되는 `employees` 문서를 자동 생성하고 `userId` 링크를 연결합니다.
* 기존 `users.dept` 문자열의 ID들(`D260::D270` 등)과 `jobTitle`을 분석하여 주부서 여부를 구분한 뒤, `employee_departments`에 관계 정보로 나누어 삽입합니다.

### 3단계: 도메인 스키마 및 레포지토리 로직 개편
* **`User` 인터페이스 및 Zod Schema (`user/schema.ts`):** 메모리에서 사용하는 스키마 스펙은 기존과 동일하게 유지하여 UI 컴포넌트의 오류를 원천 차단합니다.
* **`Employee` 인터페이스 및 Zod Schema (`employee/schema.ts`):** 추가된 인사 필드들을 반영합니다.
* **`user.repo.ts` 개편 (Batch Join & Idempotency 구현):**
  * `list()` 구현 시, 4개 컬렉션을 병렬로 Fetch하여 `Map` 기반으로 단숨에 가상 복합 객체로 결합하는 인메모리 배치 조인 로직 장착.
  * `save()` 시, 멱등성이 보장되도록 기존 소속 관계 삭제 후 변경 내역 재삽입 로직 탑재 및 트랜잭션 대체 롤백 핸들러 적용.

### 4단계: 동작 검증 후 기존 레거시 속성 삭제
* 화면상에서 신규 등록/수정/조회 및 결재선 탐색이 온전히 동작하는지 검증을 마친 뒤, Appwrite 콘솔에서 기존 `users` 컬렉션의 레거시 인사 필드들을 완전히 제거합니다.
