# Push Notifications — Appwrite Function (배포 가이드)

Cloud Functions(`onNewChatMessage`·`onNewNotification`)를 Appwrite Function으로 이식한 것.
**FCM 발송은 유지**(무료)하고, **트리거만 Appwrite DB 이벤트**로 전환한다.
계획서 Phase 2 §5-C. 코드: `src/main.js`.

## 동작
- 트리거: Appwrite `chatMessages`/`notifications` 컬렉션에 문서 생성(create) 이벤트.
- 채팅: 방 멤버(발신자 제외)의 `fcmToken` 수집 → FCM multicast.
- 알림: 대상자 `fcmToken` → FCM 단건. 만료 토큰 자동 정리.
- **토큰 소스**: Appwrite `users` 우선 → 없으면 **Firestore `users` 폴백**(과도기). users 이관 후 자동으로 Appwrite에서 읽힘.

## 배포 전 준비물 (사용자)

### 1) FCM 서비스계정 키 발급
Firebase Console → 프로젝트 **`workfit-office-app`** → ⚙️ 프로젝트 설정 → **서비스 계정** →
**새 비공개 키 생성** → JSON 다운로드. 이 JSON 전체를 함수 env `FCM_SERVICE_ACCOUNT` 값(문자열)으로 넣는다.
- 이 서비스계정으로 **FCM 발송 + (폴백) Firestore users 조회**를 모두 처리한다.
- ⚠️ 비밀키 — Git 커밋 금지.

### 2) (선택) Appwrite API 키
함수에 **동적 키**를 켜면(x-appwrite-key 자동 주입) 불필요. 안 켜면 `databases.read` 스코프
API 키를 발급해 env `APPWRITE_API_KEY` 로 넣는다.

## 배포 방법 A — Appwrite CLI (권장)

```bash
# 1) CLI 설치 & 로그인(콘솔 계정)
npm i -g appwrite-cli
appwrite login                      # 서버: https://appwrite.widdyax.com/v1

# 2) 이 디렉토리에서 함수 푸시(appwrite.json 사용)
cd appwrite/functions/push-notifications
appwrite push function              # push-notifications 함수 생성 + 코드 배포

# 3) 환경변수 설정(콘솔 또는 CLI)
#    FCM_SERVICE_ACCOUNT = <서비스계정 JSON 전체>
#    APPWRITE_DATABASE_ID = workfit
#    (동적 키 미사용 시) APPWRITE_API_KEY = <databases.read 키>
```

`appwrite.json` 에 이벤트 트리거(create) 4종(documents/rows 표기 모두)과 스코프가 정의돼 있다.

## 배포 방법 B — 콘솔 수동
1. Console → **Functions → Create function** → Node.js 22, ID `push-notifications`.
2. **Settings → Events** 에 추가:
   - `databases.workfit.collections.chatMessages.documents.*.create`
   - `databases.workfit.collections.notifications.documents.*.create`
   - (1.9 TablesDB 표기) `databases.workfit.tables.chatMessages.rows.*.create`, `…notifications.rows.*.create`
3. **Settings → Variables**: `FCM_SERVICE_ACCOUNT`, `APPWRITE_DATABASE_ID=workfit` (+ 필요시 `APPWRITE_API_KEY`).
4. **Deployment**: 이 폴더를 tar 로 업로드하거나 Git 연동. Entrypoint `src/main.js`, Build `npm install`.
5. 동적 키 사용 시 함수 스코프에 `databases.read`, `documents.read/write` 부여.

## 검증(DoD)
- 웹에서 채팅 메시지 전송 → 다른 멤버 기기에 푸시 수신.
- 결재 알림 생성 → 대상자 기기에 푸시 수신(딥링크 `doc=` 포함).
- 함수 실행 로그에 `chat push: n/m` / `noti push → uid` 출력.

## 이관 후 정리
users repo가 Appwrite로 전환되고 토큰이 Appwrite `users.fcmToken` 에 쌓이면,
Firestore 폴백 경로는 자연히 미사용이 된다(코드 변경 불요). 최종 컷오버 시
기존 Firebase Cloud Functions(`functions/index.js`)는 **비활성화**한다(중복 발송 방지).
