/* Workfit 메신저 PWA — FCM 백그라운드 푸시 서비스워커.
 * 서비스워커는 ES 모듈/환경변수를 못 쓰므로 compat SDK + 클라이언트 설정을 직접 사용한다.
 * (클라이언트 Firebase 설정은 앱 번들에도 노출되는 공개 값) */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCnYjXcWwbwl4ETLBtwfk0G79zsn02ofWE',
  authDomain: 'workfit-office-app.firebaseapp.com',
  projectId: 'workfit-office-app',
  storageBucket: 'workfit-office-app.firebasestorage.app',
  messagingSenderId: '34440992629',
  appId: '1:34440992629:web:3f1d6ea4a3e14c5780653c',
});

const messaging = firebase.messaging();

// 백그라운드/종료 상태 수신 → 알림 표시.
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || data.title || '새 알림', {
    body: n.body || data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,
    tag: data.roomId || data.docId || undefined,
    // 사용자가 닫기 전까지 유지(데스크톱). 기본은 몇 초 후 자동 소멸.
    requireInteraction: true,
    renotify: Boolean(data.roomId || data.docId),
  });
});

// 기기 모드(desktop/pwa) 저장 — 열린 창이 없는 "콜드 클릭"의 목적지를 정한다.
// 페이지(messaging.ts)가 토큰 등록 시 postMessage('workfit-mode') 로 알려준다.
let clientMode = null;
self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'workfit-mode' && d.mode) {
    clientMode = d.mode;
    event.waitUntil(caches.open('workfit-meta').then((c) => c.put('/mode', new Response(d.mode))));
  }
});
async function getClientMode() {
  if (clientMode) return clientMode;
  try {
    const c = await caches.open('workfit-meta');
    const r = await c.match('/mode');
    if (r) return (await r.text()) || 'pwa';
  } catch (e) {
    /* noop */
  }
  return 'pwa'; // 기본: 설치형 PWA(start_url=/m)
}

// 알림 탭 → 창 종류별 처리. 데스크톱은 /m 으로 보내지 않고 그 창에서(도크/결재) 처리한다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const focusable = list.filter((c) => 'focus' in c);
      const desktop = focusable.find((c) => !c.url.includes('/m'));
      const pwa = focusable.find((c) => c.url.includes('/m'));

      // 1) 데스크톱 창이 열려 있으면: 라우트 이동 없이 그 창에서 처리.
      if (desktop) {
        if (data.roomId) {
          desktop.postMessage({ type: 'workfit-open-chat', roomId: data.roomId });
        } else if (data.linkUrl) {
          desktop.navigate(data.linkUrl);
        }
        return desktop.focus();
      }

      // 2) PWA 창이 열려 있으면: /m 딥링크로 이동.
      if (pwa) {
        let target = '/m';
        if (data.roomId) {
          target = `/m/room/${data.roomId}`;
        } else if (data.docId) {
          target = `/m/approval/${data.docId}`;
        } else if (data.linkUrl) {
          target = data.linkUrl.replace(/^\/gw/, '/m');
        }
        pwa.navigate(target);
        return pwa.focus();
      }

      // 3) 열린 창 없음(콜드): 기기 모드에 맞춰 새 창.
      const mode = await getClientMode();
      let fallback = '/';
      if (mode === 'desktop') {
        if (data.roomId) {
          fallback = `/?openChat=${encodeURIComponent(data.roomId)}`;
        } else if (data.linkUrl) {
          fallback = data.linkUrl;
        }
      } else {
        fallback = '/m';
        if (data.roomId) {
          fallback = `/m/room/${data.roomId}`;
        } else if (data.docId) {
          fallback = `/m/approval/${data.docId}`;
        } else if (data.linkUrl) {
          fallback = data.linkUrl.replace(/^\/gw/, '/m');
        }
      }
      return self.clients.openWindow(fallback);
    })(),
  );
});
