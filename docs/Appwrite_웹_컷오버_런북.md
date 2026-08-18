# 웹 컷오버 런북 — Firestore → Appwrite (Phase 5)

프로덕션 웹(`intra.widdyax.com`, Vercel)을 **Firestore → Appwrite** 로 전환한다.
모바일은 아직 Firestore이므로 **듀얼 라이트 브리지가 가동 중**이어야 한다.
계획서 Phase 5. 롤백 안전(브리지가 양쪽을 계속 동기).

---

## 0. 현재 상태

> **✅ 이 컷오버는 완료됐다 (2026-08-18 실측 확인).** 아래 08-13 기록은 착수 시점 스냅샷이다.
>
> 운영(`intra.widdyax.com`) 배포 번들을 직접 열어 확인한 결과:
> `VITE_DB_DRIVER="appwrite"`가 빌드 시점 상수로 접혀 **firestore 분기가 코드에서 제거**됐고,
> `setEndpoint("https://appwrite.widdyax.com/v1").setProject("6a6bf85e002acb7f71d6")`,
> DB `workfit`이 구워져 있다. 즉 §1-③의 Vercel env 4종은 **이미 등록돼 있다**
> (§5 체크박스가 미체크인 것은 문서가 갱신되지 않았을 뿐이다).
>
> 후속 릴리스(업무 모듈 4종 운영 배포)는 → `업무모듈_운영배포_런북.md`

_(착수 시점, 2026-08-13)_

- 웹 코드: 보존 repo 26개 Appwrite 전환 완료(`VITE_DB_DRIVER` 스위치). 빌드 통과.
- Appwrite 데이터: ETL 968건 적재 + 정합 검증 통과. 앱이 실데이터로 동작 확인(로컬).
- 프로덕션 웹: 아직 **Firestore**(VITE_DB_DRIVER 미설정 = 기본).

---

## 1. 컷오버 전제 조건 (반드시 먼저 — 순서대로)

### ① 함수 3종 배포 (안 하면 푸시 중단·모바일 desync)
| 함수 | 경로 | 배포 | 미배포 시 |
|------|------|------|-----------|
| 푸시 | `appwrite/functions/push-notifications/` | Appwrite CLI | 웹 채팅·결재 **푸시 전면 중단** |
| 브리지 F→A | `appwrite/bridge/firestore-to-appwrite/` | `firebase deploy --only functions` | 모바일 변경이 웹에 안 옴 |
| 브리지 A→F | `appwrite/bridge/appwrite-to-firestore/` | Appwrite CLI | 웹 변경이 모바일에 안 감 |

- 함수 env: 푸시·A→F 는 `FCM_SERVICE_ACCOUNT`(공용), F→A 는 `APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID`.
- **브리지는 컷오버 전에 켜둬야** 컷오버 순간부터 양방향 동기가 유지된다.

### ② Appwrite Platform(CORS)에 프로덕션 도메인 등록
Console → `workfit-intra` → **Settings → Platforms → Add Web**:
- `intra.widdyax.com` (프로덕션)
- `*.vercel.app` (프리뷰, 필요 시)
- (이미 `localhost` 는 등록됨)
> 미등록 시 프로덕션 브라우저가 Appwrite 호출을 **CORS 차단** → 앱 먹통.

### ③ Vercel 프로덕션 환경변수 설정
Vercel → 프로젝트 `workfit-office` → Settings → Environment Variables (**Production**):
```
VITE_DB_DRIVER          = appwrite
VITE_APPWRITE_ENDPOINT  = https://appwrite.widdyax.com/v1
VITE_APPWRITE_PROJECT_ID= 6a6bf85e002acb7f71d6
VITE_APPWRITE_DATABASE_ID = workfit
```
> ⚠️ 기존 `VITE_STORAGE_*`(Garage)·`VITE_FB_*`(FCM·자체로그인용) 는 **그대로 유지**. Firebase 설정은 FCM·과도기 폴백에 계속 필요.
> ⚠️ `APPWRITE_API_KEY`(서버 비밀키)는 **Vercit에 넣지 말 것**(브라우저 번들 노출). IaC/ETL 로컬 전용.

### ④ 최종 ETL 재적재 (드리프트 반영)
컷오버 직전, 마지막 ETL 실행으로 Firestore 최신 변경을 Appwrite에 반영:
```bash
npm run etl -- --commit    # 멱등 upsert — 안전
```
> 브리지가 이미 켜져 있으면 신규분은 실시간 동기되지만, 브리지 가동 이전의 드리프트를 메우기 위해 1회 재적재 권장.

---

## 2. 컷오버 절차

1. **전제 조건 ①~④ 완료 확인**(체크리스트 아래 §5).
2. Vercel에서 **재배포**(env 반영):
   - Deployments → 최신 → **Redeploy** (또는 `git push`로 신규 배포).
   - 빌드가 `VITE_DB_DRIVER=appwrite` 로 구워졌는지 확인(§3 번들 점검).
3. 브리지 가동 유지 확인(모바일은 여전히 Firestore).
4. 컷오버 완료 — 웹 트래픽이 Appwrite로.

---

## 3. 검증 (컷오버 직후)

### 번들 점검(코드 레벨)
배포 후 프로덕션 JS 번들에 Garage 때처럼 드라이버가 구워졌는지:
```bash
curl -s https://intra.widdyax.com/ | grep -oE '/assets/index-[^"]+\.js'   # 엔트리 청크
# 그 청크에 file.widdyax.com/api/sign(Garage) 처럼 appwrite.widdyax.com/v1 이 있으면 OK
```

### 기능 점검(브라우저)
- [ ] 로그인 (users → Appwrite)
- [ ] 조직도·사용자 목록
- [ ] 전자결재 문서함(문서 상세 본문·결재선·첨부까지)
- [ ] 메신저(방·과거 메시지·전송)
- [ ] 공통코드·거래처·품목
- [ ] **푸시**: 채팅/결재 알림이 기기에 도착
- [ ] F12 콘솔 에러 0(특히 CORS·ZodError)

### 브리지 점검
- [ ] 웹에서 결재/메시지 생성 → 모바일(Firestore)에도 반영(A→F 로그 `mirror`)
- [ ] 모바일에서 변경 → 웹(Appwrite)에도 반영(F→A 로그 `mirror`)
- [ ] 함수 로그에 `skip(echo)` 정상 출력(무한루프 없음)

---

## 4. 롤백

> ## ⛔ 아래 절차는 **2026-08-17부터 무효**다. 그대로 실행하면 운영 데이터가 화면에서 사라진다.
>
> `bfd9409` "refactor(push): Firestore 폴백 제거 — Appwrite 단일 SoT로 조회 통일 (#11)"로
> 듀얼 라이트 브리지 **`bridge-a2f`가 제거**됐고 커밋 본문이 "Firestore로 향하는 런타임
> 연결이 0"이라고 명시한다. 즉 **Firestore 데이터는 그 시점에 멈춰 있다.**
>
> `VITE_DB_DRIVER`를 `firestore`로 되돌리면 앱 전체가 08-17에 정지한 스냅샷을 보게 되어,
> 그 뒤 Appwrite에 쌓인 운영 데이터가 전부 안 보인다. **이 레버를 쓰지 말 것.**
>
> **현행 롤백 = Vercel → Deployments → 직전 배포로 Instant Rollback.**
> 코드만 되돌아가고 데이터는 그대로다.

_(무효 — 브리지 가동 시절의 절차, 기록 보존용)_

~~**브리지 덕에 롤백이 안전하다.** 양쪽이 계속 동기되므로 어느 쪽으로 돌려도 데이터 정합 유지.~~

1. ~~Vercel env `VITE_DB_DRIVER = firestore` 로 변경 → **Redeploy**.~~
2. ~~웹이 다시 Firestore로. 그동안 Appwrite에 쌓인 웹 변경은 A→F 브리지가 이미 Firestore로 미러했으므로 유실 없음.~~
3. ~~필요 시 브리지는 계속 켜둬도 무방(양쪽 동기 유지).~~

---

## 5. 컷오버 준비 체크리스트

> 아래 미체크 박스는 **문서가 갱신되지 않은 것**이지 미완료라는 뜻이 아니다(2026-08-18 확인).
> 실제로는 컷오버가 끝났고, 브리지는 오히려 **제거**됐다(§4). 아래에 실측 결과를 병기한다.

- [ ] 푸시 함수 배포 + FCM_SERVICE_ACCOUNT env
- [ ] 브리지 F→A 배포 + APPWRITE_* env — **이후 제거됨(`bfd9409`)**
- [ ] 브리지 A→F 배포 + FCM_SERVICE_ACCOUNT env — **이후 제거됨(`bfd9409`)**
- [ ] Appwrite Platforms에 `intra.widdyax.com` 등록 — **사실상 완료**(운영 브라우저가 Appwrite를 읽고 있음)
- [ ] Vercel Production env 4종(VITE_DB_DRIVER·VITE_APPWRITE_*) 설정 — **✅ 완료**(§0 번들 확인)
- [ ] 최종 ETL `--commit` 실행
- [ ] (권장) Appwrite 권한 검토 — 현재 컬렉션 권한이 `Any` CRUD. 자체로그인(Appwrite Auth 미사용)이라 당장은 Any가 필요하나, **운영 보안 부채**. Firebase Auth/Appwrite Auth 도입 후 좁힐 것(계획서 §6).
- [ ] 롤백 절차 숙지(§4)

---

## 5-A. 영업 모듈 — ✅ Appwrite 전환 완료(2026-08-13)

영업 8개 repo(salesOrder·quote·shipment·receipt·taxInvoice·salesRevenue·salesCollection·accountsReceivable)도
**공유 헬퍼로 Appwrite 전환 완료**(fresh 시작 — 기존 영업 데이터는 폐기, 컬렉션만 신규 생성).
- 8개 Appwrite 컬렉션 생성 + repo 전환 + 왕복 스모크(lines JSON·한글 cust 해시키·금액 정수) 통과.
- **이제 features·UI·전 repo가 Appwrite 드라이버로 통일** — Firestore 섬 없음. (firestore-import는 개별6 repo의 드라이버 폴백뿐)

> 결과: 컷오버 후 **전 모듈이 Appwrite**. 영업은 빈 상태로 시작(폐기 데이터 미이관 — 의도된 fresh start).

---

## 6. 컷오버 후 / 최종 정리(모바일 컷오버 P7 이후)

- 모바일까지 Appwrite로 넘어가면:
  - 듀얼 라이트 브리지 F→A·A→F **비활성화/삭제**.
  - 기존 Firebase Cloud Functions(구 푸시 트리거) **비활성화**(Appwrite 푸시 함수로 대체됨).
  - Firestore 읽기 트래픽 0 확인 후 아카이브.
  - Firebase는 **FCM 전용**으로 축소 유지.
