import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function serverFixture() {
  const sent = [];
  const context = vm.createContext({
    admin: { apps: [{}], messaging: () => ({
      sendEachForMulticast: async (payload) => {
        sent.push(payload);
        return { successCount: payload.tokens.length, responses: payload.tokens.map(() => ({ success: true })) };
      },
    }) },
  });
  const source = read('appwrite/functions/push-notifications/src/main.js')
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export default async', 'const entry = async');
  vm.runInContext(`${source}\nglobalThis.handleChat = handleChatMessage; globalThis.preview = chatPreview; globalThis.handleRecall = handleRecall;`, context);
  return { sent, context, db: {
    // Only read APIs are provided: a write during chat dispatch would fail the test.
    getDocument: async (_database, collection, id) => collection === 'chatRooms'
      ? { name: '팀 채팅', members: ['sender', 'receiver', 'no-token'] }
      : { fcmToken: id === 'receiver' ? 'receiver-token' : '' },
  } };
}

test('채팅 발송: 발신자 제외, 이름·미리보기 전달, 기존 모바일 payload와 클릭 경로 유지', async () => {
  const { context, db, sent } = serverFixture();
  await context.handleChat({ roomId: 'ROOM', senderId: 'sender', senderName: '홍길동', text: '회의\n  시작합니다', type: 'text' }, db, 'test', () => {});
  assert.equal(sent.length, 1);
  const payload = sent[0];
  assert.deepEqual(Array.from(payload.tokens), ['receiver-token']);
  assert.equal(payload.data.roomId, 'ROOM');
  assert.equal(payload.data.title, '홍길동 · 팀 채팅');
  assert.equal(payload.data.body, '회의 시작합니다');
  assert.equal(payload.android.notification.body, payload.data.body);
  assert.equal(payload.apns.payload.aps.alert.title, payload.data.title);
  // 웹 푸시(PWA)는 높은 우선순위 — 잠긴 휴대폰·절전 상태에서도 늦지 않게
  assert.equal(payload.webpush.headers.Urgency, 'high');
});

test('채팅 발송: 메시지 시각(at)을 실어 휴대폰이 회수 신호와 비교할 수 있게', async () => {
  const { context, db, sent } = serverFixture();
  await context.handleChat({ roomId: 'ROOM', senderId: 'sender', text: '안녕', type: 'text', at: '2026-10-29T10:00:00' }, db, 'test', () => {});
  assert.equal(sent[0].data.at, '2026-10-29T10:00:00');
});

test('회수: 부른 사람의 회수 가능 기기에만, 읽은 기기 자신은 빼고, 읽은 시각을 실어 보냄', async () => {
  const { context, sent } = serverFixture();
  const db = {
    getDocument: async () => ({ fcmToken: '', fcmTokens: ['android', 'iphone', 'pc', 'android-reader'], fcmTokensRecall: ['android', 'android-reader', 'removed'] }),
  };
  const result = await context.handleRecall('me', 'ROOM', '2026-10-29T10:00:00', 'android-reader', db, 'test', () => {});
  assert.equal(result.sent, 1);
  assert.deepEqual(Array.from(sent[0].tokens), ['android']);
  assert.equal(sent[0].data.type, 'recall-chat');
  assert.equal(sent[0].data.readUpTo, '2026-10-29T10:00:00');
  assert.equal(sent[0].notification, undefined);
  assert.equal((await context.handleRecall('me', 'ROOM', '', '', db, 'test', () => {})).skipped, 'no-user-room-or-time');
});

test('미리보기: 긴 내용·이모지·빈 메시지·첨부를 처리하고 시스템 메시지는 발송하지 않음', async () => {
  const { context, db, sent } = serverFixture();
  assert.equal(context.preview({ text: '😀'.repeat(81) }), '😀'.repeat(80) + '…');
  assert.equal(context.preview({ text: '  ' }), '새로운 메시지가 도착했습니다.');
  assert.equal(context.preview({ type: 'image', text: 'internal-image-url' }), '사진을 보냈습니다.');
  assert.equal(context.preview({ type: 'file', text: 'internal-file-url' }), '파일을 보냈습니다.');
  const result = await context.handleChat({ type: 'system' }, db, 'test', () => {});
  assert.equal(result.skipped, 'system');
  assert.equal(sent.length, 0);
});

function foregroundFixture(permission = 'granted', mobile = false, screen = 'desktop') {
  const source = read(screen === 'mobile' ? 'src/mobile/MobileApp.tsx' : 'src/app/App.tsx');
  const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  const walk = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes('void onForegroundMessage')) effect = node.arguments[0].getText(ast);
    ts.forEachChild(node, walk);
  };
  walk(ast);
  assert.ok(effect);
  const shown = [], callbacks = [], warnings = [], timers = [], messages = [], invalidated = [];
  const page = { visibilityState: 'visible', focused: true, hasFocus() { return this.focused; } };
  const registration = {
    active: { postMessage: (message) => messages.push(message) },
    showNotification: async (title, options) => shown.push({ title, options, data: options.data, tag: options.tag, closed: false, close() { this.closed = true; } }),
    getNotifications: async ({ tag }) => shown.filter((item) => item.tag === tag && !item.closed).slice(-1),
  };
  const context = vm.createContext({
    user: { id: 'receiver' }, isMobilePwa: mobile,
    qc: { invalidateQueries: async (filters) => { invalidated.push(filters.queryKey); } }, CHAT_UNREAD_KEY: 'chatUnread',
    document: page,
    Notification: { permission },
    navigator: { serviceWorker: { getRegistration: async () => registration } },
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    onForegroundMessage: async (callback) => { callbacks.push(callback); },
    console: { warn: (...args) => warnings.push(args) },
  });
  vm.runInContext(ts.transpileModule(read('src/shared/lib/viewedChatRoom.ts').replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  vm.runInContext(ts.transpileModule(read('src/shared/lib/transientPushNotification.ts').replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  vm.runInContext(ts.transpileModule(`(${effect})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { shown, callbacks, warnings, timers, messages, invalidated, page, context, registerRoom: context.registerViewedChatRoom };
}

test('PC·모바일: 현재 보는 방만 생략하고 다른 방·결재·일정 알림은 유지', async () => {
  for (const screen of ['desktop', 'mobile']) {
    const { registerRoom, callbacks, shown } = foregroundFixture('granted', false, screen);
    const leave = registerRoom('ROOM');
    await callbacks[0]({ roomId: 'ROOM', title: '현재 방', body: '내용' });
    assert.equal(shown.length, 0, screen);
    await callbacks[0]({ roomId: 'OTHER', title: '다른 방', body: '내용' });
    await callbacks[0]({ docId: 'DOC', title: '결재', body: '내용' });
    await callbacks[0]({ linkUrl: '/gw/calendar', title: '일정', body: '내용' });
    assert.equal(shown.length, 3, screen);
    leave();
    await callbacks[0]({ roomId: 'ROOM', title: '나간 방', body: '내용' });
    assert.equal(shown.length, 4, screen);
  }
});

test('PC·모바일: 최소화·포커스 이탈 시 다시 표시하고 복귀하면 생략', async () => {
  for (const screen of ['desktop', 'mobile']) {
    const { registerRoom, callbacks, shown, page } = foregroundFixture('granted', false, screen);
    const leave = registerRoom('ROOM');
    const payload = { roomId: 'ROOM', title: '채팅', body: '내용' };
    page.visibilityState = 'hidden';
    await callbacks[0](payload);
    page.visibilityState = 'visible';
    page.focused = false;
    await callbacks[0](payload);
    assert.equal(shown.length, 2, screen);
    page.focused = true;
    await callbacks[0](payload);
    assert.equal(shown.length, 2, screen);
    leave();
  }
});

test('패널 교체·중복 화면 정리가 다른 활성 채팅방 상태를 지우지 않음', async () => {
  const { registerRoom, callbacks, shown } = foregroundFixture();
  const leaveFirst = registerRoom('ROOM');
  const leaveSecond = registerRoom('ROOM');
  leaveFirst();
  await callbacks[0]({ roomId: 'ROOM', title: '현재 방' });
  assert.equal(shown.length, 0);
  leaveSecond();
  const leaveOther = registerRoom('OTHER');
  await callbacks[0]({ roomId: 'ROOM', title: '이전 방' });
  assert.equal(shown.length, 1);
  await callbacks[0]({ roomId: 'OTHER', title: '새 방' });
  assert.equal(shown.length, 1);
  leaveOther();
});

test('화면 연결: 목록·새 대화·알림 기록에서는 등록하지 않고 PC·모바일 퇴장 시 해제', () => {
  for (const [file, states] of [
    ['src/features/chat/desktop/MessengerPanel.tsx', [
      { isVisible: true, composing: false, openRoom: { id: 'ROOM' }, expected: true },
      { isVisible: false, composing: false, openRoom: { id: 'ROOM' }, expected: false },
      { isVisible: true, composing: true, openRoom: { id: 'ROOM' }, expected: false },
      { isVisible: true, composing: false, openRoom: null, expected: false },
    ]],
    ['src/mobile/MobileChatThread.tsx', [
      { room: { id: 'ROOM' }, expected: true }, { room: undefined, expected: false },
    ]],
  ]) {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let effect;
    const walk = node => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useLayoutEffect'
        && node.arguments[0]?.getText(ast).includes('registerViewedChatRoom')) effect = node.arguments[0].getText(ast);
      ts.forEachChild(node, walk);
    };
    walk(ast);
    assert.ok(effect, file);
    for (const state of states) {
      const { context } = foregroundFixture();
      Object.assign(context, state);
      const cleanup = vm.runInContext(ts.transpileModule(`(${effect})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
      assert.equal(context.shouldSuppressChatPopup('ROOM'), state.expected, file);
      cleanup?.();
      assert.equal(context.shouldSuppressChatPopup('ROOM'), false, file);
    }
  }
});

test('PC 활성 상태: 같은 방의 반복 메시지에도 renotify, 발신자·미리보기·클릭 데이터 유지', async () => {
  const { callbacks, shown } = foregroundFixture();
  for (const body of ['첫 메시지', '다음 메시지']) {
    await callbacks[0]({ title: '홍길동 · 팀 채팅', body, roomId: 'ROOM' });
  }
  assert.equal(shown.length, 2);
  assert.equal(shown[0].title, '홍길동 · 팀 채팅');
  assert.equal(shown[1].options.body, '다음 메시지');
  for (const notification of shown) {
    assert.equal(notification.options.renotify, true);
    assert.equal(notification.options.tag, 'ROOM');
    assert.equal(notification.options.data.roomId, 'ROOM');
  }
});

test('PC 활성 상태: 권한 차단·모바일 제외를 유지하고 일정 알림은 기존 본문과 링크 유지', async () => {
  const denied = foregroundFixture('denied');
  await denied.callbacks[0]({ title: '메시지', body: '내용', roomId: 'ROOM' });
  assert.equal(denied.shown.length, 0);
  assert.equal(foregroundFixture('granted', true).callbacks.length, 0);
  const calendar = foregroundFixture();
  await calendar.callbacks[0]({ title: '일정', body: '일정 안내', linkUrl: '/gw/calendar?date=2026-10-07' });
  assert.equal(calendar.shown[0].options.body, '일정 안내');
  assert.equal(calendar.shown[0].options.renotify, false);
  assert.equal(calendar.shown[0].options.data.linkUrl, '/gw/calendar?date=2026-10-07');
});

function backgroundFixture(mode) {
  let callback;
  const shown = [], timers = [], listeners = {}, store = new Map();
  const context = vm.createContext({
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    importScripts: () => {},
    firebase: { initializeApp: () => {}, messaging: () => ({ onBackgroundMessage: (cb) => { callback = cb; } }) },
    Response: class { constructor(body) { this.body = body; } async text() { return this.body; } },
    caches: { open: async () => ({
      match: async (key) => (store.has(key) ? { text: async () => store.get(key) } : undefined),
      put: async (key, res) => { store.set(key, await res.text()); },
    }) },
    self: {
      addEventListener: (name, listener) => { listeners[name] = listener; },
      registration: {
        showNotification: async (title, options) => shown.push({ title, options, data: options.data, tag: options.tag, closed: false, close() { this.closed = true; } }),
        getNotifications: async ({ tag } = {}) => shown.filter((item) => (tag === undefined || item.tag === tag) && !item.closed).slice(-1),
      },
    },
  });
  vm.runInContext(read('public/firebase-messaging-sw.js'), context);
  if (mode) listeners.message({ data: { type: 'workfit-mode', mode }, waitUntil: () => {} });
  return { callback, shown, timers, listeners };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('백그라운드 서비스워커(PC): 미리보기와 클릭 데이터를 유지하고 5초 뒤 닫음', async () => {
  const { callback, shown, timers } = backgroundFixture('desktop');
  const pending = callback({ data: { title: '홍길동 · 팀 채팅', body: '회의 시작합니다', roomId: 'ROOM' } });
  await flush();
  assert.equal(shown[0].title, '홍길동 · 팀 채팅');
  assert.equal(shown[0].options.body, '회의 시작합니다');
  assert.equal(shown[0].options.renotify, true);
  assert.equal(shown[0].options.data.roomId, 'ROOM');
  assert.equal(shown[0].options.requireInteraction, false);
  assert.equal(timers[0].ms, 5_000);
  assert.equal(shown[0].closed, false);
  timers[0].fn();
  await pending;
  assert.equal(shown[0].closed, true);
});

test('백그라운드 서비스워커(휴대폰): 스스로 닫지 않고 읽을 때까지 남김', async () => {
  for (const mode of ['pwa', undefined]) {
    const { callback, shown, timers } = backgroundFixture(mode);
    await callback({ data: { title: '팀 채팅', body: '내용', roomId: 'ROOM' } });
    assert.equal(timers.length, 0, String(mode));
    assert.equal(shown[0].closed, false, String(mode));
    assert.equal(typeof shown[0].data.shownAt, 'number');
  }
});

test('회수 신호: 읽은 시각까지의 그 방 알림만 닫고, 더 늦은 메시지·다른 방 알림은 남김', async () => {
  const { callback, shown } = backgroundFixture('pwa');
  await callback({ data: { roomId: 'ROOM', body: '읽은 메시지', at: '2026-10-29T10:00:00' } });
  await callback({ data: { roomId: 'OTHER', body: '다른 방', at: '2026-10-29T09:00:00' } });
  await callback({ data: { type: 'recall-chat', roomId: 'ROOM', readUpTo: '2026-10-29T10:00:00' } });
  assert.equal(shown.length, 2);
  assert.equal(shown[0].closed, true);
  assert.equal(shown[1].closed, false);
  await callback({ data: { roomId: 'ROOM', body: '새 메시지', at: '2026-10-29T10:00:05' } });
  await callback({ data: { type: 'recall-chat', roomId: 'ROOM', readUpTo: '2026-10-29T10:00:00' } });
  assert.equal(shown[2].closed, false);
});

test('회수 신호가 알림보다 먼저 와도: 이미 읽은 메시지의 알림은 띄우지 않음', async () => {
  const { callback, shown, listeners } = backgroundFixture('pwa');
  await callback({ data: { type: 'recall-chat', roomId: 'ROOM', readUpTo: '2026-10-29T10:00:00' } });
  await callback({ data: { roomId: 'ROOM', body: '읽은 메시지', at: '2026-10-29T10:00:00' } });
  assert.equal(shown.length, 0);
  // 앱이 화면에 있을 때 받은 회수 신호(페이지가 넘김)도 같은 규칙
  let pending;
  listeners.message({ data: { type: 'workfit-recall-chat', roomId: 'ROOM', readUpTo: '2026-10-29T10:00:09' }, waitUntil: (p) => { pending = p; } });
  await pending;
  await callback({ data: { roomId: 'ROOM', body: '이것도 읽음', at: '2026-10-29T10:00:09' } });
  await callback({ data: { roomId: 'ROOM', body: '안 읽은 메시지', at: '2026-10-29T10:00:10' } });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].options.body, '안 읽은 메시지');
});

test('휴대폰 포그라운드: 알림을 스스로 닫지 않고 정리 기준(at·shownAt)을 실음', async () => {
  const { callbacks, shown, timers, messages } = foregroundFixture('granted', false, 'mobile');
  await callbacks[0]({ title: '팀 채팅', body: '메시지', roomId: 'ROOM', at: '2026-10-29T10:00:00' });
  assert.equal(shown.length, 1);
  assert.equal(timers.length, 0);
  assert.equal(messages.length, 0);
  assert.equal(shown[0].data.at, '2026-10-29T10:00:00');
  assert.equal(typeof shown[0].data.shownAt, 'number');
});

test('휴대폰 포그라운드: 대화 알림을 띄운 뒤 안 읽은 수를 다시 받음(다른 기기가 먼저 읽었으면 정리되게), 결재 알림은 안 받음', async () => {
  const { callbacks, invalidated } = foregroundFixture('granted', false, 'mobile');
  await callbacks[0]({ title: '결재', body: '내용', docId: 'DOC' });
  assert.equal(invalidated.length, 0);
  await callbacks[0]({ title: '팀 채팅', body: '메시지', roomId: 'ROOM' });
  assert.equal(JSON.stringify(invalidated), JSON.stringify([['chatUnread']]));
});

test('PC 포그라운드: 5초 타이머가 같은 방의 새 알림을 닫지 않음', async () => {
  const { callbacks, shown, timers, messages } = foregroundFixture();
  await callbacks[0]({ title: '팀 채팅', body: '첫 메시지', roomId: 'ROOM' });
  await callbacks[0]({ title: '팀 채팅', body: '새 메시지', roomId: 'ROOM' });
  assert.equal(timers[0].ms, 5_000);
  assert.equal(messages[0].type, 'workfit-expire-notification');
  assert.equal(shown[0].options.requireInteraction, false);
  timers[0].fn();
  await flush();
  assert.equal(shown[1].closed, false);
  timers[1].fn();
  await flush();
  assert.equal(shown[1].closed, true);
});

test('백그라운드(PC): 이전 타이머는 새 알림을 유지하고 SW 메시지도 만료까지 기다림', async () => {
  const { callback, shown, timers, listeners } = backgroundFixture('desktop');
  const first = callback({ data: { roomId: 'ROOM', body: '첫 메시지' } });
  await flush();
  const second = callback({ data: { roomId: 'ROOM', body: '새 메시지' } });
  await flush();
  timers[0].fn();
  await first;
  assert.equal(shown[1].closed, false);
  let expiry;
  listeners.message({ data: { type: 'workfit-expire-notification', id: shown[1].data.workfitNotificationId, tag: 'ROOM' }, waitUntil: (promise) => { expiry = promise; } });
  assert.equal(timers[2].ms, 5_000);
  timers[2].fn();
  await expiry;
  assert.equal(shown[1].closed, true);
  timers[1].fn();
  await second;
});
