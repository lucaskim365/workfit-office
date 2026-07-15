# 데모 실행

NAS도, Docker도, nginx도, 인증서도 필요 없습니다. 노트북에서 바로 뜹니다.

## 1. 서버

```bash
cd fileserver
npm install

export JWT_SECRET="demo-secret"
export UPLOAD_DIR=./data/uploads
export DB_DIR=./data/db
mkdir -p $UPLOAD_DIR $DB_DIR

# 데모 계정 생성 — 비밀번호가 화면에 한 번 출력됩니다
node src/adduser.js demo "데모사용자"
node src/adduser.js kim  "김철수"

npm start          # → localhost:3000
```

Windows PowerShell이면 `export` 대신:

```powershell
$env:JWT_SECRET="demo-secret"; $env:UPLOAD_DIR="./data/uploads"; $env:DB_DIR="./data/db"
```

## 2. 화면

```bash
cd fileserver/web
npm install
npm run dev        # → localhost:5173
```

Vite가 `/api`를 3000번으로 넘겨주므로 CORS는 발생하지 않습니다.

---

## 데모에서 보여줄 것

**1. 조각 격자**

큰 파일(100MB 이상)을 올리면 격자가 왼쪽부터 채워집니다. 칸 하나가 실제 5MB tus 청크입니다. 장식이 아니라 상태 표시입니다.

**2. 이어올리기 — 이게 핵심입니다**

전송 중에 `일시정지` → `이어올리기`를 눌러보세요. 채워진 칸은 그대로 남고, 멈춘 칸부터 이어집니다. 처음부터 다시 올라가지 않습니다.

더 세게 보여주려면 **브라우저 탭을 닫았다가** 다시 열고 같은 파일을 올려보세요. `tus-js-client`가 localStorage에 진행 상태를 남겨둬서 이어집니다.

서버가 오프셋을 기억한다는 건 실제로 확인했습니다:

```
청크 1 전송 (5MB)      → HTTP 204
HEAD /api/upload/{id}  → Upload-Offset: 5242880
청크 2,3 이어서 전송   → HTTP 204
원본 md5 == 다운로드 md5  ✅
```

**3. 사용자 격리**

`demo`로 파일을 올린 뒤 `kim`으로 로그인하면 목록이 비어 있습니다. 파일 ID를 그대로 복사해 URL에 넣어도 404입니다. 소유권을 경로가 아니라 DB의 `id AND owner_id` 조건으로 검사하기 때문입니다.

---

## 데모 ↔ 운영 차이

| | 데모 | 운영 |
|---|---|---|
| 다운로드 전송 | Node `sendFile` | nginx `X-Accel-Redirect` (`USE_XACCEL=true`) |
| 저장 | 로컬 `./data` | NAS 볼륨 마운트 |
| HTTPS | 없음 | Let's Encrypt |
| 외부 접근 | 없음 | 역방향 프록시 |

`USE_XACCEL` 환경변수 하나로 갈립니다. 기본값은 데모(Node 직접 전송)입니다.

Node가 500MB를 직접 흘리면 이벤트 루프를 오래 붙잡습니다. 데모에선 문제없지만 30명이 동시에 받기 시작하면 체감됩니다. 운영 전환 시 README의 nginx 설정을 적용하세요.

---

## 데모 단계에서 미리 정할 것

지금 안 정해도 되지만, 운영 전환 시점엔 답이 있어야 합니다.

**보관 기한과 쿼터.** 코드에 `USER_QUOTA` 5GB가 들어가 있지만 자동 삭제는 스케줄러 몫입니다. 30명 × 수백MB면 용량이 빠르게 찹니다. 나중에 붙이려면 이미 쌓인 파일 정리가 골칫거리가 됩니다.

**비밀번호 전달 경로.** `adduser.js`가 비밀번호를 한 번만 출력합니다. 30명에게 어떻게 전달할지 — 첫 로그인 시 변경을 강제할지 — 결정하세요. 지금은 변경 기능이 없습니다.

**퇴사자 처리.** `users.active`를 0으로 바꾸면 기존 토큰도 즉시 무력화됩니다(`verifyToken`이 DB를 재확인합니다). 다만 이걸 바꾸는 화면은 아직 없습니다. 지금은 SQL 직접 실행입니다.

---

## 운영 전환 전 체크리스트

- [ ] `JWT_SECRET`을 `openssl rand -base64 48`로 재생성 (데모 값 그대로 쓰지 않기)
- [ ] `USE_XACCEL=true` + nginx `location /protected/ { internal; }`
- [ ] DSM 전용 계정 `svc-fileapp` (administrators 제외, 폴더 하나만)
- [ ] `id svc-fileapp` 결과를 Dockerfile UID에 반영
- [ ] 공유기 443 원격관리 해제
- [ ] Let's Encrypt 인증서 (80 포트 포워딩 필요)
- [ ] 야간 정리 작업 — tus 사이드카(`{uuid}.json`)도 함께 삭제
- [ ] Hyper Backup으로 외부 저장소 백업
