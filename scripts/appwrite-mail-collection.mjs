/**
 * `mailAccounts` 컬렉션만 생성 — 운영 적용용.
 *
 * `npm run appwrite:schema`는 전 컬렉션(60개+)을 순회하며 누락 속성을 채운다. dev에서는
 * 그게 편하지만 운영에 돌리면 의도치 않은 속성이 붙을 수 있어, 메일 하나만 다루는 경로를
 * 따로 둔다.
 *
 * 실행:
 *   node scripts/appwrite-mail-collection.mjs                    # .env.local 기준(dev)
 *   APPWRITE_PROJECT_ID=<운영> APPWRITE_API_KEY=<운영키> node scripts/appwrite-mail-collection.mjs
 *
 * 멱등: 이미 있으면 건너뛰고, 빠진 속성·인덱스만 채운다.
 */
import { readFileSync, existsSync } from 'node:fs';

const { Client, Databases, Query, DatabasesIndexType } = await import('node-appwrite');

const envText = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
function env(key) {
  if (process.env[key]) return process.env[key];
  const m = envText.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm'));
  return m ? m[1].trim() : undefined;
}

const ENDPOINT = env('APPWRITE_ENDPOINT') ?? env('VITE_APPWRITE_ENDPOINT');
const PROJECT = env('APPWRITE_PROJECT_ID') ?? env('VITE_APPWRITE_PROJECT_ID');
const DB_ID = env('APPWRITE_DATABASE_ID') ?? env('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
// 접미어 없는 키가 없으면 dev 로만 폴백한다 — 기본값이 운영이면 사고가 난다.
const API_KEY = env('APPWRITE_API_KEY') ?? env('APPWRITE_API_KEY_DEV');

const missing = Object.entries({ ENDPOINT, PROJECT, API_KEY }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`✗ 필수 설정 누락: ${missing.join(', ')}`);
  process.exit(1);
}

const COLLECTION = 'mailAccounts';

const S = (key, size, required = false) => ({ kind: 'string', key, size, required });
const EN = (key, elements) => ({ kind: 'enum', key, elements });
// Appwrite 1.9.6 실측: integer 에 min/max 를 생략하면 워커가 processing 에서 멈춘다.
const INT = (key) => ({ kind: 'integer', key, min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER });

const ATTRIBUTES = [
  S('id', 64, true),
  S('workfitUserId', 64, true),
  EN('provider', ['naver', 'daum', 'google', 'microsoft', 'custom']),
  S('email', 255, true),
  S('displayName', 50),
  S('authUsername', 255),
  S('encryptedSecret', 1024, true),
  EN('authType', ['app_password', 'oauth2']),
  EN('transport', ['imap_smtp', 'gmail_api', 'microsoft_graph']),
  EN('status', ['active', 'error', 'disabled']),
  S('smtpHost', 255),
  INT('smtpPort'),
  EN('smtpSecurity', ['tls', 'starttls', 'plain']),
  S('imapHost', 255),
  INT('imapPort'),
  EN('imapSecurity', ['tls', 'starttls', 'plain']),
  S('signature', 1000),
  S('verifiedAt', 40),
  S('lastErrorCode', 64),
  S('createdAt', 40),
  S('updatedAt', 40),
];

const INDEXES = [
  { key: 'idx_mailAcctOwner', type: DatabasesIndexType.Key, attributes: ['workfitUserId'] },
  { key: 'uq_mailAcctOwnerEmail', type: DatabasesIndexType.Unique, attributes: ['workfitUserId', 'email'] },
];

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const dbs = new Databases(client);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isCode = (e, c) => e?.code === c;

/** 이 인스턴스는 간헐적으로 nginx 504 를 뱉는다. 일시 장애만 재시도한다. */
async function retry(label, task, attempts = 4) {
  for (let i = 1; ; i += 1) {
    try {
      return await task();
    } catch (e) {
      if (![502, 503, 504].includes(e?.code) || i >= attempts) throw e;
      console.log(`  … ${label} ${e.code} — 재시도 ${i}`);
      await sleep(3000 * i);
    }
  }
}

console.log(`▶ ${ENDPOINT} / project ${PROJECT} / db ${DB_ID}`);
console.log(`  대상: ${COLLECTION} 하나만 (다른 컬렉션은 건드리지 않음)\n`);

// 1) 컬렉션 — 권한은 빈 배열(서버 전용). 브라우저가 직접 붙으면 401 이고 Function 만 접근한다.
try {
  await retry('createCollection', () => dbs.createCollection(DB_ID, COLLECTION, '메일 계정', [], false));
  console.log('✓ collection 생성 (서버 전용 권한)');
} catch (e) {
  if (!isCode(e, 409)) throw e;
  console.log('• collection 존재 — 건너뜀');
}

// 2) 속성
const have = new Set(
  (await retry('listAttributes', () => dbs.listAttributes(DB_ID, COLLECTION, [Query.limit(500)])))
    .attributes.map((a) => a.key),
);

for (const a of ATTRIBUTES) {
  if (have.has(a.key)) continue;
  await retry(`attr ${a.key}`, () => {
    if (a.kind === 'string') return dbs.createStringAttribute(DB_ID, COLLECTION, a.key, a.size, a.required ?? false);
    if (a.kind === 'enum') return dbs.createEnumAttribute(DB_ID, COLLECTION, a.key, a.elements, false);
    return dbs.createIntegerAttribute(DB_ID, COLLECTION, a.key, false, a.min, a.max);
  });
  console.log(`  ✓ attr ${a.key}`);
}

/**
 * 인덱스는 속성이 전부 available 이어야 만들 수 있다.
 *
 * 워커가 늦으면 인덱스 생성이 400 으로 떨어지는데, 그러면 "컬렉션은 생겼는데 유일 인덱스가
 * 없는" 상태가 남아 중복 등록이 열린다. 여기서 기다린다.
 */
for (let i = 0; i < 60; i += 1) {
  const list = await retry('listAttributes', () => dbs.listAttributes(DB_ID, COLLECTION, [Query.limit(500)]));
  const pending = list.attributes.filter((a) => a.status !== 'available');
  if (pending.length === 0) break;
  if (i === 0) console.log(`  … 속성 준비 대기 (${pending.length}개)`);
  if (i === 59) {
    console.error(`✗ 속성이 available 로 넘어오지 않음: ${pending.map((a) => `${a.key}(${a.status})`).join(', ')}`);
    process.exit(1);
  }
  await sleep(2000);
}

// 3) 인덱스
const haveIx = new Set(
  (await retry('listIndexes', () => dbs.listIndexes(DB_ID, COLLECTION, [Query.limit(100)]))).indexes.map((x) => x.key),
);
for (const ix of INDEXES) {
  if (haveIx.has(ix.key)) { console.log(`• index ${ix.key} 존재`); continue; }
  await retry(`index ${ix.key}`, () => dbs.createIndex(DB_ID, COLLECTION, ix.key, ix.type, ix.attributes));
  console.log(`  ✓ index ${ix.key} [${ix.attributes.join(', ')}]`);
}

console.log('\n✅ mailAccounts 준비 완료. (재실행해도 안전)');
