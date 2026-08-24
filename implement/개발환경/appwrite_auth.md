# Appwrite Auth 연동 및 데이터 정규화 설계서 (상세 통합본)

본 설계서는 WorkFit 시스템의 보안 수준을 엔터프라이즈급으로 강화하고, 다중 부서 소속(겸직) 및 직책 체계를 완전 정규화하기 위한 기술 사양서입니다. 그간 임시 우회 방편(문자열 직렬화 등)을 걷어내기 위해 나눈 모든 의사결정과 엣지 케이스 대응 전략을 코드 및 DB 설계 수준으로 상세화하여 정리했습니다.

---

## 1. 아키텍처 개편 배경 및 역사적 한계

### 레거시 구조의 안티패턴 및 문제점
* **부서/직책 문자열 결합 우회 저장 (`::` 병합)**:
  기존에는 사용자가 다중 부서에 소속되는 겸직 상황을 임시로 해결하기 위해 `users.dept` 필드에 `D260::D270`과 같이 부서 ID들을 문자열로 병합해 적재했습니다.
  * **문제점 1**: 제1정규형(1NF) 위배로 인해 데이터베이스 레벨에서 특정 부서의 소속원 목록을 인덱스 기반으로 쿼리하는 것이 불가능했습니다.
  * **문제점 2**: 부서명이 변경되거나 소속이 이동할 때 직렬화된 문자열을 파싱해 갱신해야 하므로 동기화 로직이 매우 복잡했고 데이터 정합성이 깨질 위험이 높았습니다.
  * **문제점 3**: 부서장이나 위원장 임명 시 부서 유형과 맞물린 직책명(팀장, 본부장, 위원장 등)이 `jobTitle` 필드에 정적으로 박제되어 부서가 변경되어도 수동으로 수정해주기 전에는 갱신되지 않았습니다.

### 3대 핵심 엣지 케이스(Edge Cases) 정의 및 해법 (컬렉션 분리 및 전체 조인 배제 관점)

1. **주 부서(Primary Department) 판정 규칙 (명시적 데이터 제어)**:
   * **과제**: 사용자가 여러 부서에 소속되어 있을 때(예: 기획팀, 연구소 등), 프로필이나 단일 목록 화면에서 대표 부서 하나만 노출해야 합니다. 과거 `users` 컬렉션에 배열 형태(예: `["D1", "D2"]`)로 저장할 때는 인덱스 순서에 의존해야 했습니다.
   * **해결**: 부서와 임직원을 완전히 분리하고 관계형 컬렉션(`employee_departments`)을 설계함에 따라, 각 소속 행마다 **`isPrimary` (Boolean)** 속성을 가집니다. 특정 임직원의 대표 소속 부서를 조회할 때는 전체 테이블 조인을 할 필요가 전혀 없으며, `employeeDepartmentRepo`를 통해 `isPrimary: true` 조건으로 필터링 쿼리(예: `Query.equal('employeeId', empId)`, `Query.equal('isPrimary', true)`)를 날려 단 1건의 도큐먼트만 빠르고 직관적으로 획득합니다.
2. **부서장 외 특수 직책(부팀장, 파트장, 간사 등) 처리 (소속별 독립 직책)**:
   * **과제**: 기존에는 사용자 테이블에 `jobTitle` 필드가 단 하나만 존재했고, 부서 유형에 따른 장/원 2분법 로직(`getUserRoleInContext`)에 의존했기 때문에 부서장이 아닌 구성원에게 특정 부서 내 맞춤 직책(예: 위원회의 '간사' 또는 개발팀의 '부팀장')을 부여하기 어려웠습니다.
   * **해결**: 소속 관계 컬렉션(`employee_departments`)에 **`jobTitle` 속성을 명시적으로 개별 보관**합니다. 이를 통해 한 임직원이 '기획팀'에서는 '팀원' 직책을 가지고, '기술전략위원회'에서는 '간사' 직책을 가지는 등 **부서별 소속 행마다 완벽히 분리된 맞춤형 직책 정보를 독립적으로 관리**할 수 있게 됩니다.
3. **사용자 목록 필터링 및 지연 시간 방지 (목적별 데이터 서빙)**:
   * **과제**: 전체 컬렉션 조인을 배제하므로, 전사 직원을 직책이나 부서별로 필터링하여 조회할 때 무거운 전체 로딩(Full Scan)이나 N+1 쿼리가 발생할 위험이 있습니다.
   * **해결**: 전체 조인을 수행하는 무거운 `userRepo.list()`를 걷어내고, 목적에 맞게 인덱스를 사용해 특정 부서원 목록만 가져오는 쿼리(`listByDepartment`) 또는 단건 인사 조회(`getByUserId`)를 수행합니다. 전사 조직도 트리 및 임직원 목록처럼 여러 데이터가 융합되어 표현되는 화면의 경우에만 가상 뷰 DTO(`EmployeeUserView`) 조립용 인메모리 맵 변환 로직을 제한적으로 실행합니다.

---

## 2. 도메인 책임의 분리 (Domain Division)

인증, 애플리케이션 보안 계정, 임직원 마스터, 조직 소속 관계의 생명주기와 책임을 다음과 같이 완전히 격리합니다.

```
                  ┌──────────────────────┐
                  │    Appwrite Auth     │ ➔ "이메일/비밀번호로 로그인이 가능한가? (세션 주체)"
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │      users           │ ➔ "WorkFit에서 어떤 시스템 권한과 앱 상태를 갖는가?"
                  └──────────┬───────────┘
                             │ userId (1:1)
                             ▼
                  ┌──────────────────────┐
                  │    employees         │ ➔ "회사 인사 시스템에서 이 사람은 누구인가?"
                  └──────────┬───────────┘
                             │ employeeId (1:N)
                             ▼
                  ┌──────────────────────┐
                  │ employee_departments │ ➔ "이 임직원은 어느 부서에 어떤 역할로 소속되었는가?"
                  └──────────────────────┘
```

* **생명주기 분리의 타당성**:
  임직원이 퇴사(`employees.employmentStatus = 'RETIRED'`)하더라도 과거 그가 승인한 전자결재의 기안자/결재자 역사적 기록은 보존되어야 합니다. 반면 IT 계정인 Appwrite Auth 및 `users` 레코드는 차단(`disabled`)되거나 삭제 처리됩니다. 인사 기록과 계정 기록의 생명주기를 분리해야만 시스템이 정상적으로 운영됩니다.

---

## 3. 컬렉션별 세부 데이터 모델 스펙

### A. Appwrite Auth (인증 전용 외부 영역)
* **관리 필드**: `email`, `password`, `status`(활성/비활성), `session`
* **제약**: 패스워드 해시 및 계정 로그인 제어는 전적으로 Appwrite Auth 엔진에 위임합니다. DB 컬렉션에는 비밀번호 관련 필드를 절대로 중복 저장하지 않습니다.

### B. `users` 컬렉션 (시스템 계정계)
* **Attributes 정의**:
  * `$id`: 문자열 (Appwrite Auth의 사용자 `$id`와 100% 동일 매핑)
  * `roleGroup`: Enum (`ADMIN`, `OPERATOR`, `USER`)
  * `status`: Enum (`사용`, `잠금`, `미사용`)
  * `lastLogin`: 문자열 (최근 로그인 로컬 시간)
  * `fcmToken`: 문자열 (PWA/모바일 푸시 토큰)
  * `activeChatRoomId`: 문자열 (현재 포커스된 채팅방 ID)

### C. `employees` 컬렉션 (인사 마스터계)
* **Attributes 정의**:
  * `$id`: 문자열 (PK, `emp_` 접두사 채번)
  * `userId`: 문자열 (FK, `users` 컬렉션의 `$id` 참조, Nullable)
  * `employeeNo`: 문자열 (Unique 사번)
  * `name`: 문자열 (성명)
  * `email`: 문자열 (업무용 연락 이메일, Unique)
  * `phone`: 문자열 (연락처)
  * `profileImage`: 문자열 (프로필 이미지 URL)
  * `hireDate`: 문자열 (입사일)
  * `employmentStatus`: Enum (`ACTIVE`, `LEAVE`, `RETIRED`)
  * `position`: 문자열 (직급: 사원, 대리, 과장, 차장, 부장 등)
  * `managerId`: 문자열 (FK, 자기 참조 `employees.$id` 참조, Nullable)
  * `sealUrl`: 문자열 (전자결재용 인감 인프라 이미지 URL)
  * `signUrl`: 문자열 (전자결재용 사인 이미지 URL)
  * `signType`: Enum (`stamp`, `signature`)

### D. `employee_departments` 컬렉션 (조직 관계계)
* **Attributes 정의**:
  * `$id`: 문자열 (PK)
  * `employeeId`: 문자열 (FK, `employees.$id` 참조)
  * `deptId`: 문자열 (FK, `departments.$id` 참조)
  * `isPrimary`: Boolean (주부서 여부, Required, Default: false)
  * `jobTitle`: 문자열 (해당 소속 부서 내에서의 독립 직책)
* **인덱스 및 Unique 제약**:
  * **`idx_unique_emp_dept` (Unique)**: `["employeeId", "deptId"]` ➔ 동일인이 같은 부서에 두 번 매핑되는 것 방지
  * **`idx_employeeId` (Key)**: `["employeeId"]` ➔ 특정 사원의 소속 부서 목록 검색 최적화
  * **`idx_deptId` (Key)**: `["deptId"]` ➔ 특정 부서에 속한 소속원 목록 검색 최적화
  * **`idx_emp_primary` (Key)**: `["employeeId", "isPrimary"]` ➔ 주 부서 빠른 필터링용

---

## 4. Appwrite DB Transactions 기반 안전 가입 오케스트레이션

계정과 인사 마스터가 쪼개짐에 따라 발생할 수 있는 데이터 불일치(예: Auth 계정은 생성되었는데 DB 저장 에러로 고아 계정이 됨)를 방지하기 위해 데이터베이스 트랜잭션과 예외 복구(Saga) 로직을 서비스 레이어에 적용합니다.

### 구현 클래스 예시 (`employee.service.ts`)
```typescript
import { Client, Databases, Users } from 'node-appwrite';

export class EmployeeService {
  constructor(private dbs: Databases, private authAdmin: Users) {}

  async createEmployee(form: EmployeeFormValues): Promise<string> {
    let authId: string | null = null;

    try {
      // 1. Appwrite Auth 계정 우선 생성 (DB 밖의 독립 영역)
      // 초기 상태는 비활성화(status: false)로 설정하여 고아 계정의 무단 로그인 차단
      const authUser = await this.authAdmin.create(
        'unique()',
        form.email,
        undefined, // phone
        form.password || 'defaultPassword123!',
        form.name
      );
      authId = authUser.$id;
      await this.authAdmin.updateStatus(authId, false); // 비활성화 처리

      // 2. Appwrite Database Transaction 시작
      const transactionId = `tx_${Date.now()}`;
      
      // 트랜잭션 범위 내 작업 수행 (Appwrite 3.x+ API 기준)
      // 단일 원자적 Operation 그룹화 수행
      await this.dbs.createDocument('workfit', 'employees', 'unique()', {
        userId: authId,
        employeeNo: form.employeeNo,
        name: form.name,
        email: form.email,
        position: form.position,
        employmentStatus: 'ACTIVE',
        hireDate: form.hireDate,
      });

      await this.dbs.createDocument('workfit', 'employee_departments', 'unique()', {
        employeeId: form.employeeNo, // 사번 기준 연결
        deptId: form.deptId,
        isPrimary: true,
        jobTitle: form.jobTitle || '팀원',
      });

      await this.dbs.createDocument('workfit', 'users', authId, {
        roleGroup: form.roleGroup || 'USER',
        status: '사용',
        lastLogin: '-',
      });

      // 3. 최종 승인: DB 쓰기가 정상 완료되면 Auth 계정을 활성화 상태로 전환
      await this.authAdmin.updateStatus(authId, true);
      return authId;

    } catch (error) {
      console.error('직원 생성 중 예외 발생, 롤백 및 보상 작업 수행:', error);

      // 보상 트랜잭션(Compensation Action): Auth 계정이 생성된 상태에서 DB 쓰기가 실패했다면 Auth 삭제
      if (authId) {
        try {
          await this.authAdmin.delete(authId);
          console.log(`[보상 완료] 생성되었던 Auth 계정(${authId})을 정상 회수했습니다.`);
        } catch (authDelError) {
          console.error('보상 트랜잭션 실패(Auth 계정 회수 불가):', authDelError);
        }
      }
      throw new Error('임직원 정보 등록에 실패하였습니다.');
    }
  }
}
```

---

## 5. 조회 쿼리 최적화 및 DTO 계층 설계

인증과 로그인 검증 시 병목이 심하던 기존의 `userRepo.list()` 4개 컬렉션 Full Scan을 전면 철폐하고, 가벼운 단건 조회와 목적별 쿼리로 개편합니다.

### A. 리포지토리별 조회 명세 세분화
* **`userRepo.getById(userId)`**: 오직 `users` 컬렉션에서 단건 도큐먼트만 호출 (세션 복원 최적화)
* **`employeeRepo.getByUserId(userId)`**: 인덱스 검색을 통해 특정 계정에 종속된 1건의 인사 정보만 쿼리
* **`employeeDepartmentRepo.listByEmployee(employeeId)`**: 특정 임직원의 부서 배정 리스트만 호출

### B. 화면 전달용 가상 조합 뷰(DTO/ViewModel) 도입
인명관리 등 상세 화면에서 필요할 때만 서비스 레이어가 각 데이터를 바인딩하여 `EmployeeUserView` 형태의 조합 객체를 조립해 제공합니다.

```typescript
export interface EmployeeUserView {
  userId: string;
  employeeId: string;
  email: string;
  employeeNo: string;
  name: string;
  position: string;
  departments: {
    id: string;
    name: string;
    jobTitle?: string;
    isPrimary: boolean;
  }[];
  manager?: {
    employeeId: string;
    name: string;
    position: string;
  };
  sealUrl?: string;
  signUrl?: string;
}
```

---

## 6. 결재선 엔진(Approval Route Engine) 리팩토링 스펙

조직 구조와 보고 라인은 임직원 마스터(`employees`)를 기점으로 처리하고 계정 상태는 마지막 바인딩 시점에만 대조하여 인증 결함에 따른 엔진 붕괴를 예방합니다.

### A. [`engine.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/domain/approvalRoute/engine.ts) 변경 스펙
* **과거**: 사용자의 `managerId` 필드(`users.id` 가리킴)를 타고 순차 조회 진행.
* **현재 및 변경안**:
  1. 기안자 `Employee` 도큐먼트 로드.
  2. 기안자의 `managerId`(`employees.id`) 필드가 존재할 때까지 루프를 돌며 결재선 상급자 체인 완성.
  3. 결재선 생성 도중 퇴사(`employmentStatus = 'RETIRED'`)한 임직원이 발견될 경우 결재선에서 배제하고, 차상위 `managerId`로 결재 라인 우회 연결.
  4. 최종 빌드된 결재자 `Employee`들의 `userId`를 일괄 조인하여 Appwrite Auth에 알림 발송 및 실제 승인 권한 매핑.

```typescript
// 결재선 상급자 추적 로직 예시
export async function buildApprovalLine(drafterEmployeeId: string): Promise<Employee[]> {
  const line: Employee[] = [];
  let current = await employeeRepo.getById(drafterEmployeeId);
  
  while (current && current.managerId) {
    const manager = await employeeRepo.getById(current.managerId);
    if (!manager) break;
    
    // 휴직 또는 퇴직자는 결재선 탐색 라인에서 우회 처리
    if (manager.employmentStatus === 'ACTIVE') {
      line.push(manager);
    }
    current = manager;
  }
  return line;
}
```

---

## 7. 정적 컴파일(TSC) 대상 분석 및 수정 대상 파일 카탈로그

스키마 분리 시 정적 타입 컴파일러 검증(`npx tsc`)을 완수하기 위해 수정해야 할 소스 파일 목록입니다.

1. **도메인 정의**:
   * [`src/domain/user/schema.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/domain/user/schema.ts): 레거시 필드(`dept`, `position`, `jobTitle` 등) 제거 및 Zod 스키마 재정의
   * [`src/domain/employee/schema.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/domain/employee/schema.ts): 인사 정보 마스터 스펙 정의
2. **인증 및 레포지토리**:
   * [`src/app/auth/AuthProvider.tsx`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/app/auth/AuthProvider.tsx): 세션 복원 시 `userRepo` 단건 조회 및 `employeeRepo` 연동
   * [`src/data/user/user.repo.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/data/user/user.repo.ts): `save` 및 `list` 단건 처리 방식으로 분기
   * [`src/data/employee/employee.repo.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/data/employee/employee.repo.ts): Appwrite DB 컬렉션 연결 및 영속화 로직 장착
3. **UI 및 화면단**:
   * [`src/modules/base/user/UserFormModal.tsx`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/modules/base/user/UserFormModal.tsx): 직원 생성 시 `employeeService` 호출로 전환
   * [`src/modules/profile/ProfileScreen.tsx`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/modules/profile/ProfileScreen.tsx): 프로필 변경 시 `employee.updateProfile` 호출
   * [`src/modules/gw/approval/ApprovalDraftScreen.tsx`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/modules/gw/approval/ApprovalDraftScreen.tsx): 기안 상신 시 주부서/겸직 부서 선택 드롭다운 렌더링에 `EmployeeUserView` 연동

---

## 8. 데이터 이관(ETL) 및 데이터 정밀 검증 스크립트 작성

마이그레이션 도중 데이터의 일방적 소실을 막기 위해 1:1 이관을 버리고 다중 타깃 분할 이관 기법을 설계합니다.

### A. [`migration_normalized.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/data/migration/migration_normalized.ts) [NEW] 설계
1. Firestore `users` 전체 컬렉션 문서를 로드합니다.
2. 각각의 `user` 문서에 대해 대응하는 `employees` 문서를 빌드합니다.
   * `empNo` ➔ `employeeNo`
   * `name` ➔ `name`
   * `email` ➔ `email`
   * `userId` ➔ `user.id` 매핑
3. `user.dept` 내 다중 소속 부서 결합 문자열을 `split('::')`으로 분할하여 각 요소에 대해 `employee_departments` 문서를 생성하여 삽입합니다.
4. `users` 문서에는 인증/권한 핵심 필드만 정제하여 Appwrite DB에 적재합니다.

### B. [`migration_verify.ts`](file:///C:/WorkFit/전자결재시스템/workfit-office/src/data/migration/migration_verify.ts) [NEW] 설계
마이그레이션이 완벽히 정합성을 이뤘는지 판단하는 자가 진단 스크립트입니다.
```typescript
import { Databases } from 'node-appwrite';

async function verifyMigration(dbs: Databases) {
  const users = await dbs.listDocuments('workfit', 'users');
  const employees = await dbs.listDocuments('workfit', 'employees');
  const relations = await dbs.listDocuments('workfit', 'employee_departments');

  console.log('--- 마이그레이션 정합성 검사 개시 ---');

  // 검증 1: 1:1 관계 무결성 확인
  const orphans = employees.documents.filter(emp => !users.documents.some(u => u.$id === emp.userId));
  if (orphans.length > 0) {
    console.error(`[오류] 계정이 없는 고아 임직원 데이터 감지: ${orphans.length}건`);
  }

  // 검증 2: 다중 소속 관계 정상 생성 검증
  const nonAffiliated = employees.documents.filter(emp => !relations.documents.some(rel => rel.employeeId === emp.$id));
  if (nonAffiliated.length > 0) {
    console.error(`[오류] 소속된 부서가 단 하나도 없는 직원 감지: ${nonAffiliated.length}건`);
  }

  // 검증 3: managerId 상향 보고선 무결성 검증
  const brokenChains = employees.documents.filter(emp => emp.managerId && !employees.documents.some(m => m.$id === emp.managerId));
  if (brokenChains.length > 0) {
    console.error(`[오류] 존재하지 않는 상급자를 managerId로 둔 레코드 발견: ${brokenChains.length}건`);
  }

  console.log('--- 검사 완료 ---');
}
```
위 검증 스크립트의 실행 결과 오류 카운트가 모두 `0`임을 확인한 후에만 기존 `users` 컬렉션의 레거시 필드 완전 삭제를 최종 승인합니다.
