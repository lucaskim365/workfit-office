/**
 * 듀얼 라이트 브리지 [A→F] — Appwrite Function.
 * Appwrite 공유 컬렉션 이벤트 → Firestore 로 미러(콘텐츠 비교 에코 방지).
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 4)
 *
 * 트리거(이벤트): 6개 컬렉션 × create/update/delete
 *   databases.workfit.collections.{coll}.documents.*.{create|update|delete}
 * env: FCM_SERVICE_ACCOUNT(Firestore 쓰기용 서비스계정, 푸시와 공용) · APPWRITE_DATABASE_ID
 */
import admin from 'firebase-admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// bridgeMap 은 CommonJS(F→A 와 공용) — ESM 에서 createRequire 로 로드.
const { SHARED_COLLECTIONS, apwToDomain, domainToFs, fsToDomain, domainEqual } = require('./bridgeMap.cjs');

function ensureAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FCM_SERVICE_ACCOUNT)) });
  }
  return admin.firestore();
}

/** 이벤트 문자열에서 컬렉션명·동작 추출. 예: databases.workfit.collections.chatMessages.documents.RM-1.create */
function parseEvent(event) {
  const collM = /\.(?:collections|tables)\.([^.]+)\.(?:documents|rows)\./.exec(event);
  const coll = collM ? collM[1] : null;
  const action = event.endsWith('.create') ? 'create' : event.endsWith('.update') ? 'update' : event.endsWith('.delete') ? 'delete' : null;
  return { coll, action };
}

export default async ({ req, res, log, error }) => {
  try {
    const fs = ensureAdmin();
    const event = req.headers['x-appwrite-event'] || '';
    const { coll, action } = parseEvent(event);
    const row = req.bodyJson || {};

    if (!coll || !SHARED_COLLECTIONS.includes(coll) || !action) {
      return res.json({ skipped: 'unmatched', event });
    }

    // Firestore 문서 ID = Appwrite $id (공유 6개는 ASCII 자연키 = $id).
    const docId = String(row.$id || '');
    if (!docId) return res.json({ skipped: 'no-id', event });
    const ref = fs.collection(coll).doc(docId);

    // 1) delete → Firestore 삭제(없으면 no-op).
    if (action === 'delete') {
      await ref.delete().catch(() => {});
      log(`[A→F] delete ${coll}/${docId}`);
      return res.json({ ok: true, action, coll, docId });
    }

    // 2) create/update → 콘텐츠 비교 후 미러.
    const domain = apwToDomain(coll, row);
    if (domain == null) return res.json({ skipped: 'no-payload', event });

    const snap = await ref.get();
    if (snap.exists && domainEqual(domain, fsToDomain(coll, snap.data()))) {
      log(`[A→F] skip(echo) ${coll}/${docId}`);
      return res.json({ ok: true, skipped: 'echo', coll, docId });
    }
    await ref.set(domainToFs(coll, domain)); // 전체 치환(웹이 소스)
    log(`[A→F] mirror ${coll}/${docId}`);
    return res.json({ ok: true, action: 'mirror', coll, docId });
  } catch (e) {
    error(`[A→F] error: ${e.message}`);
    return res.json({ ok: false, error: e.message }, 500);
  }
};
