/**
 * 듀얼 라이트 브리지 [F→A] — Firebase Cloud Function.
 * Firestore 공유 컬렉션 write → Appwrite 로 미러(콘텐츠 비교 에코 방지).
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 4)
 *
 * 배포: 기존 functions/ 에 합치거나 별도. `firebase deploy --only functions`.
 * env: APPWRITE_ENDPOINT · APPWRITE_PROJECT_ID · APPWRITE_API_KEY(databases 스코프) · APPWRITE_DATABASE_ID
 */
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { Client, Databases } = require('node-appwrite');
const {
  SHARED_COLLECTIONS,
  COLLS,
  safeDocId,
  fsToDomain,
  apwToDomain,
  domainToApw,
  domainEqual,
} = require('./bridgeMap.cjs');

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 });

const DB = process.env.APPWRITE_DATABASE_ID || 'workfit';
function appwrite() {
  return new Databases(
    new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY),
  );
}

// 컬렉션별 유효 속성 캐시(불필요 필드 제외용).
const colsCache = {};
async function columnsOf(dbs, coll) {
  if (colsCache[coll]) return colsCache[coll];
  const res = await dbs.listAttributes(DB, coll);
  const set = new Set(res.attributes.map((a) => a.key));
  colsCache[coll] = set;
  return set;
}

const isCode = (e, code) => e && e.code === code;

/** 한 컬렉션에 대한 F→A 브리지 핸들러 생성. */
function makeHandler(coll) {
  return onDocumentWritten(`${coll}/{docId}`, async (event) => {
    const docId = event.params.docId;
    const after = event.data.after;
    const dbs = appwrite();
    const id = safeDocId(docId);

    // 1) 삭제(after 없음) → Appwrite 삭제(콘텐츠 비교 불필요, 없으면 no-op).
    if (!after || !after.exists) {
      try {
        await dbs.deleteDocument(DB, coll, id);
        console.log(`[F→A] delete ${coll}/${docId}`);
      } catch (e) {
        if (!isCode(e, 404)) throw e;
      }
      return;
    }

    // 2) create/update → 콘텐츠 비교 후 미러.
    const domain = fsToDomain(coll, after.data());
    let target = null;
    try {
      target = await dbs.getDocument(DB, coll, id);
    } catch (e) {
      if (!isCode(e, 404)) throw e;
    }
    if (target && domainEqual(domain, apwToDomain(coll, target))) {
      console.log(`[F→A] skip(echo) ${coll}/${docId}`);
      return; // 내용 동일 → 에코 → 쓰지 않음(루프 차단)
    }
    const cols = COLLS[coll].payload ? null : await columnsOf(dbs, coll);
    const row = domainToApw(coll, domain, cols);
    try {
      await dbs.updateDocument(DB, coll, id, row);
    } catch (e) {
      if (isCode(e, 404)) await dbs.createDocument(DB, coll, id, row);
      else throw e;
    }
    console.log(`[F→A] mirror ${coll}/${docId}`);
  });
}

// 공유 컬렉션마다 트리거 export.
for (const coll of SHARED_COLLECTIONS) {
  exports[`bridge_${coll}`] = makeHandler(coll);
}
