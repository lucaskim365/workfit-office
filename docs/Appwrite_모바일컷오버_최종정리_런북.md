# 모바일 컷오버 & 최종 정리 런북 (Phase 7)

웹은 이미 Appwrite(P5). 이제 **모바일까지 Appwrite로 컷오버**하고, 과도기 인프라(듀얼 라이트 브리지·구 Cloud Functions)를 **안전한 순서로 폐기**한다. 계획서 Phase 7.

> ⚠️ **순서가 안전의 핵심**: (1) 모바일 전원 신버전 → (2) 브리지 철거 → (3) 구 함수 off → (4) Firestore 아카이브. 이 순서를 어기면 데이터 갈라짐/유실 위험.

---

## 0. 전제 (P5·P6 완료 상태)

- 웹: Appwrite 컷오버 완료, 브리지 가동 중.
- 모바일: 코드 전환 완료(`dart analyze` 0). Appwrite Platform 등록 + `--dart-define=DB_DRIVER=appwrite` 빌드 검증 필요.
- 데이터: ETL 완료 + 브리지로 웹↔모바일(Firestore) 실시간 동기 중.

---

## 1. 모바일 컷오버

### ① Appwrite Platform(모바일) 등록
Console → `workfit-intra` → Platforms:
- **Android**: `com.workfit.chat` (패키지명)
- **iOS**: 번들 ID (예: `com.workfit.chat`)
> 네이티브 앱도 플랫폼 검증 필요. 미등록 시 Appwrite 호출 거부.

### ② 신버전 빌드 (driver=appwrite)
```bash
flutter build apk   --dart-define=DB_DRIVER=appwrite --release
flutter build ipa   --dart-define=DB_DRIVER=appwrite --release
# 접속값은 appwrite_client.dart 기본값(widdyax.com/6a6bf85e.../workfit)에 내장.
# 필요 시 --dart-define=APPWRITE_ENDPOINT=... 등으로 오버라이드.
```

### ③ 배포 + **강제 업데이트** (필수)
- APK/스토어 배포.
- **최소버전 게이트(강제 업데이트)** 필수 — 구버전(Firestore) 앱이 계속 돌면 데이터가 갈라진다. 서버 설정값 또는 스토어 강제 업데이트로 구버전 접속 차단.

### ④ 모바일 전원 신버전 확인
- 텔레메트리/접속 로그로 **구버전 사용자 0** 확인 후 다음 단계로.

---

## 2. 브리지 철거 (모바일 전원 신버전 확인 후)

이제 아무도 Firestore에 쓰지 않으므로 양방향 동기 불필요.

1. **A→F 브리지 함수 비활성화/삭제** (Appwrite Function `bridge-a2f`).
2. **F→A 브리지 함수 비활성화/삭제** (Firebase 배포분).
3. 삭제 후 웹·모바일이 모두 Appwrite만 쓰는지 재확인.

> 순서 무관하나, 둘 다 내려야 함. 하나만 남으면 단방향 미러가 계속 돎(무해하나 불필요).

---

## 3. 구 Cloud Functions 비활성화

기존 Firebase 푸시 트리거는 Appwrite 푸시 함수로 대체됨 → 중복/불필요.

- `functions/index.js` 의 **`onNewChatMessage`·`onNewNotification` 비활성화**(삭제 배포 또는 트리거 해제).
  - `firebase deploy --only functions` 로 두 함수를 제거한 index.js 배포, 또는 콘솔에서 삭제.
- 확인: 채팅/결재 알림 푸시가 **Appwrite 함수 경로로만** 발송되는지(중복 없음).

---

## 4. Firestore 읽기 0 확인 → 아카이브

1. **Firestore 사용량(읽기) 모니터링** — Firebase Console → Firestore → Usage. 웹·모바일 컷오버 후 읽기가 **0 수렴**하는지 1~2주 관찰.
2. 코드 확인: 웹 features·UI는 Firestore 직접접근 0(검증 완료). 모바일도 driver=appwrite 빌드면 DB는 Appwrite.
   - 남는 Firestore 접점: **FCM(messaging)**, (웹) 자체로그인 폴백 미사용, 없음.
3. 읽기 0 확인 후 **Firestore 데이터 export 백업**(`gcloud firestore export`) → 아카이브 보관.
4. (선택) Firestore 데이터 삭제 또는 보존. **롤백 창(1~2주)** 동안은 삭제 보류 권장.

---

## 5. Firebase 축소 — FCM 전용 유지

Firestore/Functions 폐기 후에도 **FCM(Cloud Messaging)은 유지**(무료, Appwrite 푸시 함수가 FCM으로 발송).
- 유지: 웹 `messaging.ts`·`firebase.ts`(FCM 설정), `VITE_FB_*`(apiKey·messagingSenderId·VAPID). 모바일 `firebase_messaging`·`firebase_options.dart`.
- 폐기/미사용: `cloud_firestore`(모바일 pubspec에서 제거 가능), Firestore 보안규칙, `storage.rules`(이미 사문서 — Garage 사용).

---

## 6. 코드 정리 (컷오버 안정 후, 선택)

과도기 스캐폴딩을 정리해 유지보수성 향상:
- **웹 driver 폴백 제거** — 개별 6 repo(counter·chatMessage·chatRoom·notification·documentExecution·approvalDoc)와 공유 `crudBackend.ts`의 **Firestore/memory 분기 삭제**, Appwrite 단일화. `VITE_DB_DRIVER` 스위치도 제거 가능(롤백 필요 없어진 뒤).
- **모바일 driver 폴백 제거** — 각 repo의 `else { Firestore }` 브랜치 + `cloud_firestore` 의존성 제거.
- **1회성 스크립트 보관** — `scripts/{appwrite-schema,etl-firestore-to-appwrite}.ts`, `appwrite/bridge/`, `appwrite/functions/` 는 참고용으로 보관(삭제 불요).
- **Appwrite 권한 강화** — 현재 `Any` CRUD. 자체로그인 대신 Appwrite Auth 도입 후 컬렉션 권한을 role 기반으로 좁힐 것(보안 부채, 계획서 §6).

---

## 7. 최종 체크리스트

- [ ] Appwrite Platforms에 모바일(Android/iOS) 등록
- [ ] 모바일 driver=appwrite 빌드 + 실기 검증
- [ ] 모바일 배포 + 강제 업데이트 게이트
- [ ] 구버전 사용자 0 확인
- [ ] 브리지 A→F·F→A 철거
- [ ] 구 Cloud Functions(onNewChatMessage·onNewNotification) 비활성화
- [ ] Firestore 읽기 0 확인(1~2주)
- [ ] Firestore export 백업 → 아카이브
- [ ] Firebase FCM 전용 축소
- [ ] (안정 후) driver 폴백·Firestore 브랜치 코드 정리
- [ ] (운영 전) Appwrite 권한 Any → 좁히기

---

## 8. 롤백 (컷오버 직후 문제 시)

- **모바일**: 강제 업데이트 전이면 구버전 유지. 이미 배포됐으면 브리지가 아직 살아있는 한 Firestore↔Appwrite 동기되므로, 웹을 firestore로 되돌리고(P5 §4) 모바일도 구버전 롤백 배포.
- **핵심**: 브리지·구 함수는 **모바일 전원 신버전 + 안정 확인 전까지 철거하지 말 것**. 철거가 곧 되돌리기 어려운 지점.
