# Firebase 사용량·요금 관리 페이지 개발 계획서

- **작성일**: 2026-07-09
- **대상 프로젝트**: `workfit-office-app` (프로젝트 번호 34440992629, 생성일 2026-07-07, 서울/asia-northeast3)
- **목적**: Firestore·Cloud Storage 사용량을 앱 내에서 조회하여 무료 할당량 초과에 따른 과금을 사전에 관리한다.

---

## 1. 결론

**구현 가능합니다.** 다만 두 가지 전제를 먼저 바로잡아야 합니다.

### 1.1 클라이언트 SDK만으로는 만들 수 없다

Firebase 클라이언트 SDK(`firebase/firestore`, `firebase/storage`)에는 **자기 프로젝트의 사용량·할당량을 조회하는 API가 존재하지 않습니다.** `getUsage()` 같은 함수는 없습니다.

사용량 데이터는 아래 경로로만 얻을 수 있으며, 모두 **서버 측 자격증명**이 필요합니다.

| 데이터 출처 | 얻을 수 있는 값 | 요구사항 |
|---|---|---|
| Cloud Monitoring API v3 (`timeSeries.list`) | Firestore 읽기/쓰기/삭제 수, Storage 저장 바이트 | 서비스 계정 + `roles/monitoring.viewer` |
| Cloud Billing API | 실제 청구 금액 | Blaze 플랜 + 결제 계정 |
| Cloud Storage JSON API (`objects.list`) | 버킷 내 객체 크기 합계 | 서비스 계정 |
| 앱 자체 계측 | 화면별·기능별 읽기/쓰기 횟수 | 없음 (앱 코드) |

따라서 이 페이지는 **서버 엔드포인트 1개를 반드시 동반**합니다. 현재 저장소에 `functions/` 디렉토리는 없습니다.

### 1.2 이 프로젝트는 무료(Spark) 플랜이 아닐 가능성이 매우 높다

조사 결과:

- 프로젝트 생성일이 **2026-07-07** 입니다.
- **2024년 10월 30일 이후 생성된 Firebase 프로젝트는 Cloud Storage를 쓰려면 Blaze(종량제) 플랜이 필수**입니다.
- 이 프로젝트의 버킷 이름은 `workfit-office-app.firebasestorage.app` 로, 신규 형식(`.firebasestorage.app`)입니다. 구형식은 `.appspot.com` 입니다.
- 해당 버킷에 요청 시 **HTTP 403 (Permission denied)** 이 반환됩니다. 존재하지 않는 버킷은 404를 반환하므로, **버킷이 실제로 프로비저닝되어 있다**는 뜻입니다.
- 코드상 Storage를 실제로 사용 중입니다 — `src/data/companyInfo/companyInfo.repo.ts` (회사 로고), `src/data/chatMessage/chatMessage.repo.ts` (메신저 첨부).

> **즉, 이 프로젝트는 이미 Blaze 종량제일 개연성이 큽니다.** Phase 0에서 반드시 확정해야 합니다.

이것이 중요한 이유:

| | Spark (무료) | Blaze (종량제) |
|---|---|---|
| 무료 할당량 초과 시 | **서비스 중단** (요금 없음) | **초과분 그대로 과금** |
| 무료 할당량 자체 | 있음 | **동일하게 있음** |
| 지출 상한(hard cap) | 해당 없음 | **없음. 존재하지 않음** |
| 예산 알림 | 해당 없음 | 있음 (알림만, 차단 안 함) |

Firebase/GCP에는 **지출 상한 기능이 없습니다.** 예산 알림은 알림일 뿐 사용량이나 과금을 차단하지 않습니다. 무한 루프 하나가 하룻밤에 수백 달러를 만들 수 있습니다.

### 1.3 목적 재정의 제안

당초 목적인 "무료 사용 요금 관리"는 아래와 같이 구체화하는 것이 실효적입니다.

1. **무료 할당량 대비 현재 소진율**을 보여준다. (일일 리셋 기준)
2. **초과분에 대한 예상 과금액**을 원화로 환산해 보여준다.
3. **임계치 도달 시 경고**하고, 필요하면 **자동으로 결제를 차단**한다. (Phase 4)
4. 사용량이 어느 화면·기능에서 발생하는지 **원인을 추적**한다. (Phase 2)

---

## 2. 무료 할당량 기준값

2026-07-09 기준 [Firebase 공식 요금 페이지](https://firebase.google.com/pricing) 확인값입니다. Spark·Blaze 공통으로 적용되는 무료 한도입니다.

### Cloud Firestore

| 항목 | 무료 한도 | 리셋 |
|---|---|---|
| 저장 데이터 | 1 GiB | 총량 |
| 문서 읽기 | 50,000 / 일 | 매일 |
| 문서 쓰기 | 20,000 / 일 | 매일 |
| 문서 삭제 | 20,000 / 일 | 매일 |
| 네트워크 이그레스 | 10 GiB / 월 | 매월 |

### Cloud Storage for Firebase

| 항목 | 무료 한도 | 리셋 |
|---|---|---|
| 저장 데이터 | 5 GB | 총량 |
| 다운로드 | 1 GB / 일 | 매일 |
| 업로드 작업 | 20,000 / 일 | 매일 |
| 다운로드 작업 | 50,000 / 일 | 매일 |

### Firebase Hosting (참고 — 현재 Vercel 배포 중으로 보임)

| 항목 | 무료 한도 |
|---|---|
| 저장 용량 | 10 GB |
| 데이터 전송 | 360 MB / 일 |

> 이 수치들은 Google이 변경할 수 있습니다. 코드에 하드코딩하되 **상수 파일 1곳(`quota.const.ts`)에 모아** 갱신이 쉽도록 합니다.

---

## 3. 아키텍처

```
┌─────────────────────────────────────────┐
│  브라우저 (React)                        │
│  /sys/usage  UsageScreen.tsx            │
│      ↓ fetch                            │
└──────────┼──────────────────────────────┘
           │  (인증된 요청)
┌──────────▼──────────────────────────────┐
│  서버 엔드포인트  /api/usage             │
│  서비스 계정 자격증명 보유                │
│      ├→ Cloud Monitoring API v3         │
│      │    timeSeries.list               │
│      ├→ Cloud Storage JSON API          │
│      │    objects.list (크기 합산)        │
│      └→ Cloud Billing API (Blaze 한정)   │
└─────────────────────────────────────────┘
```

### 3.1 서버 엔드포인트 선택지

| 방식 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **A. Vercel Serverless Function** | 이미 Vercel 배포 중(`.env.local`에 `VERCEL_OIDC_TOKEN` 존재). `firebase-admin`이 이미 의존성에 있음. Blaze 불필요 | GCP 자격증명을 Vercel 환경변수로 주입해야 함 | **권장** |
| B. Cloud Functions for Firebase | GCP 내부라 자격증명 자동(ADC) | **Blaze 플랜 필수**. `functions/` 신규 구성 필요 | 이미 Blaze라면 유효 |
| C. 자체 계측만 | 서버 불필요 | 근사치. 다른 클라이언트·시드 스크립트 사용량 누락 | 보조 수단 |

**A안을 권장합니다.** 이미 Vercel에 배포 중이고 `firebase-admin`이 설치되어 있어 추가 인프라가 없습니다.

자격증명 주입은 두 가지입니다.

- **간편**: 서비스 계정 JSON 키를 Vercel 환경변수(`GCP_SA_KEY`)에 저장. 키 파일 관리 부담 있음.
- **권장**: Vercel OIDC → GCP Workload Identity Federation 연동. 키 파일 없음. 초기 설정이 다소 복잡.

Phase 1은 간편 방식으로 시작하고, Phase 4에서 WIF로 전환하는 것을 제안합니다.

### 3.2 필요 IAM 권한

서비스 계정에 부여할 최소 권한:

- `roles/monitoring.viewer` — 사용량 메트릭 조회
- `roles/storage.objectViewer` — 버킷 객체 목록·크기
- `roles/billing.viewer` — 청구 금액 (Blaze, 선택)

---

## 4. 미해결 기술 항목 (Phase 0에서 반드시 검증)

계획서 작성 시점에 **확정하지 못한 항목**입니다. 추정으로 구현하면 안 됩니다.

### 4.1 Firestore 메트릭의 정확한 이름

문서마다 표기가 엇갈립니다.

- `firestore.googleapis.com/document/read_count` / `write_count` / `delete_count`
- `firestore.googleapis.com/document/read_ops_count` / `write_ops_count`
- 청구 기준 메트릭: `firestore.googleapis.com/api/billable_read_units` / `billable_write_units`

**검증 방법**: 서비스 계정 준비 후 Monitoring API의 `projects.metricDescriptors.list` 를 `filter=metric.type=starts_with("firestore.googleapis.com")` 로 호출해 실제 목록을 확인합니다. 과금 대응이 목적이므로 `billable_*` 계열이 더 정확할 수 있습니다.

### 4.2 Firestore 저장 용량(stored bytes) 메트릭 존재 여부

Cloud Monitoring에 **Firestore 저장 바이트 메트릭이 있는지 확인되지 않았습니다.** Firestore 문서에는 읽기/쓰기/삭제·연결 수 메트릭만 명시되어 있고, 저장 용량은 Firebase 콘솔 사용량 탭에서 별도 표시됩니다.

대안:

1. `metricDescriptors.list` 로 저장 용량 메트릭 실재 여부 확인 (1순위)
2. 없다면 — 컬렉션별 문서 수 × 평균 문서 크기로 **추정치** 표기. 반드시 "추정" 라벨을 붙일 것
3. 또는 저장 용량 항목은 Firebase 콘솔 링크로 대체

### 4.3 메트릭 반영 지연

Firestore 메트릭은 1분 주기로 샘플링되나 **대시보드 반영까지 최대 4분** 걸립니다. Storage `total_bytes` 는 일 1회 샘플링입니다. UI에 "최종 갱신 시각"과 지연 안내를 표시해야 합니다.

### 4.4 Monitoring API 읽기 호출 비용

읽기 API 호출 비용은 매우 낮으나 정확한 단가는 Cloud Monitoring 요금표에서 확인이 필요합니다. 폴링 주기를 5분 이상으로 잡고 서버에서 캐시하면 무시할 수준으로 보입니다.

### 4.5 현재 결제 플랜

`gcloud` CLI가 로컬에 미설치되어 플랜을 직접 확인하지 못했습니다. **§1.2의 근거로 Blaze로 추정하나, 콘솔에서 확정해야 합니다.**

---

## 5. 단계별 구현 계획

### Phase 0 — 사실 확정 (0.5일)

서버 코드를 쓰기 전에 반드시 선행합니다.

- [ ] Firebase 콘솔에서 현재 결제 플랜 확인 (Spark / Blaze)
- [ ] Blaze라면 결제 계정과 현재까지의 청구액 확인
- [ ] GCP 콘솔에서 서비스 계정 생성 + 위 3개 역할 부여
- [ ] `metricDescriptors.list` 호출하여 **Firestore·Storage 메트릭 실제 이름 확정** (§4.1, §4.2)
- [ ] Cloud Monitoring API 활성화 여부 확인
- [ ] 확정된 메트릭 이름을 이 문서 §4에 반영

**산출물**: 확정된 메트릭 이름 목록, 서비스 계정 키

### Phase 1 — 서버 집계 + 기본 화면 (2일)

권위 있는 실측값을 표시합니다.

**신규 파일**

```
api/usage.ts                              Vercel 서버리스 엔드포인트
src/domain/usage/schema.ts                UsageSnapshot 타입
src/domain/usage/quota.const.ts           무료 한도 상수 (§2)
src/domain/usage/engine.ts                소진율·예상요금 계산 (순수 함수)
src/data/usage/usage.repo.ts              /api/usage 호출
src/features/usage/useUsage.ts            React 훅 (5분 폴링 + 캐시)
src/modules/sys/usage/UsageScreen.tsx     화면
```

**변경 파일**

```
src/app/App.tsx        '/sys/usage' lazy 라우트 추가
src/app/menu-tree.ts   G_SYS_GLOBAL 하위에 S_SYS_USAGE 추가
```

`menu-tree.ts` 추가 예시 (기존 컨벤션 준수):

```ts
{ id: 'S_SYS_USAGE', name: '사용량/요금', url: '/sys/usage', icon: '◔', order: 45, use: true },
```

**화면 구성**

- 상단: 오늘 소진율 카드 4장 — Firestore 읽기 / 쓰기 / 삭제 / Storage 다운로드
  - 각 카드: `사용량 / 한도`, 백분율 게이지, 잔여량, 리셋까지 남은 시간
  - 80% 경고(주황), 100% 초과(적색) 색상 규칙
- 중단: 저장 용량 — Firestore 1 GiB, Storage 5 GB 대비 게이지
- 하단: 최근 7일 일별 추이 (읽기/쓰기)
- 우측: 예상 월 과금액 (Blaze인 경우). 초과분 × 단가 × 환율

> 차트를 그리기 전에 `dataviz` 스킬을 읽고 색상·게이지 규칙을 맞출 것.

**엔드포인트 응답 계약**

```ts
type UsageSnapshot = {
  fetchedAt: string;          // ISO
  staleBySeconds: number;     // 메트릭 반영 지연 (§4.3)
  plan: 'spark' | 'blaze' | 'unknown';
  firestore: {
    reads: MetricUsage; writes: MetricUsage; deletes: MetricUsage;
    storedBytes: MetricUsage | { estimated: true; bytes: number };
  };
  storage: {
    storedBytes: MetricUsage;
    downloadBytes: MetricUsage;
    uploadOps: MetricUsage; downloadOps: MetricUsage;
  };
  estimatedCostKrw?: number;  // Blaze만
};

type MetricUsage = { used: number; limit: number; resetsAt: string };
```

### Phase 2 — 자체 계측: 사용량 원인 추적 (2일)

Monitoring은 "얼마나 썼는지"는 알려주나 **"어디서 썼는지"** 는 알려주지 않습니다. 최적화하려면 이게 필요합니다.

- `src/data/*/​*.repo.ts` 가 공통 베이스를 쓰는지 확인 후, 없다면 얇은 래퍼 추가
- 읽기/쓰기 발생 시 `{ collection, screen, op }` 를 메모리 카운터에 누적
- **주의**: 카운터를 Firestore에 즉시 쓰면 그 자체가 쓰기 할당량을 소모합니다. `localStorage`에 모았다가 5분마다 1회 배치 flush
- 화면에 "컬렉션별 / 화면별 읽기 TOP 10" 표 추가

이 프로젝트는 `src/data/` 아래 컬렉션 리포지토리가 **150개 이상**입니다. 래퍼를 일괄 적용할 공통 지점이 있는지가 작업량을 좌우합니다. Phase 2 착수 전 조사 필요.

### Phase 3 — 스토리지 상세 (1일)

- 버킷 내 경로별(`branding/`, `chat/`) 용량·객체 수 집계
- `objects.list` 는 객체가 많으면 느리고 호출 비용이 있으므로 **서버에서 1시간 캐시**
- 오래된 메신저 첨부 정리(수명 주기 규칙) 제안 UI

### Phase 4 — 경보 및 자동 차단 (1.5일)

**여기가 실제로 돈을 지키는 단계입니다.**

- Cloud Billing 예산(Budget) 생성 — 예: 월 ₩10,000
- 예산 알림 → Pub/Sub 토픽 → Cloud Function → **결제 계정 연결 해제**
  - GCP에 지출 상한이 없으므로, 과금을 실제로 멈추는 유일한 방법입니다
  - 결제 해제 시 앱이 중단되므로 **운영 정책 합의가 선행**되어야 합니다
- 앱 내 임계치(80%/100%) 도달 시 관리자에게 알림
- 서비스 계정 키 → Workload Identity Federation 전환

---

## 6. 일정 요약

| Phase | 내용 | 기간 | 선행 |
|---|---|---|---|
| 0 | 사실 확정 (플랜·메트릭 이름) | 0.5일 | — |
| 1 | 서버 집계 + 기본 화면 | 2일 | Phase 0 |
| 2 | 자체 계측 (원인 추적) | 2일 | Phase 1 |
| 3 | 스토리지 상세 | 1일 | Phase 1 |
| 4 | 경보 + 자동 차단 | 1.5일 | Phase 1 |

**총 7일** (Phase 2·3은 병렬 가능)

Phase 0 + 1 만으로도 "무료 한도 대비 얼마나 썼는가"라는 핵심 질문에는 답할 수 있습니다. Phase 4는 규모는 작지만 **금전적 리스크 차단 측면에서 가장 중요**하므로, Phase 2·3보다 우선할 것을 권합니다.

---

## 7. 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| Firestore 저장 용량 메트릭 부재 (§4.2) | 저장 용량을 실측 불가 | Phase 0에서 확인. 없으면 추정치 + "추정" 라벨 |
| 서비스 계정 키 유출 | 프로젝트 메트릭·스토리지 노출 | 저장소는 **Public** 임. 키를 절대 커밋 금지. `.env*` gitignore 확인. Phase 4에서 WIF 전환 |
| 저장소가 Public | 별건이나 조직도·실명 노출 | 별도 검토 필요 (Git 상태 분석 보고서 §4.4 참조) |
| 지출 상한 부재 | 폭주 시 무제한 과금 | Phase 4의 자동 결제 해제가 유일한 방어 |
| 자체 계측이 할당량을 소모 | 측정이 문제를 악화 | 배치 flush, 5분 주기 |
| 메트릭 반영 지연 4분 | 실시간 대응 불가 | UI에 갱신 시각·지연 명시 |

---

## 8. 다음 행동

1. Firebase 콘솔에서 **현재 결제 플랜을 확인**한다. 이 계획서의 나머지가 여기에 달려 있다.
2. Blaze라면 **오늘 당장 예산 알림을 설정**한다. 페이지 개발과 무관하게 즉시 가능하며, 리스크를 가장 크게 줄인다.
3. 서비스 계정을 만들고 `metricDescriptors.list` 로 §4.1·§4.2를 확정한다.

---

## 참고

- [Firebase 요금제](https://firebase.google.com/pricing)
- [Firebase 요금제 비교 문서](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Firestore 사용량 모니터링](https://firebase.google.com/docs/firestore/monitor-usage)
- [Cloud Monitoring API v3](https://docs.cloud.google.com/monitoring/api/v3)
- [Google Cloud 측정항목 목록](https://docs.cloud.google.com/monitoring/api/metrics_gcp)
- [Firestore 할당량 및 한도](https://firebase.google.com/docs/firestore/quotas)
