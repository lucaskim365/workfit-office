/**
 * Workfit Firebase Cloud Functions.
 *
 * [2026-08-13] Firestore→Appwrite 이관에 따라 **푸시 트리거는 Appwrite Function
 *   `push-notifications` 로 이관**됐다(코드: appwrite/functions/push-notifications/).
 *   기존 onNewChatMessage·onNewNotification 은 이중 푸시 방지를 위해 제거.
 *   Firestore 로 생성되는 메시지/알림은 아래 F→A 브리지가 Appwrite 로 미러하고,
 *   Appwrite 의 push-notifications 함수가 단일 발송한다.
 *
 * 현재 이 코드베이스는 **듀얼 라이트 브리지 [F→A]** 만 배포한다(Phase 4).
 *   모바일 컷오버(Phase 7) 후 브리지째 폐기 예정.
 *
 * 리전: asia-northeast3(서울). 런타임: Node.js 22.
 */
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

// ── 듀얼 라이트 브리지 [F→A] (Phase 4) ──
// Firestore 공유 컬렉션 write → Appwrite 미러. 콘텐츠 비교로 에코 방지.
// env(functions/.env): APPWRITE_ENDPOINT · APPWRITE_PROJECT_ID · APPWRITE_API_KEY · APPWRITE_DATABASE_ID
Object.assign(exports, require("./bridge"));
