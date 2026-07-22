# Firestore 시드 데이터 적재 가이드

> 갱신: 2026-06-24
> 대상: WorkFit MES 플랫폼 (`/Users/lucaskim/Developer/Work/DemoMes_v0`)
> 관련: [[데이터_계층_구현현황.md]] · 시드 러너 `scripts/seed-firestore.ts` (`npm run seed`)

데이터 계층 118개 컬렉션(시드 685건)을 실제 Firestore(named DB)에 적재하는 절차.

---

## 요약 — 3단계 중 남은 건 ②뿐

| 단계 | 상태(2026-06-24 기준) |
|---|---|
| ① `firebase login` | ✅ 완료 (xeran75@gmail.com) |
| ② 서비스 계정 키 받기 | ❌ **이것만 하면 됨** (`service-account.json` 없음) |
| ③ `npm run seed` | ⏳ 키 받은 후 실행 |
| firebase-admin · projectId · dbId · gitignore | ✅ 모두 준비됨 |

- 프로젝트: `gen-lang-client-0703198317`
- named DB: `ai-studio-52b2c1bc-c56f-44cc-bc03-1f2700c1bfe0` (`(default)` 아님)

---

## ① firebase login — 이미 완료 (참고용)

```bash
firebase login
```

- 용도: **CLI/MCP가 프로젝트를 조회·배포**할 때 쓰는 인증.
- 이미 로그인돼 있으므로 건너뜀.

> ⚠️ **firebase login과 시드는 별개 인증.** 로그인은 CLI용, 시드 러너는 **서비스 계정 키**를 따로 쓴다(②). 로그인했다고 시드가 바로 되는 게 아니다.

---

## ② 서비스 계정 키 받기 (유일하게 남은 작업)

### 왜 필요한가
시드 러너는 **firebase-admin SDK**로 동작한다. Admin SDK는 보안 룰을 **우회**하고 서버 권한으로 직접 쓰므로, 브라우저 로그인이 아니라 **서버용 자격증명(서비스 계정 키)**이 필요하다. (룰이 막아도 685건을 한 번에 적재 가능)

### 콘솔에서 받는 경로
1. **https://console.firebase.google.com** → 프로젝트 **`gen-lang-client-0703198317`** 선택
2. 좌측 상단 **⚙️(톱니) → 프로젝트 설정(Project settings)**
3. 상단 탭 **서비스 계정(Service accounts)**
4. **새 비공개 키 생성(Generate new private key)** → 팝업에서 **키 생성** → JSON 다운로드
5. 그 파일을 **프로젝트 루트에 `service-account.json` 이름으로** 저장:
   ```
   /Users/lucaskim/Developer/Work/DemoMes_v0/service-account.json
   ```
   예:
   ```bash
   mv ~/Downloads/gen-lang-client-*.json /Users/lucaskim/Developer/Work/DemoMes_v0/service-account.json
   ```

> 🔒 **보안**: 이 키는 **DB 전체 권한**을 가진 비밀이다. `.gitignore`에 `service-account.json`이 이미 등록돼 있어 커밋되지 않는다. 절대 공유·커밋 금지.

> 대안(파일명 안 바꾸고 싶을 때): 환경변수로 경로 지정 —
> ```bash
> GOOGLE_APPLICATION_CREDENTIALS="/경로/키.json" npm run seed
> ```

---

## ③ npm run seed — 적재 실행

### 먼저 dry-run (키 없이도 됨, 권장)
```bash
npm run seed -- --dry
```
→ Firestore 접근 없이 **118컬렉션 685건** 카운트만 검증.

### 실제 적재
```bash
npm run seed
```
출력 예:
```
시드 118개 컬렉션 · 문서 685건
타깃: project=gen-lang-client-0703198317 db=ai-studio-52b2c1bc-...
  ✔ items            6건
  ✔ vendors          6건
  ...
  ✔ sysAdmins        6건
완료.
```

### 러너가 자동 처리하는 것
- **named DB 타깃팅**: `.env.local`의 `VITE_FB_FIRESTORE_DB_ID`(`ai-studio-…`)를 읽어 `(default)`가 아닌 named DB에 쓴다.
- **배치 쓰기**: 450건씩 묶어 commit (Firestore batch 한도 500 대응).
- **문서 ID = 자연키**(code/no/lot 등) → **재실행해도 upsert라 중복 안 생김**(idempotent). 시드를 고치고 다시 돌려도 안전.

---

## ④ 적재 확인

- **콘솔**: Firestore Database → 데이터 탭 → DB 드롭다운을 `ai-studio-…`로 선택 → `items`·`equipments`·`inspections` 등 컬렉션 생성 확인.
- 또는 Firebase MCP `firebase_read_resources` 등으로 검증.

---

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `서비스 계정 키를 찾을 수 없습니다` | `service-account.json` 위치/이름 확인, 또는 `GOOGLE_APPLICATION_CREDENTIALS` 경로 지정 |
| `VITE_FB_PROJECT_ID 를 찾을 수 없습니다` | `.env.local`에 `VITE_FB_PROJECT_ID` 존재 확인 |
| 권한 오류(PERMISSION_DENIED) | 서비스 계정에 Firestore 쓰기 권한 필요(기본 계정은 보유). Firestore API 활성화 확인 |
| 데이터가 `(default)`에 쓰임 | `.env.local`의 `VITE_FB_FIRESTORE_DB_ID`가 named DB ID와 일치하는지 확인 |
| `tsx` 관련 오류 | `npm install`로 devDeps(tsx·firebase-admin) 설치 확인 |

---

## 부록 — 앱 로그인 화면 켜기 (시드와 무관)

실제 로그인 게이트까지 띄우려면:
1. 콘솔 **Authentication → 이메일/비밀번호 공급자 활성화** + 테스트 계정 1개 생성
2. `.env.local`에서 `VITE_AUTH_ENABLED="false"` → `"true"`
3. (Vercel 배포 시) Vercel 환경변수에도 `VITE_AUTH_ENABLED=true` 등록

> ⚠️ 자체 로그인을 쓸 경우 보안 룰은 `request.auth`를 못 보므로 개방형(화면 게이트)을 유지한다. 진짜 DB 보안이 필요하면 Cloud Function custom token + `request.auth` 룰로 후속 강화.
