# 게이트웨이를 Synology NAS에 상주시키기 (Container Manager)

맥 없이 **NAS 안에서 게이트웨이를 상시 실행**한다. NAS 내부에선 공유폴더를 직접 마운트해
파일로 쓰므로(`STORAGE_BACKEND=fs`) **WebDAV·TLS·서비스계정이 필요 없다.**

```
앱(브라우저) ──(앱 JWT)──▶ 게이트웨이(NAS 컨테이너) ──직접 쓰기──▶ /volume1/…/file-storage
```

---

## 0. 사전 준비
- DSM에 **Container Manager** 패키지 설치(패키지 센터).
- 파일 저장 공유폴더 준비: 예) `AX사업본부/file-storage` → 실제 경로 `/volume1/AX사업본부/file-storage`.
- 컨테이너 데이터용 폴더: File Station에서 `docker/workfit-fileserver/data` 생성(메타·임시조립 영속용).
- `JWT_SECRET` 생성: 터미널에서 `openssl rand -base64 48` → 결과 보관.

## 1. 게이트웨이 소스를 NAS로 올리기
File Station으로 `docker/workfit-fileserver/` 아래에 이 폴더의 다음을 업로드(또는 드래그):
- `Dockerfile`, `docker-compose.yml`, `package.json`, `package-lock.json`, `src/`
- (제외: `node_modules`, `data`, `.env`, `local-dav.mjs` — `.dockerignore`가 어차피 무시)

## 2. docker-compose.yml 값 교정
업로드한 `docker-compose.yml`을 텍스트 편집기로 열어 3곳만 수정:
- `JWT_SECRET: "CHANGE_ME"` → 0단계에서 만든 값
- `volumes` 의 `/volume1/AX사업본부/file-storage` → 실제 저장 공유폴더 경로
- `CORS_ORIGIN: "*"` → (권장) 배포 앱 도메인으로 좁히기
  예: `"https://workfit-office-git-feature-file-lab-lucas-projects-0612aa79.vercel.app,https://workfit.synology.me"`
  (`*.vercel.app` 은 코드에서 이미 허용하므로 프리뷰는 비워둬도 됨)

## 3. Container Manager에서 프로젝트 생성
1. Container Manager → **프로젝트 → 생성**.
2. 경로: 업로드한 `docker/workfit-fileserver` 폴더 선택.
3. 소스: **기존 docker-compose.yml 사용**.
4. **빌드 및 실행**. (첫 빌드 시 node 이미지 내려받아 수 분 소요)
5. 상태가 **running** 이면 성공.

## 4. 동작 확인 (LAN)
같은 네트워크 PC/폰 브라우저나 터미널에서:
```bash
curl http://<NAS_LAN_IP>:3001/health      # {"ok":true}
```
- 앱 테스트 페이지(`/dev/file-lab`) → 설정 → 드라이버 `nas`,
  게이트웨이 URL `http://<NAS_LAN_IP>:3001/api` → 저장 → 업로드.
- 파일이 `/volume1/AX사업본부/file-storage/<roomId>/…` 에 생기는지 File Station에서 확인.

> 이 단계까지면 **맥 없이, 같은 네트워크의 모든 기기**에서 됩니다.

## 5. 어디서든(인터넷·HTTPS) 되게 — DSM 역방향 프록시 (권장)
Vercel 앱은 HTTPS라, 게이트웨이도 HTTPS로 노출하면 mixed-content·터널 없이 어디서든 동작.
1. **제어판 → 로그인 포털 → 고급 → 역방향 프록시 → 생성**.
   - 소스: HTTPS / `workfit.synology.me` / 포트 `8443`(예)
   - 대상: HTTP / `localhost` / `3001`
2. **제어판 → 보안 → 인증서**: `workfit.synology.me` Let's Encrypt 인증서를 이 서비스에 매핑.
3. 확인: `curl https://workfit.synology.me:8443/health` → `{"ok":true}`.
4. 앱 게이트웨이 URL을 `https://workfit.synology.me:8443/api` 로 설정 → **폰·외부 기기·배포 앱 모두** 동작.

> tus는 5MB 청크로 나눠 올리므로 역방향 프록시 업로드 크기 제한에 잘 걸리지 않는다.

## 6. 하드닝(공개 전 필수)
- **CORS**를 앱 도메인으로 좁히기(2단계).
- `/api/auth/token` 이 지금은 **누구나 토큰 발급 가능**(데모). 공개 시 앱 백엔드 검증 후 발급하도록 제한하거나, 발급에 공유 시크릿을 요구.
- 역방향 프록시/방화벽에서 접근 IP를 제한(가능하면).
- 저장 폴더 권한: 컨테이너가 `/files`에 쓰기 가능해야 함(권한 오류 시 공유폴더 권한 조정).

## 7. 앱 쪽 설정 요약
- 배포 앱: 테스트 페이지 설정에서 게이트웨이 URL을 위 4/5단계 주소로.
- 운영(메신저 연결) 시엔 `.env`/빌드에 `VITE_NAS_FILE_API`(게이트웨이)와 `VITE_FILE_STORE_DRIVER=nas`를 지정하면 화면 설정 없이 바로 nas로 동작.

---

### 참고: 로컬(맥) WebDAV 모드와의 관계
- 맥에서 임시로 돌릴 땐 `STORAGE_BACKEND=webdav`(현재 `.env`)로 WebDAV 중계.
- NAS 상주는 `STORAGE_BACKEND=fs`로 볼륨 직접 쓰기 — 동일 코드, 환경변수만 다름.
