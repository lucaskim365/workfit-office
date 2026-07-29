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
  self.registration.showNotification(n.title || data.title || '새 메시지', {
    body: n.body || data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,
    tag: data.roomId || undefined,
  });
});

// 알림 탭 → 해당 대화방으로 이동(딥링크).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const roomId = event.notification.data && event.notification.data.roomId;
  const target = roomId ? `/m/room/${roomId}` : '/m';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/m') && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
