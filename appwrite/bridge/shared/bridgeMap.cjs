/**
 * 듀얼 라이트 브리지 공용 매핑 — Firestore ↔ Appwrite 변환 + 에코 방지(콘텐츠 비교).
 * ETL 변환 규칙과 동일. F→A(Cloud Function)·A→F(Appwrite Function) 양쪽이 각자 복사해 사용.
 * 순수 JS(무의존) — 두 런타임(Node) 공용.
 */

/** 동기 대상 공유 컬렉션(§4). Firestore명 = Appwrite명. */
const COLLS = {
  chatMessages: { json: ['attachment', 'replyTo', 'approvalPayload'] },
  chatRooms: { json: ['lastMessage'] },
  notifications: { json: [] },
  documentExecutions: { json: [] },
  approvalDocs: { payload: true, payloadCols: ['id', 'docNo', 'docType', 'title', 'drafterId', 'status', 'drafterName'] },
  users: { json: [] },
};

const SHARED_COLLECTIONS = Object.keys(COLLS);

/** Appwrite $id 규격 검사 + 규격 밖(한글 등)은 결정적 해시. (앱 safeDocId 와 동일) */
const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function safeDocId(key) {
  return ID_RE.test(key) ? key : 'h' + cyrb53(key).toString(36) + cyrb53(key, 1).toString(36);
}

/** 키를 재귀 정렬한 정규 JSON(내용 비교용). undefined/null 은 null 로 통일. */
function canonical(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(canonical);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (k.startsWith('$') || k.startsWith('_')) continue; // 시스템/브리지 메타 제외
      out[k] = canonical(v[k]);
    }
    return out;
  }
  return v;
}
const canonicalStr = (v) => JSON.stringify(canonical(v));

/** Firestore 원문 → 도메인 객체(공유 컬렉션은 원문이 곧 도메인). */
function fsToDomain(coll, fsData) {
  return fsData; // 이 6개는 코덱/특수변환 없음. 원문 = 도메인.
}

/** Appwrite row → 도메인 객체(payload 파싱 / json 필드 복원). */
function apwToDomain(coll, row) {
  const spec = COLLS[coll];
  if (spec.payload) {
    return row.payload ? JSON.parse(row.payload) : null;
  }
  const out = {};
  for (const k of Object.keys(row)) {
    if (k.startsWith('$') || k.startsWith('_')) continue;
    out[k] = row[k];
  }
  for (const f of spec.json) {
    const v = row[f];
    out[f] = typeof v === 'string' && v ? JSON.parse(v) : (v ?? null);
  }
  return out;
}

/** 도메인 객체 → Appwrite row. cols = 그 컬렉션의 유효 속성 Set(없으면 필터 안 함). */
function domainToApw(coll, domain, cols) {
  const spec = COLLS[coll];
  if (spec.payload) {
    const row = { payload: JSON.stringify(domain) };
    for (const c of spec.payloadCols) if (domain[c] != null) row[c] = domain[c];
    return row;
  }
  const row = {};
  for (const k of Object.keys(domain)) {
    if (k.startsWith('$') || k.startsWith('_')) continue;
    if (cols && !cols.has(k)) continue;
    row[k] = domain[k];
  }
  for (const f of spec.json) {
    if (f in row) row[f] = row[f] == null ? null : JSON.stringify(domain[f]);
  }
  return row;
}

/** 도메인 객체 → Firestore 저장 데이터(공유 6개는 도메인 = 저장데이터). */
function domainToFs(coll, domain) {
  const out = {};
  for (const k of Object.keys(domain)) {
    if (k.startsWith('$') || k.startsWith('_')) continue;
    out[k] = domain[k];
  }
  return out;
}

/** 두 도메인 객체가 내용상 동일한가(에코 판정). */
function domainEqual(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return canonicalStr(a) === canonicalStr(b);
}

module.exports = {
  COLLS,
  SHARED_COLLECTIONS,
  safeDocId,
  fsToDomain,
  apwToDomain,
  domainToApw,
  domainToFs,
  domainEqual,
};
