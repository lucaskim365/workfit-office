/**
 * 저장 계층 — Synology WebDAV(실파일) + 로컬 JSON(파일 메타).
 * WebDAV 자격증명(svc-fileapp)은 여기(서버 env)에서만 쓰인다. 브라우저 미노출.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from 'webdav';

const {
  WEBDAV_URL,
  WEBDAV_USER,
  WEBDAV_PASS,
  WEBDAV_BASE = 'messenger-files',
  META_FILE = './data/meta.json',
} = process.env;

if (!WEBDAV_URL) throw new Error('WEBDAV_URL 이 필요합니다(.env).');

/** Synology WebDAV 클라이언트 — Layer 2 인증(Basic over TLS). */
export const dav = createClient(WEBDAV_URL, {
  username: WEBDAV_USER,
  password: WEBDAV_PASS,
});

const BASE = `/${WEBDAV_BASE.replace(/^\/+|\/+$/g, '')}`;

const ensuredDirs = new Set();
/**
 * 폴더가 없으면 생성(있으면 무시). 중첩 경로(예: AX사업본부/file-storage/RM-001)도 재귀 생성.
 * ⚠ 최상위 세그먼트(공유폴더)는 DSM 에서 미리 존재해야 한다(WebDAV 루트엔 생성 불가).
 */
export async function ensureDir(dir) {
  if (ensuredDirs.has(dir)) return;
  try {
    if (!(await dav.exists(dir))) await dav.createDirectory(dir, { recursive: true });
  } catch (e) {
    // 이미 존재/경합은 무시, 그 외는 상위로
    if (!/405|409|Method Not Allowed|exists/i.test(String(e?.message))) throw e;
  }
  ensuredDirs.add(dir);
}

/** 저장 기준 폴더 보장(BASE). */
export async function ensureBase() {
  return ensureDir(BASE);
}

/**
 * 파일명 정제 — macOS NFD(자모 분해)를 NFC 로 정규화하고, 화이트리스트가 아니라
 * **경로·제어 문자만** 치환해 한글·유니코드를 보존한다.
 */
export function sanitizeName(name) {
  return (
    name
      .normalize('NFC')
      .replace(/[/\\:*?"<>|\x00-\x1f]/g, '_') // 경로 구분·제어 문자만 치환
      .replace(/^\.+/, '_') // 선두 점(숨김/상위경로) 방지
      .slice(0, 200) || 'file'
  );
}

/**
 * 저장할 WebDAV 경로 결정 — **채팅방별 하위폴더**(roomId) 아래 **원본 파일명 그대로** 사용,
 * 중복 시 `(1)(2)` 부여. roomId 가 없으면 BASE 루트에 저장.
 * 방 폴더는 자동 생성. id 는 파일명에 넣지 않는다(앱은 메타의 id 로 식별).
 * ⚠ 동시 업로드 경합 시 드물게 같은 후보를 고를 수 있음(데모 허용 범위).
 */
export async function resolveDavPath(name, roomId) {
  const dir = roomId ? `${BASE}/${sanitizeName(String(roomId))}` : BASE;
  await ensureDir(dir);
  const safe = sanitizeName(name);
  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : '';
  let candidate = `${dir}/${safe}`;
  for (let n = 1; await dav.exists(candidate); n++) {
    candidate = `${dir}/${stem}(${n})${ext}`;
  }
  return candidate;
}

export async function putFile(davPath, buffer, mime) {
  await ensureBase();
  await dav.putFileContents(davPath, buffer, {
    overwrite: true,
    contentLength: buffer.length,
    headers: mime ? { 'Content-Type': mime } : undefined,
  });
}

/** 다운로드용 읽기 스트림(게이트웨이가 프록시). */
export function readStream(davPath) {
  return dav.createReadStream(davPath);
}

// ── 메타 DB (JSON 파일; 검증용. 운영은 sqlite 로 승격 가능) ──
function readAll() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function writeAll(rows) {
  fs.mkdirSync(path.dirname(META_FILE), { recursive: true });
  fs.writeFileSync(META_FILE, JSON.stringify(rows, null, 2));
}

export const meta = {
  list({ roomId } = {}) {
    let rows = readAll();
    if (roomId) rows = rows.filter((r) => r.roomId === roomId);
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  },
  get(id) {
    return readAll().find((r) => r.id === id) ?? null;
  },
  add(rec) {
    const rows = readAll();
    rows.push(rec);
    writeAll(rows);
    return rec;
  },
};
