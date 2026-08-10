/**
 * Workfit 사내 메신저 — 새 메시지 자동 푸시 알림.
 *
 * chatMessages 컬렉션에 새 문서가 생기면(=메시지 전송) 트리거되어,
 * 해당 방(chatRooms)의 멤버 중 보낸 사람을 제외한 수신자들의 FCM 토큰
 * (users/{id}.fcmToken)으로 푸시를 발송한다.
 *
 * 데이터 위치가 asia-northeast3(서울)이므로 함수도 동일 리전에 배포.
 * 런타임: Node.js 22 (firebase.json runtime, package.json engines).
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

exports.onNewChatMessage = onDocumentCreated(
  "chatMessages/{msgId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const msg = snap.data();
    if (!msg) return;

    // 시스템 메시지(입장·초대 안내 등)는 푸시하지 않음.
    if (msg.type === "system") return;

    const roomId = msg.roomId;
    const senderId = msg.senderId || "";
    if (!roomId) return;

    const db = getFirestore();

    // 방 정보 → 멤버 목록.
    const roomDoc = await db.collection("chatRooms").doc(roomId).get();
    if (!roomDoc.exists) return;
    const room = roomDoc.data() || {};
    const members = Array.isArray(room.members) ? room.members : [];
    const roomName = room.name || "채팅방";

    // 보낸 사람 제외한 수신자.
    const recipientIds = members.filter((id) => id && id !== senderId);
    if (recipientIds.length === 0) return;

    // 수신자들의 FCM 토큰 수집.
    const tokens = [];
    await Promise.all(
      recipientIds.map(async (uid) => {
        const u = await db.collection("users").doc(uid).get();
        const token = u.exists ? (u.data() || {}).fcmToken : "";
        if (token) tokens.push(token);
      })
    );
    if (tokens.length === 0) {
      console.log(`no tokens for room ${roomId}`);
      return;
    }

    // 알림 본문 구성(타입별).
    let preview = msg.text || "";
    if (msg.type === "image") preview = "📷 사진";
    else if (msg.type === "file") preview = "📎 파일";
    const senderName = msg.senderName || "";
    const title = roomName;
    const body = senderName ? `${senderName}: ${preview}` : preview;

    const message = {
      tokens,
      notification: { title, body },
      // 앱이 알림 탭 시 방으로 딥링크하기 위한 데이터.
      data: {
        roomId: String(roomId),
        roomName: String(roomName),
        title: String(title),
        body: String(body),
      },
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    };

    const res = await getMessaging().sendEachForMulticast(message);
    console.log(
      `push: ${res.successCount}/${tokens.length} sent for room ${roomId}`
    );
  }
);

/**
 * 인앱 알림(결재 등) → 기기 푸시.
 *
 * notifications 컬렉션에 새 문서가 생기면 트리거되어, 대상자(userId)의
 * FCM 토큰(users/{id}.fcmToken)으로 푸시를 발송한다. 결재 요청/완료/반려/
 * 수신 등 모든 결재 알림이 이 컬렉션을 거치므로 여기 하나로 커버된다.
 * (메신저 푸시는 onNewChatMessage 가 chatMessages 에서 별도 처리하므로
 *  중복 발송되지 않는다.)
 */
exports.onNewNotification = onDocumentCreated(
  "notifications/{notiId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const noti = snap.data();
    if (!noti) return;

    const userId = noti.userId;
    if (!userId) return;

    const db = getFirestore();

    // 대상자의 FCM 토큰.
    const u = await db.collection("users").doc(userId).get();
    const token = u.exists ? (u.data() || {}).fcmToken : "";
    if (!token) {
      console.log(`no token for user ${userId} (noti ${event.params.notiId})`);
      return;
    }

    const type = noti.type || "시스템";
    const title = noti.title || "새 알림";
    const body = noti.text || "";

    // linkUrl 예: "/gw/approval?doc=DOC123" → 앱 딥링크용 docId 추출.
    const linkUrl = noti.linkUrl || "";
    const docMatch = /[?&]doc=([^&]+)/.exec(linkUrl);
    const docId = docMatch ? decodeURIComponent(docMatch[1]) : "";

    // 타입별 안드로이드 채널(앱에서 생성한 채널 id 와 일치해야 함).
    const channelId = type === "결재" ? "workfit_approvals" : "workfit_messages";

    const message = {
      token,
      notification: { title, body },
      // 앱이 알림 탭 시 결재 문서로 딥링크하기 위한 데이터.
      data: {
        type: String(type),
        docId: String(docId),
        linkUrl: String(linkUrl),
        title: String(title),
        body: String(body),
      },
      android: {
        priority: "high",
        notification: { channelId },
      },
      apns: { payload: { aps: { sound: "default" } } },
    };

    try {
      await getMessaging().send(message);
      console.log(`noti push sent to ${userId} (${type}) [${event.params.notiId}]`);
    } catch (e) {
      // 만료/무효 토큰이면 정리.
      const code = e && e.errorInfo && e.errorInfo.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        await db.collection("users").doc(userId).update({ fcmToken: "" });
        console.log(`cleared stale token for ${userId}`);
      } else {
        console.error(`noti push failed for ${userId}:`, e);
      }
    }
  }
);
