# WebDAV 게이트웨이 (`fileserver/`)

앱(브라우저)과 Synology WebDAV 사이의 **신뢰 경계**. 2계층 인증으로 파일을 중계한다.

```
브라우저 ──(Layer1: 앱 JWT)──▶ 게이트웨이 ──(Layer2: svc 계정 Basic/TLS)──▶ Synology WebDAV
```

- 업로드: tus(이어올리기)로 수신 → 완료 시 서버측에서 WebDAV `PUT`.
- 다운로드: JWT(헤더 또는 `?t=`) 검증 후 WebDAV `GET` 스트리밍 프록시(원본 파일명 보존).
- DSM 서비스 계정 자격증명은 **이 서버 `.env` 에만** 둔다. 앱·브라우저에 절대 노출 금지.

관련 계획: `../docs/파일서버_테스트페이지_개발_계획서.md`

## 실행

```bash
cd fileserver
npm install
cp .env.example .env      # 값 채우기 (JWT_SECRET, WEBDAV_*)
npm start                 # → http://localhost:3001
```

### A. 실제 Synology 로 (운영에 가까운 검증)
`.env` 를 실 NAS 로 설정:
```
WEBDAV_URL=https://workfit.synology.me:5006
WEBDAV_USER=svc-fileapp
WEBDAV_PASS=<실제 비밀번호>
WEBDAV_BASE=messenger-files
```
> 선행(Phase 0, NAS에서 직접): WebDAV Server 패키지 설치 · `svc-fileapp` 전용 계정(administrators 제외, `messenger-files` 공유폴더만) · TLS 인증서 · 방화벽(게이트웨이 IP만 5006 허용).

### B. 로컬 WebDAV 로 (인프라 없이 빠른 데모)
실 NAS 없이 게이트웨이만 검증할 때:
```bash
npm i webdav-server --no-save
node local-dav.mjs        # localhost:1900, Basic svc-fileapp/secret
```
`.env` 를 `WEBDAV_URL=http://localhost:1900`, `WEBDAV_USER=svc-fileapp`, `WEBDAV_PASS=secret` 로.

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/auth/token` | — | 데모 토큰 발급 `{userId,name}` → `{token}`. ⚠ 운영은 앱 백엔드가 로그인 검증 후 발급 |
| POST/PATCH/HEAD | `/api/upload` | Bearer | tus 업로드(이어올리기) |
| GET | `/api/files?roomId=` | Bearer/`?t=` | 파일 메타 목록 |
| GET | `/api/download/:id` | Bearer/`?t=` | WebDAV 스트리밍 다운로드(원본명) |
| GET | `/health` | — | 헬스체크 |

## 앱 연동

앱 `.env.local`:
```
VITE_FILE_STORE_DRIVER="nas"                 # firebase | nas
VITE_NAS_FILE_API="http://localhost:3001/api"
```
그 뒤 앱에서 `/dev/file-lab` 진입 → 업로드/다운로드 검증. (저장소 추상화: `src/data/fileStore/fileStore.repo.ts`)

> ⚠ 데모 한계: Layer 1 토큰은 자체 로그인 기반이라 진짜 Firebase Auth 가 아니다. 방 멤버십 인가(`download/:id` 의 TODO)는 메신저 연결 단계에서 완성.
