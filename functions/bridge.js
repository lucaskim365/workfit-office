/**
 * 듀얼 라이트 브리지 [F→A] — Firestore 공유 컬렉션 write → Appwrite 미러(콘텐츠 비교 에코 방지).
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 4). index.js 가 이 파일의 export 를 병합한다.
 * 리전/전역 옵션은 index.js 의 setGlobalOptions(asia-northeast3) 를 상속.
 *
 * env(Firebase 함수): APPWRITE_ENDPOINT · APPWRITE_PROJECT_ID · APPWRITE_API_KEY(databases 스코프) · APPWRITE_DATABASE_ID
 */
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
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

const DB = process.env.APPWRITE_DATABASE_ID || 'workfit';
function appwrite() {
  return new Databases(
    new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY),
  );
}

const colsCache = {};
async function columnsOf(dbs, coll) {
  if (colsCache[coll]) return colsCache[coll];
  const res = await dbs.listAttributes(DB, coll);
  const set = new Set(res.attributes.map((a) => a.key));
  colsCache[coll] = set;
  return set;
}

const isCode = (e, code) => e && e.code === code;

function makeHandler(coll) {
  return onDocumentWritten(`${coll}/{docId}`, async (event) => {
    const docId = event.params.docId;
    const after = event.data && event.data.after;
    const dbs = appwrite();
    const id = safeDocId(docId);

    // 삭제(after 없음) → Appwrite 삭제.
    if (!after || !after.exists) {
      try {
        await dbs.deleteDocument(DB, coll, id);
        console.log(`[F->A] delete ${coll}/${docId}`);
      } catch (e) {
        if (!isCode(e, 404)) throw e;
      }
      return;
    }

    // create/update → 콘텐츠 비교 후 미러.
    const domain = fsToDomain(coll, after.data());
    let target = null;
    try {
      target = await dbs.getDocument(DB, coll, id);
    } catch (e) {
      if (!isCode(e, 404)) throw e;
    }
    if (target && domainEqual(domain, apwToDomain(coll, target))) {
      console.log(`[F->A] skip(echo) ${coll}/${docId}`);
      return;
    }
    const cols = COLLS[coll].payload ? null : await columnsOf(dbs, coll);
    const row = domainToApw(coll, domain, cols);
    try {
      await dbs.updateDocument(DB, coll, id, row);
    } catch (e) {
      if (isCode(e, 404)) await dbs.createDocument(DB, coll, id, row);
      else throw e;
    }
    console.log(`[F->A] mirror ${coll}/${docId}`);
  });
}

const handlers = {};
for (const coll of SHARED_COLLECTIONS) {
  handlers[`bridge_${coll}`] = makeHandler(coll);
}
module.exports = handlers;
