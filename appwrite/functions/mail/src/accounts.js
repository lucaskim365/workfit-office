/**
 * 메일 계정 CRUD — 전부 소유자 범위로 잠근다.
 *
 * 모든 조회·수정이 `workfitUserId === uid` 조건을 거친다. 문서 ID를 알더라도 남의 계정은
 * 건드릴 수 없다. 이 규칙이 무너지면 앱 비밀번호로 열리는 남의 메일함이 그대로 노출된다.
 */
import { Query } from 'node-appwrite';
import { randomUUID } from 'node:crypto';
import { encryptSecret, decryptSecret } from './credentials.js';
import { connectionSettings, isOpenProvider } from './providers.js';
import { verifyConnection } from './verify.js';

const COLLECTION = 'mailAccounts';

export class MailFnError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Appwrite 문서 ID 규칙(36자 이하, 영숫자·`.`·`-`·`_`, 특수문자로 시작 금지)에 맞는 값. */
const newId = () => randomUUID().replace(/-/g, '').slice(0, 24);

const stamp = () => new Date().toISOString();

/**
 * 문서 → 화면이 보는 계정.
 *
 * **`encryptedSecret`은 절대 싣지 않는다.** 도메인 스키마에도 자리가 없지만, 여기서 한 번 더
 * 막아야 나중에 스키마가 느슨해져도 값이 새지 않는다.
 */
function toApi(doc) {
  return {
    id: doc.id || doc.$id,
    workfitUserId: doc.workfitUserId,
    displayName: doc.displayName || '',
    email: doc.email,
    provider: doc.provider,
    authType: doc.authType || 'app_password',
    transport: doc.transport || 'imap_smtp',
    status: doc.status || 'active',
    verifiedAt: doc.verifiedAt || null,
    signature: doc.signature || '',
    lastErrorCode: doc.lastErrorCode || null,
    createdAt: doc.createdAt || doc.$createdAt,
    updatedAt: doc.updatedAt || doc.$updatedAt,
  };
}

/** 소유자의 계정 문서 하나. 없거나 남의 것이면 null. */
async function ownedDoc(dbs, dbId, uid, id) {
  const found = await dbs.listDocuments(dbId, COLLECTION, [
    Query.equal('workfitUserId', uid),
    Query.equal('id', id),
    Query.limit(1),
  ]);
  return found.documents[0] ?? null;
}

export async function listAccounts(dbs, dbId, uid) {
  const res = await dbs.listDocuments(dbId, COLLECTION, [
    Query.equal('workfitUserId', uid),
    Query.limit(50),
  ]);
  return res.documents.map(toApi);
}

/**
 * 계정 등록.
 *
 * 연결 확인을 **먼저** 통과해야 저장한다. 순서를 뒤집으면 비밀번호가 틀린 계정이 목록에
 * 남아 매 조회마다 실패한다.
 */
export async function createAccount(dbs, dbId, uid, draft, secret, env) {
  const email = String(draft?.email || '').trim().toLowerCase();
  const provider = String(draft?.provider || '');

  if (!email) throw new MailFnError('INVALID_INPUT', '메일 주소를 입력하세요.');
  if (!secret) throw new MailFnError('INVALID_INPUT', '앱 비밀번호를 입력하세요.');
  if (!isOpenProvider(provider)) {
    throw new MailFnError('PROVIDER_UNAVAILABLE', '아직 지원하지 않는 공급자입니다.');
  }

  // 유일 인덱스가 최종 방어선이지만, 먼저 확인해야 사용자에게 제대로 된 메시지가 나간다.
  const dup = await dbs.listDocuments(dbId, COLLECTION, [
    Query.equal('workfitUserId', uid),
    Query.equal('email', email),
    Query.limit(1),
  ]);
  if (dup.total > 0) throw new MailFnError('DUPLICATE', '이미 등록된 메일 주소입니다.');

  const settings = connectionSettings({ provider, email, authUsername: draft?.authUsername }, secret);
  const result = await verifyConnection(settings);
  if (!result.ok) {
    throw new MailFnError(result.code, `${result.stage === 'imap' ? 'IMAP' : 'SMTP'} 연결에 실패했습니다.`, 400);
  }

  const now = stamp();
  const id = newId();
  const doc = await dbs.createDocument(dbId, COLLECTION, id, {
    id,
    workfitUserId: uid,
    provider,
    email,
    displayName: String(draft?.displayName || '').trim() || email.split('@')[0],
    authUsername: String(draft?.authUsername || '').trim(),
    encryptedSecret: encryptSecret(secret, env),
    authType: 'app_password',
    transport: 'imap_smtp',
    status: 'active',
    signature: String(draft?.signature || '').slice(0, 1000),
    verifiedAt: now,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  });
  return toApi(doc);
}

/**
 * 계정 수정.
 *
 * `secret`이 null이면 자격 증명을 그대로 둔다 — 화면에서 앱 비밀번호란을 비워 저장한 경우다.
 * 새 비밀번호가 들어오면 저장 전에 다시 연결을 확인한다.
 */
export async function updateAccount(dbs, dbId, uid, id, draft, secret, env) {
  const current = await ownedDoc(dbs, dbId, uid, id);
  if (!current) throw new MailFnError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);

  const patch = { updatedAt: stamp() };
  if (draft?.displayName !== undefined) patch.displayName = String(draft.displayName).trim();
  if (draft?.signature !== undefined) patch.signature = String(draft.signature).slice(0, 1000);

  if (secret) {
    const settings = connectionSettings(current, secret);
    const result = await verifyConnection(settings);
    if (!result.ok) {
      throw new MailFnError(result.code, `${result.stage === 'imap' ? 'IMAP' : 'SMTP'} 연결에 실패했습니다.`, 400);
    }
    patch.encryptedSecret = encryptSecret(secret, env);
    patch.status = 'active';
    patch.verifiedAt = patch.updatedAt;
    patch.lastErrorCode = null;
  }

  const doc = await dbs.updateDocument(dbId, COLLECTION, current.$id, patch);
  return toApi(doc);
}

export async function deleteAccount(dbs, dbId, uid, id) {
  const current = await ownedDoc(dbs, dbId, uid, id);
  if (!current) throw new MailFnError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);
  await dbs.deleteDocument(dbId, COLLECTION, current.$id);
  return { id };
}

/**
 * 연결 확인만. 저장하지 않는다.
 *
 * 신규 등록 화면에서는 아직 문서가 없으니 draft + 입력한 비밀번호로 확인하고,
 * 기존 계정이면 저장된 자격 증명을 풀어서 확인한다.
 */
export async function testConnection(dbs, dbId, uid, draft, secret, id, env) {
  let settings;

  if (secret) {
    const provider = String(draft?.provider || '');
    if (!isOpenProvider(provider)) {
      throw new MailFnError('PROVIDER_UNAVAILABLE', '아직 지원하지 않는 공급자입니다.');
    }
    settings = connectionSettings(
      { provider, email: String(draft?.email || '').trim().toLowerCase(), authUsername: draft?.authUsername },
      secret,
    );
  } else {
    if (!id) throw new MailFnError('INVALID_INPUT', '앱 비밀번호를 입력하세요.');
    const current = await ownedDoc(dbs, dbId, uid, id);
    if (!current) throw new MailFnError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);
    settings = connectionSettings(current, decryptSecret(current.encryptedSecret, env));
  }

  const result = await verifyConnection(settings);
  return { ok: result.ok, stage: result.stage, code: result.code };
}
