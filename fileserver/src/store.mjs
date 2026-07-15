/**
 * 저장 계층 — 백엔드 2종을 같은 인터페이스로 제공.
 *   STORAGE_BACKEND=fs     : 마운트된 볼륨에 직접 파일 쓰기(NAS 내 상주 시 권장 — WebDAV·TLS 불필요)
 *   STORAGE_BACKEND=webdav : Synology WebDAV 로 중계(게이트웨이가 NAS 밖에 있을 때)
 *
 * 공통 인터페이스: resolveDavPath(name, roomId) · putFile(path, buf, mime) · readStream(path) · meta
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from 'webdav';

const BACKEND = (process.env.STORAGE_BACKEND ?? 'webdav').toLowerCase();
const { META_FILE = './data/meta.json' } = process.env;

/**
 * 파일명 정제 — macOS NFD(자모 분해)를 NFC 로 정규화하고, 화이트리스트가 아니라
 * **경로·제어 문자만** 치환해 한글·유니코드를 보존한다.
 */
export function sanitizeName(name) {
  return (
    name
      .normalize('NFC')
      .replace(/[/\\:*?"<>|\x00-\x1f]/g, '_')
      .replace(/^\.+/, '_')
      .slice(0, 200) || 'file'
  );
}

// ── 메타 DB (JSON 파일; 백엔드 공통) ──
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

// ══════════════════ fs 백엔드 ══════════════════
const FS_ROOT = (process.env.FS_ROOT ?? '/files').replace(/\/+$/, '');

async function fsEnsureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}
async function fsResolvePath(name, roomId) {
  const dir = roomId ? path.join(FS_ROOT, sanitizeName(String(roomId))) : FS_ROOT;
  await fsEnsureDir(dir);
  const safe = sanitizeName(name);
  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : '';
  let candidate = path.join(dir, safe);
  for (let n = 1; fs.existsSync(candidate); n++) candidate = path.join(dir, `${stem}(${n})${ext}`);
  return candidate;
}
async function fsPutFile(p, buf) {
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, buf);
}
function fsReadStream(p) {
  return fs.createReadStream(p);
}

// ══════════════════ webdav 백엔드 ══════════════════
export let dav = null;
const WEBDAV_BASE = (process.env.WEBDAV_BASE ?? 'messenger-files').replace(/^\/+|\/+$/g, '');
const BASE = `/${WEBDAV_BASE}`;

if (BACKEND === 'webdav') {
  const { WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS } = process.env;
  if (!WEBDAV_URL) throw new Error('WEBDAV_URL 이 필요합니다(STORAGE_BACKEND=webdav).');
  dav = createClient(WEBDAV_URL, { username: WEBDAV_USER, password: WEBDAV_PASS });
}

const ensuredDirs = new Set();
async function davEnsureDir(dir) {
  if (ensuredDirs.has(dir)) return;
  try {
    if (!(await dav.exists(dir))) await dav.createDirectory(dir, { recursive: true });
  } catch (e) {
    if (!/405|409|Method Not Allowed|exists/i.test(String(e?.message))) throw e;
  }
  ensuredDirs.add(dir);
}
async function davResolvePath(name, roomId) {
  const dir = roomId ? `${BASE}/${sanitizeName(String(roomId))}` : BASE;
  await davEnsureDir(dir);
  const safe = sanitizeName(name);
  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : '';
  let candidate = `${dir}/${safe}`;
  for (let n = 1; await dav.exists(candidate); n++) candidate = `${dir}/${stem}(${n})${ext}`;
  return candidate;
}
async function davPutFile(p, buf, mime) {
  await dav.putFileContents(p, buf, {
    overwrite: true,
    contentLength: buf.length,
    headers: mime ? { 'Content-Type': mime } : undefined,
  });
}
function davReadStream(p) {
  return dav.createReadStream(p);
}

// ══════════════════ 디스패치(백엔드 공통 API) ══════════════════
export async function ensureBase() {
  return BACKEND === 'fs' ? fsEnsureDir(FS_ROOT) : davEnsureDir(BASE);
}

/** 저장 경로 결정 — 방별 하위폴더 + 원본명, 중복 시 (1)(2). 폴더 자동 생성. */
export async function resolveDavPath(name, roomId) {
  return BACKEND === 'fs' ? fsResolvePath(name, roomId) : davResolvePath(name, roomId);
}

export async function putFile(p, buf, mime) {
  return BACKEND === 'fs' ? fsPutFile(p, buf) : davPutFile(p, buf, mime);
}

export function readStream(p) {
  return BACKEND === 'fs' ? fsReadStream(p) : davReadStream(p);
}

export const STORAGE_BACKEND = BACKEND;
