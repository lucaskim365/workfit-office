import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { Functions } from 'appwrite';
import { app, isFirebaseConfigured } from './firebase';
import { client as appwriteClient } from './appwrite';
import { userRepo } from '@/data/user/user.repo';

/**
 * FCM 웹 푸시(PWA) — 알림 권한/토큰/수신.
 * iOS 16.4+ 는 "홈 화면에 추가"한 PWA 에서만 동작. Android/데스크톱은 브라우저에서도 동작.
 * VAPID 키(Web Push 인증서 공개키)는 Firebase 콘솔에서 발급 → VITE_FB_VAPID_KEY 로 주입.
 */
const VAPID_KEY = import.meta.env.VITE_FB_VAPID_KEY as string | undefined;

let _messaging: Messaging | null = null;
async function getMsg(): Promise<Messaging | null> {
  if (!isFirebaseConfigured || !app) return null;
  try {
    if (!(await isSupported())) return null;
  } catch {
    return null;
  }
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

/**
 * 현재 창이 데스크톱 셸인지 모바일 PWA(/m)인지 SW에 알린다.
 * SW 는 알림 클릭 시 "열린 창이 없을 때"(콜드) 목적지(데스크톱 홈 vs /m)를 이 값으로 정한다.
 */
function signalClientMode(swReg: ServiceWorkerRegistration): void {
  try {
    const mode = window.location.pathname.startsWith('/m') ? 'pwa' : 'desktop';
    (navigator.serviceWorker.controller ?? swReg.active)?.postMessage({ type: 'workfit-mode', mode });
  } catch {
    /* noop */
  }
}

/** 이 브라우저/기기에서 웹푸시가 가능한 환경인가(+VAPID 설정 여부). */
export function isPushConfigured(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    !!VAPID_KEY
  );
}

/** 현재 알림 권한 상태. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** 이 기기의 마지막 토큰 — 로그아웃할 때 내 기기 목록에서 빼는 데 쓴다. */
const DEVICE_TOKEN_KEY = 'workfit.fcm-token';
function rememberDeviceToken(token: string): void {
  try { localStorage.setItem(DEVICE_TOKEN_KEY, token); } catch { /* 저장 제한 환경 */ }
}

/**
 * 로그아웃 — 이 기기 토큰을 그 계정의 기기 목록에서 뺀다(로그아웃한 기기로 알림이 가지 않게).
 * 실패해도 로그아웃은 막지 않는다.
 */
export async function releasePushTokenOnSignOut(userId: string): Promise<void> {
  let token = '';
  try { token = localStorage.getItem(DEVICE_TOKEN_KEY) ?? ''; } catch { return; }
  if (!userId || !token) return;
  try { await userRepo.removeFcmToken(userId, token); }
  catch (e) { console.warn('[push] 로그아웃 기기 토큰 정리 실패', e); }
}

/**
 * 아이폰·아이패드인가 — 이 기기는 회수 신호(보이지 않는 푸시)를 받지 않게 한다(domain/user/pushTokens withRecallToken).
 * 아이패드는 데스크톱 사파리처럼 'Macintosh' 로 나오므로 터치 지원으로 가른다.
 */
function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * 이 기기가 회수 신호를 받아도 되는가 — 휴대폰 화면(/m)이고 아이폰이 아닐 때(=안드로이드).
 * PC 화면은 알림이 5초 뒤 스스로 닫혀(서비스워커) 회수할 필요가 없다.
 */
function acceptsRecall(): boolean {
  return window.location.pathname.startsWith('/m') && !isAppleMobile();
}

/** 서버 푸시 함수(appwrite/functions/push-notifications) */
const PUSH_FUNCTION_ID = 'push-notifications';
/** 회수 신호 종류 — 서비스워커(public/firebase-messaging-sw.js)·서버 함수와 같은 값 */
const RECALL_CHAT = 'recall-chat';

/**
 * 회수 요청을 모아 보내는 시간. 방을 열어 둔 채 대화하면 메시지마다 읽음 처리가 되는데, 그때마다 회수하면
 * 휴대폰에 '알림 없는 푸시'가 쌓여 크롬이 "백그라운드에서 업데이트됨" 알림을 띄울 수 있다.
 * 마지막으로 읽고 RECALL_QUIET_MS 동안 새로 읽은 게 없으면 보내고, 계속 대화 중이어도 RECALL_MAX_WAIT_MS 안에는 보낸다.
 */
const RECALL_QUIET_MS = 3_000;
const RECALL_MAX_WAIT_MS = 15_000;
const pendingRecalls = new Map<string, { readUpTo: string; firstAt: number; timer: ReturnType<typeof setTimeout> }>();

/**
 * 이 기기에서 대화방을 readUpTo(메시지 시각)까지 읽었으니, 내 안드로이드 휴대폰의 그 방 알림을 닫아 달라고
 * 서버에 알린다(모아서 보낸다). 실패해도 읽음 처리에는 영향이 없다(알림이 남을 뿐).
 */
export function requestChatNotificationRecall(roomId: string, readUpTo: string): void {
  if (!appwriteClient || !roomId || !readUpTo) return;
  const client = appwriteClient;
  const prev = pendingRecalls.get(roomId);
  if (prev) clearTimeout(prev.timer);
  const firstAt = prev?.firstAt ?? Date.now();
  const latest = prev && prev.readUpTo > readUpTo ? prev.readUpTo : readUpTo;
  const delay = Math.max(0, Math.min(RECALL_QUIET_MS, firstAt + RECALL_MAX_WAIT_MS - Date.now()));
  const timer = setTimeout(() => {
    pendingRecalls.delete(roomId);
    let exceptToken = '';
    try { exceptToken = localStorage.getItem(DEVICE_TOKEN_KEY) ?? ''; } catch { /* 저장 제한 환경 */ }
    new Functions(client)
      .createExecution(PUSH_FUNCTION_ID, JSON.stringify({ type: RECALL_CHAT, roomId, readUpTo: latest, exceptToken }), true)
      .catch((e) => console.warn('[push] 알림 회수 요청 실패', e));
  }, delay);
  pendingRecalls.set(roomId, { readUpTo: latest, firstAt, timer });
}

/** 이 화면이 아는 방별 '어디까지 읽었나'(메시지 시각) — 이미 읽은 메시지의 알림을 화면이 새로 띄우지 않게 */
const readUpToByRoom = new Map<string, string>();

/**
 * 그 방을 readUpTo(메시지 시각)까지 읽었다 — 이 기기의 그 방 알림 중 그 시각까지의 것을 닫는다.
 * 서비스워커가 기록해 두므로 그 뒤 늦게 도착한 같은 메시지의 알림도 띄우지 않는다(public/firebase-messaging-sw.js recallChat).
 */
export function closeChatNotificationsUpTo(roomId: string, readUpTo: string): void {
  if (!roomId || !readUpTo || readUpTo <= (readUpToByRoom.get(roomId) ?? '')) return;
  readUpToByRoom.set(roomId, readUpTo);
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: 'workfit-recall-chat', roomId, readUpTo }))
    .catch((e) => console.warn('[push] 읽은 방 알림 닫기 실패', e));
}

/** 이 메시지를 이미 읽은 것으로 알고 있나(closeChatNotificationsUpTo 로 받은 값 기준) */
export function isChatMessageReadHere(roomId: string | undefined, at: string | undefined): boolean {
  return Boolean(roomId && at && at <= (readUpToByRoom.get(roomId) ?? ''));
}

/**
 * 이 기기에 떠 있는 대화방 알림 중 이미 읽은 방(안 읽은 메시지 0)의 알림을 닫는다.
 * fetchedAt: 안 읽은 수를 받은 시각 — 그 뒤에 뜬 알림(shownAt)은 그 수에 아직 안 잡혔을 수 있어 건드리지 않는다.
 * 아이폰은 회수 신호를 받지 않으므로, 앱이 화면에 있거나 돌아올 때 이걸로 정리한다.
 * 돌려주는 값: 그렇게 건드리지 않고 넘긴 알림 수 — 0보다 크면 호출부가 안 읽은 수를 다시 받아 한 번 더 부른다
 * (다른 기기에 방을 열어 두면 알림보다 읽음 처리가 먼저 끝나, 다시 받지 않으면 알림이 남는다).
 */
export async function closeReadChatNotifications(unread: Record<string, number>, fetchedAt: number): Promise<number> {
  let deferred = 0;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return deferred;
  try {
    // 등록이 여럿일 수 있다(예전 방식으로 만든 등록이 남은 기기) — 모두 뒤진다
    let shown = 0;
    let closed = 0;
    for (const reg of await navigator.serviceWorker.getRegistrations()) {
      if (!reg.getNotifications) continue;
      for (const n of await reg.getNotifications()) {
        shown += 1;
        const data = n.data as { roomId?: string; shownAt?: number } | null;
        // 방 ID 는 알림 data 에, 없으면 tag(대화 알림은 tag = 방 ID, 'RM-' 로 시작)로 — 결재 등 다른 알림은 건드리지 않는다
        const roomId = data?.roomId || (n.tag?.startsWith('RM-') ? n.tag : '');
        if (!roomId || (unread[roomId] ?? 0) > 0) continue;
        if (typeof data?.shownAt === 'number' && data.shownAt >= fetchedAt) {
          deferred += 1;
          continue;
        }
        n.close();
        closed += 1;
      }
    }
    // 휴대폰을 PC 크롬(chrome://inspect)에 연결해 볼 때 원인을 가릴 수 있게 남긴다
    if (shown > 0) console.info(`[push] 읽은 방 알림 정리: 떠 있는 알림 ${shown}개 중 ${closed}개 닫음, ${deferred}개는 다시 확인`);
  } catch (e) {
    console.warn('[push] 읽은 방 알림 정리 실패', e);
  }
  return deferred;
}

async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' });
  // 화면을 다시 열지 않아도 최신 표시 코드를 설치한다. 실패해도 기존 푸시는 유지한다.
  try { await registration.update(); }
  catch (error) { console.warn('[push] 서비스워커 업데이트 확인 실패', error); }
  await navigator.serviceWorker.ready;
  return registration;
}

/**
 * 알림 권한 요청 + FCM 토큰 발급 + users.fcmToken 저장.
 * 성공 시 토큰, 실패/미지원/거부 시 null. (반드시 사용자 제스처에서 호출 — 특히 iOS)
 */
export async function enablePushForUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!VAPID_KEY) return { ok: false, error: 'VAPID 키(VITE_FB_VAPID_KEY) 미설정' };
  const msg = await getMsg();
  if (!msg) return { ok: false, error: '이 브라우저는 웹 푸시 미지원(iOS는 홈 화면 추가 후)' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, error: `알림 권한: ${permission}` };

    const swReg = await registerPushServiceWorker();
    signalClientMode(swReg);
    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return { ok: false, error: '토큰 발급 실패(null)' };

    await userRepo.updateFcmToken(userId, token, acceptsRecall());
    rememberDeviceToken(token);
    console.log('[push] 토큰 저장 완료', token.slice(0, 20) + '…');
    return { ok: true };
  } catch (e) {
    console.error('[push] 활성화 실패', e);
    return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

/**
 * 권한이 이미 허용된 기기에서 토큰을 조용히 재발급/저장(권한 팝업 없음).
 * 로그인 직후 앱 루트에서 호출 → 채팅 화면을 열지 않아도 결재 등 푸시를 받는다.
 * 권한이 아직 'default'/'denied' 면 아무 것도 하지 않는다(최초 허용은 사용자
 * 제스처의 enablePushForUser 로 처리 — 특히 iOS).
 */
export async function syncPushToken(userId: string): Promise<void> {
  if (!userId || !VAPID_KEY) return;
  if (!isPushConfigured() || Notification.permission !== 'granted') return;
  const msg = await getMsg();
  if (!msg) return;
  try {
    const swReg = await registerPushServiceWorker();
    signalClientMode(swReg);
    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (token) {
      await userRepo.updateFcmToken(userId, token, acceptsRecall());
      rememberDeviceToken(token);
    }
  } catch (e) {
    console.warn('[push] 토큰 동기화 실패', e);
  }
}

/** 포그라운드(앱 사용 중) 수신 payload — 타입별 딥링크에 필요한 필드 포함. */
export interface ForegroundPushPayload {
  title: string;
  body: string;
  type?: string;
  roomId?: string;
  docId?: string;
  linkUrl?: string;
  /** 대화 메시지 시각 — 알림 data 에 실어 회수 신호(readUpTo)와 비교한다 */
  at?: string;
}

/** 포그라운드(앱 사용 중) 수신 콜백 등록. */
export async function onForegroundMessage(
  cb: (payload: ForegroundPushPayload) => void,
): Promise<void> {
  const msg = await getMsg();
  if (!msg) return;
  onMessage(msg, (payload) => {
    const n = payload.notification ?? {};
    const d = payload.data ?? {};
    // 회수 신호는 새 알림이 아니다 — 서비스워커에 넘겨 백그라운드 때와 같은 규칙으로 닫는다
    if (d.type === RECALL_CHAT) {
      if (d.roomId && d.readUpTo) closeChatNotificationsUpTo(d.roomId, d.readUpTo);
      return;
    }
    cb({
      title: n.title ?? d.title ?? '새 알림',
      body: n.body ?? d.body ?? '',
      type: d.type,
      roomId: d.roomId,
      docId: d.docId,
      linkUrl: d.linkUrl,
      at: d.at,
    });
  });
}
