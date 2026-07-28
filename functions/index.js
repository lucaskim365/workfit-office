/**
 * Workfit 사내 메신저 — 새 메시지 자동 푸시 알림.
 *
 * chatMessages 컬렉션에 새 문서가 생기면(=메시지 전송) 트리거되어,
 * 해당 방(chatRooms)의 멤버 중 보낸 사람을 제외한 수신자들의 FCM 토큰
 * (users/{id}.fcmToken)으로 푸시를 발송한다.
 *
 * 데이터 위치가 asia-northeast3(서울)이므로 함수도 동일 리전에 배포.
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
