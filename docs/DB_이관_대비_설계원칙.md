# DB 이관 대비 설계 원칙 (Firestore → RDB)

> 작성일: 2026-06-24
> 대상: WorkFit MES 플랫폼 (`/Users/lucaskim/Developer/Work/DemoMes_v0`)
> 전제: 초기에는 유연성을 위해 **Firestore(NoSQL)** 채택. 안정화 후 **관계형 DB(RDB)** 로 이관 예정.
> 목적: 이관을 *재작성*이 아닌 *기계적 변환*으로 만들기 위해 지금부터 지켜야 할 설계 규율 정의.

---

## 0. 결론

**이관은 가능하며, MES 도메인에서는 합리적인 전략이다.**
단, 이관 난이도는 미래가 아니라 **오늘 Firestore를 어떻게 설계하느냐**로 거의 결정된다.
아래 원칙을 규율로 지키면 이관은 주말 작업이 되고, 어기면 전면 재작성이 된다.

> 핵심 한 줄: **NoSQL의 자유도를 쓰지 말고, Firestore를 관계형처럼 절제해서 쓴다.**
> → Firestore를 사실상 "스키마리스 RDB"로 운용한다.

---

## 1. 왜 이 전략이 타당한가 (MES는 본래 관계형에 가깝다)

- 작업지시 → 실적 → LOT → 투입자재, 거래처 ↔ 수주 ↔ 매출 ↔ 채권처럼 **조인·트랜잭션·집계가 핵심**인 도메인.
- Firestore는 다중 조인, `GROUP BY` 성격의 리포트, 읽기 과금에 약하고 RDB가 강하다.
- 따라서 "초기엔 유연한 Firestore, 안정 후 RDB"는 흔하고 타당한 경로다.

---

## 2. 이관을 기계적 변환으로 만드는 6대 설계 원칙 (지금부터 강제)

| # | 원칙 | 효과 |
|---|---|---|
| **1** | **Repository 계층이 Firebase를 import하는 유일한 곳** (`data/*.repo.ts`). `domain`·`features`·UI는 절대 firebase를 모름 | DB 교체 = repo N개만 재작성, 나머지 전부 무손상 ← **가장 중요** |
| **2** | **문서를 "테이블처럼" 정규화** — 깊은 중첩 map/배열로 묻지 말고 ID 참조(외래키)로 연결 | collection → table 1:1 변환 가능 |
| **3** | **안정적 문자열/UUID PK** + 명시적 외래키 필드(`vendorId`, `itemId`) | SQL FK로 그대로 매핑 |
| **4** | **핵심 엔티티는 서브컬렉션 대신 최상위 컬렉션 + FK** (라인아이템 등 강한 종속만 서브컬렉션) | 서브컬렉션 평탄화 비용 제거 |
| **5** | **zod schema = 단일 스키마 정의** | zod → SQL DDL 거의 자동 변환 (타입·필수·enum 그대로) |
| **6** | **타입을 RDB 친화적으로** — 날짜는 ISO 문자열/epoch, 금액은 정수(원), enum은 commonCode 참조. Firestore 전용 마법(`serverTimestamp`만 의존, 깊은 nested, array-contains 트릭) 회피 | 타입 변환 손실 없음 |

### 원칙 1 보충: Repository 추상화가 핵심 (linchpin)

```
domain/   ← 순수 로직. firebase import 금지
data/     ← repo. firebase import 허용되는 유일한 계층  ★ 이관 시 여기만 교체
features/ ← TanStack Query 훅. repo만 호출, firebase 모름
modules/  ← 화면. 훅만 호출
```

이 경계가 지켜지면, 이관은 `data/*.repo.ts`의 구현체(Firestore → Prisma/Drizzle 등)만 바꾸는 작업이 된다.

---

## 3. 공짜가 아닌 부분 (인터페이스 뒤에 격리)

아래 셋은 1:1 변환이 안 되므로, **구현만 교체되도록 인터페이스 뒤에 숨긴다.**

| 항목 | Firestore | RDB | 격리 전략 |
|---|---|---|---|
| **집계/리포트** | 클라 집계 / 사전집계 문서 | `GROUP BY` / 뷰 | 집계 로직을 `domain/`의 **순수 함수**로 (정규화 데이터 입력) → 로직 이식, 공급부만 교체 |
| **트랜잭션** | Firestore Transaction | SQL Transaction (의미 다름) | "실적확정→재고차감→LOT생성"을 **Service 인터페이스**(`productionService.confirm()`)로 캡슐화 |
| **실시간** | `onSnapshot` | 직접 등가물 없음 (폴링/WebSocket/LISTEN-NOTIFY) | 실시간 구독은 대시보드·라인가동 **소수 화면에만 격리** |

---

## 4. 실제 이관 시 매핑표 (참고)

| Firestore | → | RDB |
|---|---|---|
| collection | → | table |
| document | → | row |
| 문서 ID(string) | → | PK (UUID/varchar) |
| FK 필드(`itemId`) | → | FOREIGN KEY |
| 종속 서브컬렉션(`salesOrderLines`) | → | 자식 테이블 |
| zod schema | → | DDL (`CREATE TABLE`) |
| 보안 규칙 | → | 앱 권한 + DB 권한/RLS |
| 사전집계 문서 | → | 뷰 / 머티리얼라이즈드 뷰 |

**이관 절차:** 스키마 매핑 → 일괄 ETL(또는 듀얼 라이트 과도기) → `repo` 구현만 교체.

---

## 5. 하지 말아야 할 것 (안티패턴 체크리스트)

- ❌ 화면 컴포넌트에서 `firebase/firestore` 직접 import
- ❌ 한 문서에 다른 엔티티를 통째로 깊게 중첩 (조인 대신 임베드 남용)
- ❌ 읽기 속도만 보고 과도하게 fan-out denormalize (표시용 소수 필드 복제는 허용)
- ❌ array-contains / 복합 인덱스 트릭에 비즈니스 규칙 의존
- ❌ enum 값을 문자열 리터럴로 화면마다 하드코딩 (→ commonCode 참조)
- ❌ 금액을 부동소수(float)로 저장 (→ 정수 원 단위)
- ❌ 날짜를 Firestore Timestamp에만 의존 (→ ISO 문자열 병행 보관 권장)

---

## 6. 대안 메모 (선택)

MES가 관계형 성격이 강하므로 **Supabase(Postgres) 조기 채택**도 후보다 — 처음부터 RDB라 이관 자체가 불필요.
다만 *"초기엔 스키마 유연성 우선"* 이라는 현재 판단을 존중하면, **Firestore로 가되 본 문서의 6원칙을 규율로 지키는 것**이 최선의 절충이다.

---

## 7. 요약

- 이관은 **가능**하다.
- 단 "나중에 잘 되겠지"가 아니라, **Repository 추상화 + 정규화 + zod 단일 스키마**를 처음부터 강제해야 한다.
- 이를 지키면 이관은 *기계적 작업*, 안 지키면 *재작성*이다.

---

## 관련 문서

- [[비즈니스_로직_개발_전략.md]] — 전체 로직 개발 방향(계층 구조·MES 특화 난제·마이그레이션 경로)
- (예정) `데이터_모델_설계서.md` — 컬렉션 카탈로그·ERD·채번·상태머신 (본 원칙을 실제 스키마에 적용)
