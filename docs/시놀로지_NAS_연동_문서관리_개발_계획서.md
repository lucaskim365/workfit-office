# 시놀로지 NAS 연동 문서관리 개발 계획서

> 상태: **계획(draft)** · 작성 2026-07-09
> 선행: [[그룹웨어_개발_계획서.md]] · [[데이터_모델_설계서.md]] · [[DB_이관_대비_설계원칙.md]]

---

## 0. 이 문서의 범위

본 계획서는 **시놀로지 NAS(Synology NAS)를 온프레미스 스토리지 백엔드로 활용**하여, Workfit Office 그룹웨어 모듈 내의 **"문서관리(gwDocument)" 및 공통 파일 업로드/다운로드 시스템**을 구축하는 기술 분석 및 개발 계획을 다룬다.

- **대상**:
  - 시놀로지 NAS 연동 프로토콜 선정 및 아키텍처 설계
  - React SPA(프론트엔드)에서 안전하게 NAS에 파일을 업로드하고 다운로드하는 인터페이스 구현
  - `gwDocuments` 메타데이터 스키마 설계 및 Firestore 저장 연계
  - 파일 리스트 브라우저, 폴더 구조 관리, 업로드/다운로드 UI 화면 구성
- **비대상**:
  - Synology DSM OS 자체의 설치 및 초기 볼륨 구성 (사용자 환경 전제)
  - NAS에 저장된 미디어 파일의 서버 사이드 트랜스코딩/포맷 변환 (브라우저 네이티브 지원 포맷만 미리보기 제공)
  - 액티브 디렉토리(AD)/LDAP 등 전사 계정 통합 관리 (추후 고도화 과제로 분류)

---

## 1. 배경 · 현황

현재 Workfit Office는 모든 첨부 파일과 메신저 미디어를 **Firebase Storage(Google Cloud Storage)**에 저장하도록 설계되어 있다. 이 방식은 클라우드 배포 환경에서 설정이 간단하다는 장점이 있으나, 실제 제조업 공장이나 현장 사무실에 도입 시 다음과 같은 문제에 직면한다.

1. **클라우드 스토리지 비용 부담**: 도면(CAD 파일), 품질 검사 사진/비디오, 대용량 PDF 문서 등 공장 운영 중 발생하는 데이터의 크기가 매우 크며, Firebase Storage의 용량 및 아웃바운드 대역폭 비용이 지속적으로 상승한다.
2. **업로드/다운로드 속도 병목**: 현장 직원들이 대용량 파일(수십~수백 MB)을 공유할 때 외부 인터넷 망을 거쳐 구글 클라우드 서버와 통신하므로 사내 LAN 속도를 100% 활용하지 못하고 대기 시간이 길어진다.
3. **온프레미스 NAS의 활용 미흡**: 많은 중소/중견 제조 기업이 사내에 이미 시놀로지 NAS를 보유하고 백업용으로만 사용하고 있어, 이를 사내 시스템인 Workfit Office와 직접 연동하여 스토리지 공간을 단일화할 필요성이 크다.

따라서 **"메타데이터는 Firestore(클라우드/하이브리드)에 저장하고, 실물 바이너리 데이터는 사내 LAN의 시놀로지 NAS에 전송"**하는 하이브리드 문서관리 시스템이 필요하다.

---

## 2. 목표 · 비목표

### 목표
1. **스토리지 추상화 계층 구축**: `StorageService` 인터페이스를 정의하여 환경에 따라 Firebase Storage와 Synology NAS를 선택 및 전환 가능하게 한다.
2. **로컬 고속 통신**: 사내 LAN 망에서 접속 시 NAS와 직접 통신(기가비트 대역폭 활용)하여 파일 전송 속도를 극대화한다.
3. **CORS 및 보안 우회**: 브라우저 cross-origin 제약을 회피하고, NAS의 어드민 크리덴셜(ID/PW)이 프론트엔드 코드에 노출되는 위험을 원천 차단한다.
4. **폴더 트리 및 문서 관리 기능**: 파일 메타데이터(파일명, 크기, 업로더, 카테고리 등)를 체계적으로 관리하고, 가상 폴더 트리 구조를 제공한다.
5. **실시간 다운로드/미리보기**: 문서관리 화면에서 이미지, PDF, 텍스트 문서 등을 즉시 미리볼 수 있게 한다.

### 비목표
- NAS 내부의 삼바(SMB)나 NFS 프로토콜을 웹 브라우저에서 직접 연결하는 것 (브라우저 샌드박스로 인해 불가능).
- 시놀로지 QuickConnect를 활용한 외부 접속 성능의 극적인 개선 (외부 통신 속도는 사용자 회선 속도에 종속됨).
- NAS 전체 파일 시스템의 탐색 (Workfit Office 전용 공유 폴더인 `/WorkfitOffice/` 내의 데이터만 제어).

---

## 3. 기술적 검토: 시놀로지 NAS 연동 방안

웹 브라우저(Vite + React)에서 작동하는 클라이언트가 사내의 시놀로지 NAS와 파일을 주고받는 방법은 크게 세 가지로 분류된다.

### Option 1. Synology WebAPI (DSM File Station API) 직접 연동
시놀로지가 기본적으로 제공하는 RESTful API인 `SYNO.FileStation.*`을 활용하여 클라이언트 브라우저가 NAS와 직접 통신한다.
- **인증 방식**: `/webapi/auth.cgi`에 로그인하여 `sid`(Session ID) 획득 후 모든 요청에 쿼리스트링이나 헤더로 전달.
- **장점**: 별도의 중간 서버나 추가 패키지 설치 없이 NAS 기본 설정만으로 동작 가능.
- **단점**:
  - **CORS 이슈**: Vercel에 배포된 도메인(`*.vercel.app`)에서 사내 IP/도메인의 NAS로 HTTP 요청을 보낼 때 CORS 차단 발생. DSM 역방향 프록시에서 커스텀 헤더(`Access-Control-Allow-*`) 설정을 우회 적용해야 함.
  - **보안 취약점**: 클라이언트 단에서 NAS API 로그인을 수행해야 하므로, API 전용 계정을 파더라도 계정 유출 위험이 존재함.

### Option 2. WebDAV 프로토콜 직접 연동
시놀로지 패키지 센터에서 **WebDAV Server**를 활성화하고 표준 WebDAV API를 브라우저에서 직접 호출한다.
- **장점**: 표준 HTTP 메서드(`PROPFIND`, `PUT`, `GET`, `DELETE`)를 사용하므로 구현이 간결하며, 파일 쓰기/읽기 성능이 안정적임.
- **단점**:
  - 브라우저 환경에서 직접 WebDAV 연결 시 마찬가지로 CORS 제약이 걸림.
  - NAS에 WebDAV 패키지를 추가로 설치하고 포트(기본 5005/5006)를 열어야 하는 인프라 설정 공수가 필요함.

### Option 3. 사내 On-Premise API Gateway 프록시 도입 (권장)
시놀로지 NAS 내부의 **Container Manager (Docker)**를 이용하여 가벼운 Node.js Express 기반의 **스토리지 API 게이트웨이(Workfit Storage Gateway)**를 컨테이너로 가동한다.
- **아키텍처**:
  ```
  [ React Client (Browser) ]
            │
            ├─(1) 메타데이터 저장 & 조회 ──> [ Firestore (Cloud) ]
            │
            └─(2) 실제 파일 Upload/Download (CORS 허용)
                      │ (HTTP REST)
                      ▼
        [ Workfit Storage Gateway (Docker on NAS) ]
                      │ (로컬 볼륨 마운트 or Local WebAPI)
                      ▼
        [ Synology NAS Storage (Volume) ]
  ```
- **인증 방식**: 게이트웨이는 로컬 볼륨 `/volume1/WorkfitOffice`에 직접 마운트되어 파일을 제어하므로 NAS 로그인 과정이 생략되며, 클라이언트는 API Gateway가 발행한 보안 토큰(또는 API Key)만 사용한다.
- **장점**:
  - CORS 설정을 게이트웨이 노드 코드 한 줄로 완벽히 해결 (`cors()` 미들웨어).
  - NAS 로그인 정보가 외부에 노출되지 않아 보안성이 가장 높음.
  - 파일 업로드 크기 제한을 자유롭게 조절 가능.
  - LAN 내부 환경에서 최고의 전송 속도 보장.
- **단점**: Docker를 구동할 수 있는 Intel/AMD 또는 고성능 ARM 기반의 시놀로지 NAS 모델이 필요함.

### 기술 비교 요약
| 비교 항목 | Option 1. DSM WebAPI 직접 연동 | Option 2. WebDAV 직접 연동 | Option 3. On-Premise 게이트웨이 (권장) |
|---|---|---|---|
| **CORS 대응** | DSM 역방향 프록시 커스텀 헤더 설정 필요 | DSM 리버스 프록시/Nginx 튜닝 필요 | 게이트웨이에서 CORS 자체 해결 (매우 쉬움) |
| **보안성** | 낮음 (로그인 세션 키 프론트 노출) | 보통 (WebDAV 인증정보 프론트 유지) | 높음 (게이트웨이가 로컬 크리덴셜 캡슐화) |
| **인프라 공수** | 낮음 (DSM 기본 기능) | 보통 (WebDAV 패키지 활성화) | 보통 (Docker 컨테이너 1개 빌드 및 구동) |
| **파일 전송 속도** | 보통 (WebAPI 오버헤드 존재) | 좋음 (WebDAV 최적화) | 최상 (내부 파일 마운트 방식 및 스트림 전송) |
| **구현 난이도** | 보통 (Multipart 폼 데이터 구성 복잡) | 보통 (WebDAV JS 클라이언트 라이브러리 사용)| 낮음 (가장 표준적인 REST API 서버 구현) |

**결론**: 프로덕션 안정성과 보안을 확보하기 위해 **Option 3(사내 On-Premise API Gateway)**를 최우선 권장안으로 확정하고, 인프라 확장이 어려운 환경을 위해 WebAPI를 이용한 우회 설정 가이드를 부록으로 제공한다.

---

## 4. 핵심 설계 결정 — 아키텍처 및 연동 방식

### 4.1 하이브리드 파일 아키텍처 (Hybrid File Storage)
모든 파일의 메타데이터와 권한 정보는 **Firebase Firestore**에 중앙 집중화하여 저장한다. 이를 통해 파일의 소유권, 다운로드 로그, 결재 문서 연동 정보 등을 유연하게 룰엔진과 쿼리할 수 있다. 실제 원본 파일만 **시놀로지 NAS**에 실시간 전송된다.

### 4.2 네트워크 위치 판별 및 Fallback 정책
사용자가 외부 출장지(인터넷망)에 있는지, 사내 사무실(LAN망)에 있는지 자동으로 판단하여 스토리지 엔드포인트를 라우팅한다.
1. **네트워크 탐색 (Network Probe)**: 앱 구동 시 내부 게이트웨이 주소(예: `http://192.168.1.100:8080/health`)로 가벼운 요청을 보낸다.
2. **망 판별**:
   - 통신 성공 -> **사내 LAN 모드** (직접 NAS 게이트웨이와 기가비트 전송).
   - 통신 실패 -> **원격/인터넷 모드** (NAS의 외부 도메인 또는 설정에 따라 외부 접속망 활용). 외부 접속이 아예 차단된 환경일 경우 임시로 **Firebase Storage로 우회 적재**하도록 Fallback 기능을 지원한다.

---

## 5. 데이터 모델

### 5.1 `gwDocuments` — 문서관리 메타데이터 (Firestore)
`src/domain/gwDocument/schema.ts` (신규)

| 필드 | 타입 | 필수 여부 | 설명 |
|---|---|---|---|
| `id` | string (PK) | 필수 | 문서/파일 고유 식별 ID |
| `name` | string | 필수 | 실제 파일명 (예: `2026_A라인_도면.dwg`) |
| `size` | number | 필수 | 파일 크기 (Bytes) |
| `mimeType` | string | 필수 | 파일 형식 (MIME Type) |
| `storageProvider` | enum `'firebase'\|'nas'` | 필수 | 실제 바이너리가 저장된 위치 |
| `nasPath` | string \| null | 조건부 | NAS 내부의 논리적 상대 경로 (예: `/design/2026/A_line.dwg`) |
| `fbUrl` | string \| null | 조건부 | Firebase Storage 저장 시 다운로드 URL |
| `folderId` | string \| null | 필수 | 소속 폴더 ID (최상위 루트일 경우 `null`) |
| `creatorId` | string | 필수 | 업로더 `users.id` |
| `createdAt` | string (ISO) | 필수 | 업로드 일시 |
| `updatedAt` | string (ISO) | 필수 | 수정 일시 |
| `isDeleted` | boolean | 필수 | 삭제 여부 (Soft delete 처리) |

### 5.2 `gwFolders` — 가상 폴더 트리 구조 (Firestore)
물리적인 NAS 폴더 경로에 구애받지 않고 가상 디렉토리 구조를 구성하여 파일 접근 제어 및 변경을 손쉽게 한다.
`src/domain/gwFolder/schema.ts` (신규)

| 필드 | 타입 | 필수 여부 | 설명 |
|---|---|---|---|
| `id` | string (PK) | 필수 | 폴더 고유 식별 ID |
| `name` | string | 필수 | 폴더 표시명 (예: `기계설계팀 도면함`) |
| `parentId` | string \| null | 필수 | 상위 폴더 ID (최상위 폴더는 `null`) |
| `path` | string | 필수 | 상위 계층 구조 캐싱용 경로 (예: `/root/fld_01/fld_02`) |
| `creatorId` | string | 필수 | 생성자 `users.id` |
| `createdAt` | string (ISO) | 필수 | 폴더 생성 일시 |
| `isDeleted` | boolean | 필수 | 삭제 여부 |

---

## 6. 계층 설계 및 소스 구조

### 6.1 스토리지 인터페이스 추상화
다양한 스토리지 백엔드(Firebase Storage, Local NAS, Azure 등)를 유연하게 지원하기 위해 코어 레이어에 `StorageService` 인터페이스를 설계한다.

```ts
// src/services/storage/StorageService.ts (신규)
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface StorageService {
  uploadFile(
    file: File,
    path: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ storageProvider: 'firebase' | 'nas'; path: string; downloadUrl?: string }>;

  downloadFile(path: string): Promise<Blob>;
  
  deleteFile(path: string): Promise<void>;

  getPreviewUrl(path: string): Promise<string>;
}
```

### 6.2 신규 소스코드 구조 및 역할

```
src/
├── domain/
│   ├── gwDocument/
│   │   └── schema.ts           — 문서 메타데이터 검증 스키마 (Zod)
│   └── gwFolder/
│       └── schema.ts           — 가상 폴더 검증 스키마 (Zod)
├── data/
│   ├── gwDocument/
│   │   └── gwDocument.repo.ts  — Firestore 문서 CRUD 및 NAS 게이트웨이 연계
│   └── gwFolder/
│       └── gwFolder.repo.ts    — 가상 폴더 트리 구조 처리 리포지토리
├── services/
│   └── storage/
│       ├── StorageService.ts   — 스토리지 공통 추상 인터페이스
│       ├── FirebaseStorage.ts  — Firebase Storage 전용 어댑터
│       ├── SynologyNasStorage.ts — Synology NAS Gateway 전용 어댑터
│       └── StorageFactory.ts   — 네트워크 탐색 후 적절한 스토리지 인스턴스 반환
├── features/
│   └── gw/
│       ├── useDocuments.ts     — 문서 조회/업로드/삭제 React Query 훅
│       └── useFolders.ts       — 폴더 조회/생성/삭제 React Query 훅
└── modules/
    └── gw/
        └── document/
            ├── DocumentScreen.tsx  — 문서관리 메 메인 화면 (마스터-디테일)
            ├── FolderTree.tsx      — 좌측 네비게이션 가상 폴더 트리 컴포넌트
            ├── FileList.tsx        — 선택된 폴더 내 파일 그리드/리스트 뷰
            ├── FileUploadModal.tsx — 파일 업로드 모달 및 드래그앤드롭 영역
            └── FilePreviewPanel.tsx— 우측 상세 정보 패널 및 실시간 뷰어 (이미지/PDF)
```

---

## 7. UI/UX 화면 설계 (기존 디자인 언어 준수)

기존 Workfit Office의 마스터-디테일 디자인 패턴(`_gw.tsx`의 카드와 레이아웃 컴포넌트들)을 계승하여 화면을 설계한다.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  문서관리 (Document Management)                                                        │
├─────────────────────────┬──────────────────────────────────────────────────────────────┤
│  [+ 폴더 생성]          │  [홈] > [도면함] > [A라인 프로젝트]                          │
│                         ├──────────────────────────────────────────────────────────────┤
│  📁 루트 폴더           │  [업로드 ↑]   [선택 삭제 🗑️]   [파일 검색... 🔍]             │
│   ├── 📁 도면함         ├──────────────────┬──────────┬──────────┬──────────────┬──────┤
│   │    └── 📁 A라인     │  파일명          │ 크기     │ 등록일   │ 등록자       │ 관리 │
│   ├── 📁 계약서         ├──────────────────┼──────────┼──────────┼──────────────┼──────┤
│   └── 📁 규정집         │  📄 A_layout.dwg │ 45.2 MB  │ 2026-07  │ 홍채원(기계) │ [⬇️] │
│                         │  📄 지시서.pdf   │  3.1 MB  │ 2026-07  │ 이대리(생산) │ [⬇️] │
│                         │                  │          │          │              │      │
│                         │                  │          │          │              │      │
│                         │                  │          │          │              │      │
│                         │                  │          │          │              │      │
└─────────────────────────┴──────────────────┴──────────┴──────────┴──────────────┴──────┘
```

1. **좌측 가상 폴더 트리**:
   - 직관적인 폴더 추가/이름변경/삭제 트리 제공.
   - 드래그앤드롭으로 폴더 간 파일 이동 기능 구현.
2. **중앙 파일 리스트**:
   - 업로드 버튼을 통한 멀티 파일 업로드 지원.
   - 대용량 파일 전송 시 진행률 바(Progress Bar) 노출 및 전송 속도(MB/s) 실시간 표시.
   - 파일 확장자별 아이콘 자동 할당.
3. **업로드 프로그레스 및 취소**:
   - 대용량 전송 중에 사용자가 전송을 안전하게 중단(Abort)할 수 있는 `AbortController` 연동 버튼 마련.

---

## 8. 단계별 개발 로드맵

시놀로지 NAS의 인프라 준비와 프론트엔드 연동을 안정적으로 진행하기 위해 4단계로 나누어 추진한다.

1. **Phase 1: 온프레미스 게이트웨이 배포 (Infra)**
   - 시놀로지 NAS DSM에 로그인하여 전용 공유폴더 `/volume1/WorkfitOffice` 생성.
   - NAS Container Manager를 통해 오픈소스 형태의 **Workfit Storage Gateway** 컨테이너 이미지 구동.
   - 게이트웨이 포트(예: `8080`) 및 CORS 도메인 허용 범위 설정.

2. **Phase 2: 프론트엔드 Storage Service 개발 (Core)**
   - `src/services/storage/` 디렉토리에 인터페이스 및 구체 클래스 구현.
   - `axios` 또는 `fetch` API의 `onUploadProgress` 콜백을 연계한 속도 및 진행도 추출부 작성.
   - 망 상태 체크(Network Probe) 모듈 설계.

3. **Phase 3: Firestore 스키마 및 리포지토리 완성 (Data)**
   - `gwDocuments`와 `gwFolders` 컬렉션 스키마 정의 및 Zod 파싱 규칙 작성.
   - 시드(seed) 데이터 및 Firestore Rules 권한 검증 룰 추가.

4. **Phase 4: 문서관리 화면 구현 및 기능 통합 (UI)**
   - `DocumentScreen.tsx` 메인 뷰 개발.
   - 파일 드래그앤드롭 박스 구현 및 다중 업로드 테스트.
   - 기가비트 LAN 환경과 외부 LTE/5G 환경을 스위칭하며 파일 전송 속도 및 폴백 정상 동작 여부 검증.

---

## 9. 리스크 · 미해결 과제

| 리스크 요인 | 예상 문제점 | 완화 대책 (Mitigation) |
|---|---|---|
| **외부 원격 접속 보안** | 외부에서 NAS 게이트웨이에 접근 시 계정 인증 없는 파일 탈취 위험 | API Gateway단에 JWT 토큰 인증 필터를 적용하여, Workfit Office 로그인 세션이 유효한 사용자만 파일 접근을 승인함 |
| **대용량 파일 전송 불안정** | LAN 대역폭 초과 혹은 브라우저 탭 종료 시 파일 일부 유실 | 청크 분할 업로드(Chunked Upload) 기법을 Gateway와 연동하여 이어받기(Resumable Upload)를 지원하도록 고도화 |
| **인터넷망 격리 장비** | 폐쇄망 내부에서 Vercel(외부망)의 프론트 웹과 로컬 NAS 간 혼재 | 사내 온프레미스 서버에 Workfit Office 프론트엔드 빌드본을 내부 웹서버(Nginx 등)로 패키징하여 완전 폐쇄망 배포 옵션 제공 |
| **CORS 프리플라이트 지연** | 매번 대용량 전송 전 OPTIONS 호출로 인한 미세한 레이턴시 | `Access-Control-Max-Age` 헤더를 길게(예: 86400초) 설정하여 브라우저 CORS 캐싱 활용 |


---

## 10. 연동 시 사전 준수 및 준비 사항 (Prerequisites)

시놀로지 NAS와 Workfit Office 파일 업로드/다운로드 기능을 성공적으로 연동하기 위해 사전에 준비되어야 할 인프라 및 하드웨어/소프트웨어 요구사항 체크리스트는 다음과 같다.

### 10.1 NAS 하드웨어 및 OS 사양
- **Docker 지원 NAS 모델 (권장)**: 권장안인 API 게이트웨이(Option 3)를 Synology 내부에서 구동하기 위해 **Intel 또는 AMD x86_64 프로세서** 기반의 모델(예: + 시리즈인 DS920+, DS923+, DS1522+ 등) 및 **Container Manager (구 Docker)** 패키지가 활성화되어 있어야 한다.
- **DSM 7.0 이상**: 패키지 보안 및 최신 역방향 프록시 설정을 위해 최신 DSM OS(버전 7.0 이상)를 권장한다.

### 10.2 NAS 스토리지 및 계정 설정
- **전용 공유 폴더**: 파일을 독립적으로 저장할 수 있는 전용 공유 폴더(예: `/volume1/WorkfitOffice` 또는 `/volume1/gwDocument`)를 생성해야 한다.
- **제한된 서비스 전용 계정**: 보안상 NAS의 `admin` 계정을 연동에 사용하지 않고, 오직 해당 전용 공유 폴더에만 **읽기/쓰기(Read/Write) 권한**을 지닌 독립된 서비스 전용 계정(예: `workfit_svc`)을 신설하여 할당해야 한다.

### 10.3 네트워크 인프라 구성
- **고정 IP 설정**: 사내망 내에서 NAS의 내부 IP가 변동되는 것을 막기 위해, 공유기에서 **DHCP 고정 할당(IP 예약)** 설정을 적용하거나 NAS 네트워크 인터페이스 설정에서 **수동 고정 IP**(예: `192.168.1.100`)를 할당해야 한다.
- **방화벽 및 포트 개방**:
  - API Gateway 사용 포트 (예: TCP `8080`)
  - WebAPI/File Station 직접 연동 시 DSM 기본 HTTPS 포트 (예: TCP `5001`)
- **외부망 연결 지원 (선택 사항)**:
  - 재택근무자나 외부 현장에서 접속할 수 있도록 하려면, **시놀로지 DDNS 및 공유기 포트포워딩** 설정이 필요하거나, 사내망 **Tailscale VPN** 등을 NAS 및 개별 사용자 기기에 활성화하여 가상 프라이빗 망을 구축해야 한다.

### 10.4 어플리케이션 설정 변경사항
- **클라이언트 환경 변수**: `.env.local` 및 배포 서버(Vercel 등) 환경 변수에 아래 정보를 사전 정의해야 한다.
  ```env
  # NAS 스토리지 게이트웨이 또는 DSM WebAPI 엔드포인트 주소
  VITE_NAS_GATEWAY_URL="http://192.168.1.100:8080"
  VITE_STORAGE_PROVIDER="nas" # 'firebase' 또는 'nas' 선택 가능
  ```
- **Firebase Security Rules 업데이트**: `firestore.rules` 파일에 신규 컬렉션(`gwDocuments`, `gwFolders`)에 대한 사용자 권한 정의를 반영해야 한다.

---

## [부록] 시놀로지 DSM Reverse Proxy를 활용한 CORS 설정 가이드 (Option 1 용)

만약 추가적인 Docker 게이트웨이 서버를 띄우지 않고 시놀로지 DSM WebAPI로 직접 통신하고자 할 경우, 다음 설정을 통해 브라우저 CORS 문제를 해결해야 한다.

1. **역방향 프록시 생성**:
   - DSM [제어판] > [로그인 포털] > [고급] > [역방향 프록시]로 이동합니다.
   - 생성 버튼을 클릭하고 다음과 같이 설정합니다.
     - **소스 (Source)**: 프로토콜 `HTTPS`, 호스트 이름 `nas.yourdomain.com` (또는 로컬 도메인), 포트 `443` (외부 노출 포트)
     - **대상 (Destination)**: 프로토콜 `HTTP`, 호스트 이름 `localhost`, 포트 `5000` (DSM 기본 포트)
2. **CORS 헤더 추가**:
   - 역방향 프록시 규칙 창 내 [사용자 지정 머리글] 탭으로 이동합니다.
   - 생성 버튼을 누르고 `웹소켓` 추가 또는 수동으로 아래 헤더를 추가합니다:
     - `Access-Control-Allow-Origin`: `https://workfit-office.vercel.app` (또는 개발용 `http://localhost:5173`)
     - `Access-Control-Allow-Methods`: `GET, POST, OPTIONS, PUT, DELETE`
     - `Access-Control-Allow-Headers`: `Content-Type, X-Requested-With, Authorization`
     - `Access-Control-Allow-Credentials`: `true`
3. 이 구성을 완료하면 프론트엔드 React 앱이 브라우저 보안 제약 없이 DSM File Station API를 직호출하여 사용할 수 있습니다.
