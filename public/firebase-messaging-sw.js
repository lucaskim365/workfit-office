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
  });
});

// 알림 탭 → 타입별 딥링크(결재 문서 / 대화방)로 이동.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const isApproval = data.type === '결재';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (!('focus' in client)) continue;
        // 이미 열린 창이 있으면 그 창 종류(PWA /m vs 데스크톱)에 맞춰 이동.
        const inPwa = client.url.includes('/m');
        let target;
        if (isApproval) {
          target = inPwa ? `/m/approval/${data.docId || ''}` : (data.linkUrl || '/gw/approval');
        } else {
          target = data.roomId ? `/m/room/${data.roomId}` : '/m';
        }
        client.navigate(target);
        return client.focus();
      }
      // 열린 창이 없으면 새 창. 결재는 데스크톱 결재 화면, 메신저는 PWA.
      const fallback = isApproval ? (data.linkUrl || '/gw/approval') : '/m';
      return self.clients.openWindow(fallback);
    }),
  );
});
