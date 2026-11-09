/**
 * ZIP 읽기 — .xlsx 를 풀기 위한 최소 구현 (외부 라이브러리 없이)
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
