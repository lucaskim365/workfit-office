# 스마트 MES 생산 플랫폼 — 프로젝트 개발 계획서

> **작성일**: 2026-06-23
> **버전**: v1.0 (초안)
> **목적**: 현재 MVP 프로토타입(`스마트-mes-생산-플랫폼-(mvp)`)의 기술 기반 위에, 풀스코프 와이어프레임(`mes layout`, 8개 모듈 / 약 170개 화면)을 실제 제품으로 확장 개발하기 위한 전체 계획.

---

## 1. 프로젝트 개요

### 1.1 배경
- **현재 자산 A — MVP 구현체** (`스마트-mes-생산-플랫폼-(mvp)`)
  - React 19 + TypeScript + Vite + Tailwind 4 + Firebase(Firestore/Auth/Storage) 기반.
  - **5개 화면**이 실시간 DB 연동까지 완성: 대시보드 / 작업지시 / 생산실적입력 / 설비상태 / LOT추적성.
  - Firestore 보안 규칙·위협 모델 문서(`security_spec.md`) 보유. → **검증된 기술 스택**.
- **현재 자산 B — 풀스코프 와이어프레임** (`mes layout`)
  - React 18(CDN) + Babel Standalone 빌드리스 프로토타입, 인라인 스타일.
  - **8개 모듈 / 약 40개 중분류 그룹 / 약 170개 화면**을 설계 완료(`mes/menu-tree.js` 기준).
  - 디자인 토큰(네이비·틸 팔레트), 앱 셸(`app-shell.jsx`), 138종 캡처 보유. → **검증된 UX/화면 설계**.

### 1.2 프로젝트 정의
> 자산 A의 **검증된 기술 스택과 데이터 연동 패턴**을, 자산 B의 **검증된 화면 설계와 도메인 범위**에 적용하여, **운영 가능한 풀스코프 MES 제품**으로 통합 개발한다.

### 1.3 핵심 전략
1. **기술은 MVP를 정본(canonical)으로** — Vite + TS + React 19 + Tailwind + Firebase 구조를 표준으로 채택.
2. **디자인은 와이어프레임을 정본으로** — `mes layout`의 화면 설계·레이아웃·색을 디자인 정본(Single Source of Truth)으로 확정. 단, **인라인 스타일을 그대로 옮기지 않고 Tailwind로 전환**하여 일관성·유지보수성을 확보(아래 1.4).
3. **점진적 모듈 출시** — 170개 화면을 한 번에 만들지 않고, 가치·의존성 순으로 모듈 단위 릴리스.

### 1.4 디자인 정본 원칙 (확정)
> **"보이는 디자인은 100% 와이어프레임, 구현 코드는 100% 제품 수준."**

- **정본**: 모든 화면의 레이아웃·간격·색·컴포넌트 형태는 `mes layout` 와이어프레임을 기준으로 한다. (MVP의 화면 스타일이 와이어프레임과 다를 경우 **와이어프레임 우선**.)
- **이관 방식 — 인라인 스타일 → Tailwind 전환 (확정)**: 와이어프레임의 `style={{}}` 인라인 스타일과 CSS 변수는 그대로 유지하지 않고, **Tailwind 디자인 토큰(theme preset) + 유틸리티 클래스**로 전환한다.
  - **사유**: ① 170개 화면 전반의 **시각적 일관성**(토큰 1곳 수정 → 전 화면 반영), ② **유지보수성**(중복 인라인 스타일 제거, 다크모드·테마 확장 용이), ③ MVP가 이미 Tailwind 4 기반이라 **스택 단일화**.
- **금지**: 화면별 임의 색상·간격 하드코딩(인라인 style), 토큰 외 색상 사용. → 디자인시스템 컴포넌트·토큰만 사용.

---

## 2. 현황 분석 (Gap Analysis)

| 영역 | MVP (자산 A) | 와이어프레임 (자산 B) | 갭 / 통합 과제 |
|------|------|------|------|
| 빌드 | Vite 번들 + TS | 없음(CDN+Babel) | 와이어프레임을 Vite 구조로 이관 |
| 언어 | TypeScript | 순수 JSX(.jsx) | 타입 정의 + TS 전환 |
| 스타일 | Tailwind CSS 4 | 인라인 style 객체 + CSS변수 | **디자인 정본=와이어프레임**, 인라인→Tailwind 토큰 전환 |
| 라우팅 | useState 탭(5개) | 화면 170개 메뉴트리 | React Router 도입 + 동적 메뉴 |
| 상태/DB | Firestore 실시간 | 정적 샘플(`data.jsx`) | 컬렉션 스키마 확장, 실데이터 연동 |
| 인증/권한 | 익명 로그인만 | 그룹권한관리 화면 설계됨 | RBAC 실제 구현 필요 |
| 화면 수 | 5 | ~170 | **약 165개 신규 구현** |

**결론**: 기술 골격은 재사용 가능하나, ① 라우팅/메뉴 시스템 ② RBAC 인증 ③ 디자인 시스템 표준화 ④ 데이터 모델 대폭 확장이 신규 기반 작업으로 선행되어야 한다.

---

## 3. 목표 및 범위

### 3.1 목표
- **1차(제품화 기반)**: 표준 셸·라우팅·인증·디자인 시스템 + 핵심 운영 모듈(생산/설비/품질 일부) 출시.
- **2차(전 모듈)**: 자재·리포트·시스템관리 포함 8개 모듈 전 화면 가동.
- **3차(연동/고도화)**: ERP·설비(OPC-UA/PLC) 인터페이스, SPC 실시간 알람, 추적성 규제 대응.

### 3.2 범위 (8개 모듈)
1. **운영 현황** (2화면) — 통합 모니터링, 라인 가동
2. **기준 정보** (9) — 사용자/거래처/권한, 품목·설비·불량 마스터, 공정·라우팅
3. **생산 관리** (26) — 계획/지시, 실행/실적, 추적/분석, 외주
4. **설비 관리** (35) — 기준정보, 모니터링(OEE/Andon), 보전(PM/BM/PdM), 예비품, 금형, 검교정, 분석
5. **품질 관리** (29) — IQC/PQC/OQC, NCR/MRB/CAPA, SPC, 추적, 계측
6. **자재 관리** (25) — 입고, 창고/위치, 불출, 외주자재, 출하/재고, 실사, 용기/AGV
7. **리포트** (31) — 생산/품질/설비/자재/원가/추적/경영 대시보드
8. **시스템 관리** (9+) — 사용자/권한/메뉴/로그, 다국어, 달력, 백업, 인터페이스

### 3.3 범위 외 (별도 검토)
- 모바일 네이티브 앱(반응형 웹으로 우선 대응), AI/예지보전 모델 학습, 외부 ERP 신규 구축.

---

## 4. 기술 아키텍처

### 4.0 프레임워크 결정 근거 (확정: React + Vite SPA 현행 유지)
> **결론: 프레임워크는 React를 유지하고, Vite 기반 SPA 구조를 그대로 채택한다.** 다른 프레임워크로의 전환은 전환 이득보다 비용이 커 채택하지 않는다.

**① React 유지 근거**
- **자산 정합성**: MVP(React 19)·와이어프레임 170화면(React 18 JSX) **모두 React** → 전환 시 전 자산 재작성, "와이어프레임을 디자인 정본으로 쓴다"는 핵심 전략(1.3) 붕괴.
- **엔터프라이즈 LOB 적합성**: 데이터 테이블·폼 중심 화면에 TanStack Table/Query·React Hook Form·AG Grid 등 생태계가 가장 성숙.
- **인력·배포**: React 개발자 풀이 넓어 팀 확장 용이, 배포 타깃 Vercel이 React를 1순위 지원.

| 후보 | 평가 | 채택 |
|------|------|:---:|
| **React (현행)** | 자산 재사용·생태계·인력·데이터그리드 성숙 | ✅ |
| Vue 3 / Svelte / Angular | 전면 재작성 필요, 전환 이득 없음(데이터그리드·생태계 또는 학습곡선 열위) | ✗ |

**② Vite SPA 유지 근거 (vs Next.js)**
- MES는 **인증 뒤에서 도는 사내 시스템** → Next.js의 SSR/SEO 이점이 사실상 무의미.
- **Firestore 실시간 구독**은 CSR(SPA)과 더 잘 맞음(SSR과 상충).
- 서버 사이드 로직이 필요한 영역은 **Firebase Functions가 담당**(4.1·5.3·7.5) → 메타프레임워크 불필요.
- MVP 구조를 **변경 없이 그대로 계승** → 마이그레이션 비용 0.

> 향후 공개 포털·SEO·SSR 요구가 신규 발생하면 해당 영역만 별도 Next.js 앱으로 분리 검토(현 범위에선 불필요).

### 4.1 표준 스택 (MVP 기반 확정)
| 레이어 | 채택 | 비고 |
|------|------|------|
| 빌드 | Vite 6 | MVP 구성 유지 |
| 언어 | TypeScript 5.8 | 전 코드 TS 전환 |
| UI | React 19 | |
| 라우팅 | **React Router v7 (신규)** | 메뉴트리 기반 동적 라우팅 |
| 스타일 | Tailwind CSS 4 + 디자인 토큰 | 와이어프레임 CSS변수 → theme 이관 |
| 상태관리 | **TanStack Query + Zustand (신규)** | 서버상태/클라이언트상태 분리 |
| 차트 | Recharts | MVP 유지 |
| 백엔드 | Firebase(Firestore/Auth/Storage) + **Cloud Functions(신규)** | 트랜잭션·집계·권한검증 서버화 |
| 폼 | **React Hook Form + Zod (신규)** | 170화면 폼 표준화·검증 |

> **백엔드 결정**: 데모·1차는 Firebase 유지가 합리적(속도·실시간·인증 기제공). 단, MES의 트랜잭션 정합성(재고 수불, LOT 추적, 마감)은 클라이언트 직접 쓰기로 보장 불가 → **Cloud Functions로 핵심 쓰기 로직 서버화**를 1차부터 적용. 향후 트래픽·정합성 요구 증대 시 전용 백엔드(NestJS+PostgreSQL) 이전을 3차에서 재평가.

### 4.2 디렉터리 구조 (제안)
```
src/
├── app/                 # 앱 셸, 라우터, 프로바이더
│   ├── shell/           # app-shell 이관 (상단모듈+레일+탭)
│   └── routes.tsx       # menu-tree 기반 라우트 생성
├── shared/
│   ├── ui/              # 디자인시스템 공통 컴포넌트(버튼/테이블/모달/탭)
│   ├── theme/           # 디자인 토큰(Tailwind preset)
│   ├── lib/             # firebase, query client, utils
│   └── types/           # 도메인 타입(types.ts 확장)
├── modules/
│   ├── ops/  base/  prod/  equip/  qual/  mat/  report/  sys/
│   │   └── <screen>/    # 화면별: View.tsx + hooks + schema
└── data/                # seed/mock (data.jsx 이관)
functions/               # Cloud Functions (집계·트랜잭션·권한)
```

### 4.3 와이어프레임 → 제품 이관 전략 (인라인 스타일 → Tailwind)
> 디자인 정본은 와이어프레임(1.4), **구현 방식은 Tailwind 전환**으로 확정.

**3단계 이관 파이프라인**
1. **토큰 추출** — 와이어프레임 CSS 변수(`--navy #1f2f55`, `--teal #17a89a`, `--ink`, `--border`, Pretendard 등)를 **Tailwind theme preset**으로 1회 정의. 이후 색·간격·폰트는 토큰만 참조.
2. **공통 컴포넌트 추출** — 반복 패턴(DataTable, FilterBar, StatusBadge, Modal, Drawer, Toast, QuickDock, Chart 래퍼, `app-shell`)을 **Tailwind 기반 디자인시스템 컴포넌트로 1회 구현** 후 전 화면 재사용.
3. **화면 재구성** — `mes/*.jsx`는 **레이아웃·픽셀 참조 사양**으로만 사용. 인라인 `style={{}}`를 **Tailwind 유틸리티 클래스**로 바꿔 TS 컴포넌트로 재작성(시각 결과는 동일, 코드는 토큰/클래스 기반).

- **이관 검증**: 와이어프레임 캡처(`screenshots/`)와 신규 화면을 시각 대조(diff)하여 디자인 동일성 확인.
- `app-shell.jsx`·`menu-tree.js`·`data.jsx`는 **최우선 이관 대상**(전체 화면의 골격).
- **잔존 인라인 스타일 금지** — 동적 계산값(예: 차트 폭) 등 불가피한 경우만 예외, 색·간격은 항상 토큰.

---

## 5. 데이터 모델 & 백엔드 설계

### 5.1 컬렉션 확장 (현행 4 → 목표 ~25+)
- **현행**: `work_orders`, `equipment`, `production_records`, `defect_alerts`
- **기준정보**: `users`, `roles`, `vendors`, `items`, `common_codes`, `processes`, `routings`, `defect_codes`
- **생산**: `prod_plans`, `wip`, `material_issues`, `lot_genealogy`, `downtimes`, `subcon_orders`
- **설비**: `equip_master`, `pm_plans`, `checks`, `breakdowns`, `spares`, `molds`, `gages`, `calibrations`
- **품질**: `inspections(iqc/pqc/oqc)`, `insp_specs`, `ncrs`, `capa`, `spc_samples`, `voc`, `reports_8d`
- **자재**: `receipts`, `locations`, `stock`, `pickings`, `shipments`, `stock_counts`
- **시스템**: `menus`, `audit_logs`, `interfaces`, `factory_calendar`

### 5.2 인증·권한 (RBAC) — 1차 필수
- Firebase Auth(이메일/SSO) + **Custom Claims로 역할 부여**.
- `roles` × `menus` 매핑으로 메뉴/기능(CRUD) 권한 제어 → `그룹권한관리` 화면과 연동.
- 보안 규칙을 `security_spec.md` 모델 확장: 익명 read 전면 개방 → **역할·인증 기반으로 강화**(현 MVP의 `read:true`/`delete:true` 취약점 해소).

### 5.3 트랜잭션·집계 (Cloud Functions)
- 재고 수불, LOT 분할/병합, 생산마감, OEE/MTBF 집계, COA 발행 등은 서버 함수로 원자성 보장.
- 감사추적(`audit_logs`) 자동 기록 트리거.

---

## 6. 공통 플랫폼 / 디자인 시스템 (선행 과제)

| 항목 | 내용 |
|------|------|
| 디자인 정본 | **와이어프레임(`mes layout`)이 디자인 SSOT** — 레이아웃·색·간격 기준(1.4) |
| 디자인 토큰 | 와이어프레임 CSS변수(navy/teal/ink…) → **Tailwind preset으로 전환**(인라인 스타일 폐기) |
| 앱 셸 | 상단 모듈 내비 + 접이식 레일 + 닫기형 문서 탭(멀티탭) |
| 공통 컴포넌트 | DataTable(정렬/필터/페이징/엑셀), FilterBar, StatusBadge, Modal, Drawer, Toast, QuickDock, Chart 래퍼 |
| 폼 시스템 | RHF + Zod 스키마, 공용 입력 컴포넌트 |
| 동적 메뉴/라우팅 | `menu-tree` → 라우트·사이드바·권한 일괄 생성 |
| i18n | 한국어 기준, 다국어 키 구조 선행 설계 |

> **이 단계가 전체 일정의 성패를 좌우** — 공통 자산 완성도가 높을수록 화면당 개발비용이 급감(170개 × 절감 효과).

---

## 7. 개발 · 배포 환경 (DevOps)

> **배포 타깃 확정**: 프론트엔드는 **Vercel(GitHub 연동 자동배포)**, 백엔드 로직은 **Firebase Cloud Functions**로 분리 운영.

### 7.0 선행 정리 과제 (Vercel 연동 전 필수)
| 문제 | 영향 | 조치 |
|------|------|------|
| 폴더명 한글·공백·괄호 (`스마트-mes-…(mvp) (1)`) | git/Vercel 경로·URL·CLI 오류 | **ASCII 클린 루트**(`workfit-office/`)로 재구성 |
| `firebase-applet-config.json` 평문 커밋 | 시크릿·환경 분리 불가 | **환경변수(`VITE_FB_*`)로 이전** |
| `.env.example`의 `GEMINI_API_KEY` (AI Studio 잔재) | 불필요 | Vercel 환경변수로 대체·정리 |
| `dev: vite --port=3000 --host=0.0.0.0` | AI Studio 잔재 | 표준 dev 스크립트로 정리 |

### 7.1 저장소 구성
- **단일 앱 구조로 시작 → Phase 0 후반 모노레포(pnpm workspace) 승격**(처음부터 모노레포는 과설계).
- 와이어프레임(`mes layout`)·MVP 원본은 `/_reference`로 분리(빌드 대상 제외).
```
workfit-office/          ← git 루트 (ASCII)
├── .nvmrc               ← Node 20
├── .gitignore           ← .env*, dist, node_modules
├── vercel.json          ← SPA rewrite
├── vite.config.ts
├── src/                 ← 앱 (MVP 코드 이관)
├── functions/           ← Firebase Cloud Functions
├── docs/                ← 계획서 등
└── _reference/          ← 와이어프레임·MVP 원본(참조용)
```

### 7.2 로컬 개발 환경
| 항목 | 채택 | 이유 |
|------|------|------|
| Node | **20 LTS** (`.nvmrc`) | Vercel 빌드 환경과 일치 |
| 패키지 매니저 | **pnpm** | 속도·디스크·워크스페이스 대비 (lockfile 단일화 필수) |
| Firebase 로컬 | **Emulator Suite** | Firestore/Auth/Functions 로컬 테스트, 실DB 오염 방지 |
| 품질 | ESLint + Prettier + `tsc --noEmit` | 커밋 전 일관성 |

### 7.3 환경변수 / 시크릿 전략 ⭐
- Vite는 **`VITE_` 접두사만 클라이언트 노출** → Firebase 웹 config는 `VITE_FB_*`로 주입.
- **진짜 비밀**(서비스계정 키, Gemini API key)은 `VITE_` 없이 → 서버(Functions)에서만 사용.
- **환경 3분리**: Firebase 프로젝트를 dev/staging/prod로 나누고 Vercel 환경별 다른 값 주입.

| Vercel 환경 | 브랜치 | Firebase 프로젝트 |
|------|------|------|
| Production | `main` | `mes-prod` |
| Preview | PR 브랜치 | `mes-staging` |
| Development | 로컬 | `mes-dev` + Emulator |

### 7.4 Vercel + GitHub 워크플로
- Vercel 대시보드에서 GitHub 레포 Import(Vite 자동감지). `main` push → **Production**, 모든 PR → **Preview 배포(고유 URL)**.
- **SPA 라우팅 rewrite 필수**(React Router 새로고침 404 방지):
```json
// vercel.json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
- 앱이 하위 폴더면 Vercel **Root Directory** 지정.

### 7.5 백엔드 배포 (Firebase Functions 분리)
- 프론트(Vercel)와 **배포 파이프라인 2개**: Vercel(자동) + Firebase(`firebase deploy` / GitHub Actions).
- 재고 수불·LOT·마감 등 트랜잭션·트리거 로직은 **Firestore에 근접한 Firebase Functions**가 정석(상세 4.1·5.3 참조).
- Functions·보안규칙(`firestore.rules`)은 **GitHub Actions로 자동배포** 권장.

### 7.6 브랜치 전략 & CI
```
main        → Production (보호 브랜치, PR만 머지)
feature/*   → PR → Preview 자동배포 → 리뷰 → main
```
- 초기 **trunk-based(main + feature)** → 팀 확장 시 `staging` 추가.
- `main` 보호: PR 리뷰 1+, **CI(`tsc`·lint·build) 통과 필수**.
- **PR Preview URL로 와이어프레임 대조 디자인 검수** 후 머지(1.4 디자인 정본 검증 연계).

---

## 8. 개발 로드맵 (단계별)

> 가정: 프론트 3~4명 + 백엔드 1~2명 + 디자인/기획 1명 규모. 기간은 상대 추정(실제 산정 시 조정).

### Phase 0 — 기반 구축 (4~6주)
- 모노레포/디렉터리 구조 확정, MVP 코드 정리·TS 강화.
- React Router·TanStack Query·RHF/Zod 도입, **디자인시스템 v1**, 앱 셸·동적 메뉴 이관.
- RBAC 인증 + 보안 규칙 강화, Cloud Functions 골격.
- **산출물**: 빈 셸에서 메뉴 클릭→권한별 라우팅 동작.

### Phase 1 — 핵심 운영 모듈 (8~10주)
- **운영현황(2)** + **기준정보(9)** + **생산관리 핵심(계획/지시/실적/추적 ~15)** + **설비 모니터링(OEE/Andon/Alarm ~5)**.
- MVP의 기존 5화면을 신구조로 흡수·고도화.
- **마일스톤 M1**: 생산 현장 실데이터 입력→대시보드 반영 end-to-end.

### Phase 2 — 품질 & 설비 보전 (8~10주)
- **품질관리(29)** 전체(IQC/PQC/OQC, NCR/CAPA, SPC).
- **설비관리** 보전/예비품/금형/검교정/분석(~30).
- **마일스톤 M2**: SPC 알람·검사판정·LOT 품질 역추적 동작.

### Phase 3 — 자재 & 리포트 (8~10주)
- **자재관리(25)** 입고~출하~실사 전체.
- **리포트(31)** 전 카테고리 + 경영 KPI 대시보드.
- **마일스톤 M3**: 자재 수불 정합성, 리포트 자동 집계.

### Phase 4 — 시스템관리 & 연동/안정화 (6~8주)
- **시스템관리(9+)**: 메뉴/권한/로그/백업/다국어/달력.
- **외부 인터페이스**: ERP(계획수신·실적전송), 설비(OPC-UA/PLC), AGV/계측 I/F.
- 성능 최적화, 보안 점검, UAT, 운영 배포.
- **마일스톤 M4(GA)**: 전 모듈 운영 + 외부 연동.

**총 추정 기간**: 약 **9~11개월** (Phase 병렬화·인력 규모에 따라 가변).

---

## 9. 모듈별 우선순위 매트릭스

| 모듈 | 화면 | 가치 | 난이도 | 의존성 | 권장 Phase |
|------|----:|:----:|:------:|------|:---:|
| 운영 현황 | 2 | 높음 | 낮 | 기준정보 | 1 |
| 기준 정보 | 9 | 필수 | 중 | (선행) | 1 |
| 생산 관리 | 26 | 최상 | 높 | 기준정보 | 1~2 |
| 설비 관리 | 35 | 높음 | 높 | 기준정보 | 1~2 |
| 품질 관리 | 29 | 높음 | 높 | 생산·기준 | 2 |
| 자재 관리 | 25 | 높음 | 높 | 기준·생산 | 3 |
| 리포트 | 31 | 중상 | 중 | 전 모듈 데이터 | 3 |
| 시스템 관리 | 9+ | 필수 | 중 | (기반) | 0,4 |

> 원칙: **기준정보·시스템(기반) 먼저 → 생산(가치 최상) → 품질/설비 → 자재 → 리포트(데이터 의존)** 순.

---

## 10. 비기능 요구사항 (NFR)

- **보안**: RBAC, 감사추적, Firestore 규칙 강화, 입력검증(Zod+규칙 이중), 시크릿 분리(현재 평문 커밋된 Firebase config 분리·환경변수화).
- **성능**: 대용량 테이블 가상 스크롤, 리포트 집계 캐싱, 실시간 리스너 구독 범위 최소화.
- **확장성**: 모듈 플러그인 구조, 동적 메뉴, 멀티 라인/공장(멀티테넌시) 고려.
- **연동성**: OPC-UA/PLC, ERP, 계측기, AGV 표준 인터페이스 계층(`interfaces`).
- **추적성/규제**: LOT 정·역추적, DHR(제품이력카드), COA, 감사로그 — 규제 산업 대응.
- **가용성**: 백업/복구, 오프라인 입력 큐(현장 단말).

---

## 11. 조직 · 리스크 · 산출물

### 10.1 권장 조직
- PM/기획 1, 디자인 1, 프론트엔드 3~4, 백엔드(Functions/연동) 1~2, QA 1.

### 10.2 주요 리스크 & 대응
| 리스크 | 영향 | 대응 |
|------|------|------|
| 170화면 범위 과다 | 일정 지연 | 모듈 단위 점진 출시, 공통 컴포넌트 선투자 |
| Firebase 트랜잭션 한계 | 데이터 정합성 | 핵심 쓰기 Functions 서버화, 3차 백엔드 재평가 |
| 외부 설비/ERP 연동 불확실 | 후반 리스크 | I/F 계층 추상화, Mock 어댑터 선개발 |
| 디자인시스템 미성숙 | 화면당 비용 증가 | Phase 0에 집중 투자·동결 |
| 보안 규칙 취약(현 MVP) | 데이터 노출 | Phase 0에서 RBAC·규칙 전면 재작성 |

### 10.3 산출물
- 기반: 디자인시스템·컴포넌트 라이브러리, 라우팅/권한 프레임워크.
- 문서: 데이터 모델 명세, API/Functions 명세, 보안 사양(확장), 화면정의서(와이어프레임 연계).
- 제품: 8개 모듈 운영 빌드, 외부 연동 어댑터, 운영 배포 파이프라인.

---

## 12. 즉시 착수 항목 (Next Actions)
1. Phase 0 킥오프: 디렉터리 구조 확정 + MVP 코드 이식.
2. `menu-tree.js` → 라우트/사이드바 자동 생성기 구현.
3. **와이어프레임 디자인 토큰 → Tailwind preset 전환** + 공통 DataTable/FilterBar/Modal 1차(인라인 스타일 폐기 원칙 적용).
4. RBAC 인증 + Firestore 보안 규칙 재설계(취약점 해소).
5. 기준정보 모듈부터 실제 화면 이관 착수(파일럿).

---
*본 계획서는 두 자산 폴더 분석에 기반한 초안이며, 인력·일정·연동 범위 확정 시 세부 산정을 갱신한다.*
