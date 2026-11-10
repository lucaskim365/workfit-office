/**
 * ZIP 읽기·쓰기 — .xlsx 를 풀고(불러오기) 묶기(내보내기) 위한 최소 구현 (외부 라이브러리 없이)
 * - 중앙 디렉터리로 파일 목록을 읽고, 저장(0)·deflate(8) 방식만 푼다
 * - deflate 는 브라우저·Node 기본 DecompressionStream('deflate-raw') 사용
 * - 암호화·ZIP64·분할 압축은 지원하지 않음 → ZipError
 */

export class ZipError extends Error {}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
  encrypted: boolean;
}

function findEndOfCentralDirectory(view: DataView): number {
  // 주석이 최대 65535바이트라 끝에서부터 그만큼만 찾는다
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i;
  }
  throw new ZipError('ZIP 파일이 아닙니다.');
}

function readEntries(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (offset === 0xffffffff) throw new ZipError('너무 큰 파일(ZIP64)은 읽을 수 없습니다.');
  const decoder = new TextDecoder();
  const entries: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== SIG_CENTRAL) throw new ZipError('ZIP 목록이 손상되었습니다.');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    entries.push({ name, method, compressedSize, localOffset, encrypted: (flags & 1) === 1 });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ZIP 안 파일 → 내용(바이트). 경로는 ZIP 안 경로 그대로('xl/workbook.xml') */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, Uint8Array>();
  for (const e of readEntries(bytes)) {
    if (e.name.endsWith('/')) continue;
    if (e.encrypted) throw new ZipError('암호가 걸린 파일은 읽을 수 없습니다.');
    if (view.getUint32(e.localOffset, true) !== SIG_LOCAL) throw new ZipError('ZIP 파일이 손상되었습니다.');
    const start = e.localOffset + 30 + view.getUint16(e.localOffset + 26, true) + view.getUint16(e.localOffset + 28, true);
    const data = bytes.subarray(start, start + e.compressedSize);
    if (e.method === 0) out.set(e.name, data);
    else if (e.method === 8) out.set(e.name, await inflateRaw(data));
    else throw new ZipError(`지원하지 않는 압축 방식입니다(${e.method}).`);
  }
  return out;
}

// ── ZIP 쓰기 — .xlsx 내보내기용 (deflate 는 브라우저·Node 기본 CompressionStream('deflate-raw')) ──

let CRC_TABLE: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 파일들 → ZIP 바이트. 글자는 UTF-8 로. 압축 기능이 없는 환경이면 압축 없이(저장) 담는다 */
export async function zip(files: [name: string, content: string | Uint8Array][]): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const canDeflate = typeof CompressionStream !== 'undefined';
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const raw = typeof content === 'string' ? enc.encode(content) : content;
    const nameBytes = enc.encode(name);
    const packed = canDeflate ? await deflateRaw(raw) : raw;
    const method = canDeflate ? 8 : 0;
    const crc = crc32(raw);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, 20, true); // 풀 때 필요한 버전
    lv.setUint16(6, 0x0800, true); // 이름이 UTF-8
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true); // 시각
    lv.setUint16(12, 0x21, true); // 날짜(1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, packed.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, packed.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local, packed);
    centrals.push(central);
    offset += local.length + packed.length;
  }
  const centralSize = centrals.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, SIG_EOCD, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
