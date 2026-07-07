# Workfit Office

제조 실행(MES/ERP)과 그룹웨어를 하나로 묶은 통합 사무·생산 플랫폼.
경영 현황부터 생산·품질·설비·자재·영업, 그리고 전자결재·메신저까지 **12개 모듈 그룹 / 123개 기능**을 단일 SPA로 제공합니다.

MVP 프로토타입(React 19 + TypeScript + Vite + Firebase)의 기술 기반 위에,
풀스코프 와이어프레임 설계를 정본으로 실제 제품으로 확장 개발 중입니다.

## 주요 모듈

| 그룹 | 코드 | 주요 화면 |
| --- | --- | --- |
| 경영 현황 | `exec` | 경영 대시보드, 통합 모니터링, 라인 가동 현황 |
| 기준 정보 | `base` | 사용자·거래처, 조직·결재 기준정보, 품목·공정·설비 마스터 |
| 영업 관리 | `sales` | 견적·수주, 출하·매출, 수금·채권·여신, 매출 통계/KPI |
| 생산 관리 | `prod` | 생산계획·작업지시, 실적, 로트 추적, WIP·재작업 |
| 자재/물류 | `mat` | 입출고, 청구·불출, 재고·창고, 외주 자재 |
| 품질 관리 | `qual` | IQC/PQC/OQC, 검사 기준, SPC, 부적합·CAPA·8D |
| 설비 관리 | `equip` | 설비 마스터, OEE·Andon 모니터링, PM/BM/PdM 보전, 예비품 |
| 그룹웨어 | `gw` | 전자결재, 메신저, 조직도, 일정·자원예약, 게시판, 문서관리 |
| 리포트 | `report` | 각 도메인 집계·분석 리포트 |
| 시스템 관리 | `sys` | 사용자·권한·메뉴·로그, 회사정보, 백업, 인터페이스 |
| 공통 | `common` | 공통 UI·유틸 |
| 운영 | `ops` | 대시보드 홈, 운영 공용 |

## 기술 스택

- **프론트엔드**: React 19 + TypeScript + Vite (SPA)
- **스타일**: Tailwind CSS 4
- **상태/데이터**: TanStack Query, React Hook Form + Zod
- **백엔드**: Firebase (Firestore / Auth / Storage)
- **배포**: Vercel (GitHub 연동, PR Preview / main Production)

## 시작하기

### 요구 사항
- Node.js 20+ (`.nvmrc` 기준 20, 로컬 26에서도 동작)

### 설치 및 실행
```bash
npm install

# Firebase 웹 설정을 로컬 환경변수로 등록
cp .env.example .env.local   # 값 채우기

npm run dev                  # 개발 서버 (Vite)
```

### 환경변수
`VITE_FB_*` 키에 Firebase 웹 클라이언트 설정을 넣습니다. 자세한 항목은 [`.env.example`](./.env.example) 참조.
로그인 게이트는 `VITE_AUTH_ENABLED="true"`일 때만 활성화됩니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 타입 체크 후 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | 타입 체크 (`tsc --noEmit`) |
| `npm run seed` | Firestore 시드 데이터 적재 |

## 프로젝트 구조

```
src/
├── app/          # 앱 셸(Shell), 라우팅, 메뉴 트리, 인증
├── modules/      # 모듈 그룹별 화면 (base·gw·prod·qual·sales·...)
├── features/     # 기능 단위 화면 컴포넌트 (123개)
├── domain/       # 도메인 엔티티·타입 (~130개)
├── services/     # 도메인 서비스 (생산·품질·입출고·출하)
├── data/         # Firestore 데이터 계층 (코덱·리포지토리)
├── shared/       # 공용 타입·UI·유틸
└── assets/       # 정적 자산
```

## 문서

`docs/` 디렉터리에 모듈별 개발 계획서와 설계 문서가 있습니다.

- [데이터 모델 설계서](./docs/데이터_모델_설계서.md)
- [비즈니스 로직 개발 전략](./docs/비즈니스_로직_개발_전략.md)
- [DB 이관 대비 설계원칙](./docs/DB_이관_대비_설계원칙.md)
- [그룹웨어 개발 계획서](./docs/그룹웨어_개발_계획서.md)
- [전자결재 워크플로 개발 계획서](./docs/전자결재_워크플로_개발_계획서.md)
- [동적 결재선 룰엔진 개발 계획서](./docs/동적_결재선_룰엔진_개발_계획서.md)
- [경영자 대시보드 개발 계획서](./docs/경영자_대시보드_개발_계획서.md)
- [메신저 개발 계획서](./docs/메신저_개발_계획서.md)
- [Firestore 시드 적재 가이드](./docs/Firestore_시드_적재_가이드.md)
