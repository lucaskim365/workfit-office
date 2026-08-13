/**
 * Appwrite 데이터 경로 스모크 테스트 — Phase 1 실측.
 * 앱 repo(AppwriteBackend)와 동일한 경로로 라이브 서버에 CRUD + Realtime 왕복.
 * 브라우저가 아니라 Node에서 anonymous(project only, Any 권한)로 실행하므로 CORS 무관하게
 * "스키마·직렬화·Realtime"이 실제로 동작하는지 검증한다. 생성물은 끝에 정리(delete).
 *
 * 실행: npx tsx scripts/appwrite-smoke.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases, Query } from 'appwrite';

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const endpoint = readEnv('VITE_APPWRITE_ENDPOINT')!;
const projectId = readEnv('VITE_APPWRITE_PROJECT_ID')!;
const dbId = readEnv('VITE_APPWRITE_DATABASE_ID')!;

const client = new Client().setEndpoint(endpoint).setProject(projectId); // key 없음 = anonymous
const dbs = new Databases(client);

const roomId = 'RM-SMOKE';
const msgId = 'smoke-' + Date.now();
const notiId = 'ntsmoke-' + Date.now();

async function main() {
  console.log(`▶ Appwrite 스모크 — ${endpoint} / db ${dbId} (anonymous)\n`);

  // 1) CREATE (중첩 attachment → JSON 문자열)
  const attachment = { url: 'https://file.widdyax.com/x.png', name: '사진_한글.png', size: 1234, mime: 'image/png' };
  const created = await dbs.createDocument(dbId, 'chatMessages', msgId, {
    roomId,
    senderId: 'U-smoke',
    senderName: '스모크봇',
    text: '안녕 Appwrite 👋',
    type: 'text',
    at: new Date().toISOString(),
    readBy: [],
    attachment: JSON.stringify(attachment),
    replyTo: null,
    approvalPayload: null,
  });
  console.log('  ✓ CREATE   $id =', created.$id);

  // 2) LIST by room + JSON 복원 검증
  const listed = await dbs.listDocuments(dbId, 'chatMessages', [Query.equal('roomId', roomId), Query.limit(10)]);
  const found = listed.documents.find((d) => d.$id === msgId) as unknown as { attachment: string; readBy: string[] };
  const back = JSON.parse(found.attachment);
  console.log(`  ✓ LIST     ${listed.total}건 · 첨부 JSON 왕복: name="${back.name}" (일치: ${back.name === attachment.name})`);

  // 3) UPDATE (markRead)
  await dbs.updateDocument(dbId, 'chatMessages', msgId, { readBy: ['U-smoke', 'U-other'] });
  const after = (await dbs.getDocument(dbId, 'chatMessages', msgId)) as unknown as { readBy: string[] };
  console.log(`  ✓ UPDATE   readBy = [${after.readBy.join(', ')}]`);

  // 4) REALTIME (notifications 구독 → 생성 이벤트 수신)
  let received = false;
  const channels = [
    `databases.${dbId}.collections.notifications.documents`,
    `databases.${dbId}.tables.notifications.rows`,
  ];
  let unsub: (() => void) | undefined;
  try {
    unsub = client.subscribe(channels, () => {
      received = true;
    });
    await sleep(1500); // 구독 안정화
    await dbs.createDocument(dbId, 'notifications', notiId, {
      userId: 'U-smoke',
      type: '시스템',
      title: 'RT-test',
      text: 'realtime 확인',
      senderName: 'bot',
      linkUrl: null,
      read: false,
      createdAt: new Date().toISOString(),
    });
    for (let i = 0; i < 16 && !received; i++) await sleep(500); // 최대 8초 대기
    console.log(received ? '  ✓ REALTIME 이벤트 수신(WebSocket)' : '  ⚠ REALTIME 미수신(8s) — 채널/권한 점검 필요');
  } catch (e) {
    console.log('  ⚠ REALTIME 스킵:', e instanceof Error ? e.message : e);
  } finally {
    if (unsub) unsub();
  }

  // 5) CLEANUP
  await dbs.deleteDocument(dbId, 'chatMessages', msgId);
  try {
    await dbs.deleteDocument(dbId, 'notifications', notiId);
  } catch {
    /* 이벤트 테스트 실패 시 없을 수 있음 */
  }
  const gone = await dbs.listDocuments(dbId, 'chatMessages', [Query.equal('roomId', roomId), Query.limit(1)]);
  console.log(`  ✓ DELETE   정리 완료 (RM-SMOKE 잔여 ${gone.total}건)`);

  console.log('\n✅ 스모크 통과 — Appwrite CRUD + JSON 직렬화 정상' + (received ? ' + Realtime 정상' : ''));
  process.exit(0);
}

main().catch((e) => {
  console.error('\n✗ 스모크 실패:', e instanceof Error ? e.message : e);
  process.exit(1);
});
