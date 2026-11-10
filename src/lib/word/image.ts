/**
 * 그림 바이트 다루기 — data URL 읽기·만들기, PNG·JPEG·GIF 크기 읽기(브라우저 없이도)
 */

export type ImageType = 'png' | 'jpeg' | 'gif';

export interface ImageBytes {
  data: Uint8Array;
  type: ImageType;
}

/** 'data:image/png;base64,…' → 바이트. 다른 형식이면 null */
export function fromDataUrl(src: string): ImageBytes | null {
  const m = /^data:image\/(png|jpe?g|gif);base64,(.*)$/i.exec(src.trim());
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const t = m[1].toLowerCase();
  return { data, type: t === 'jpg' ? 'jpeg' : (t as ImageType) };
}

/** 바이트 → data URL */
export function toDataUrl(data: Uint8Array, type: ImageType): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < data.length; i += step) bin += String.fromCharCode(...data.subarray(i, i + step));
  return `data:image/${type};base64,${btoa(bin)}`;
}

/** 첫 바이트로 그림 형식 알아보기 */
export function sniffImage(data: Uint8Array): ImageType | null {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'png';
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpeg';
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'gif';
  return null;
}

/** 그림 원래 크기(px). 못 읽으면 null */
export function imageSize(data: Uint8Array): { width: number; height: number } | null {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const type = sniffImage(data);
  if (type === 'png' && data.length >= 24) return { width: v.getUint32(16), height: v.getUint32(20) };
  if (type === 'gif' && data.length >= 10) return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
  if (type === 'jpeg') {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) return null;
      const marker = data[i + 1];
      const len = v.getUint16(i + 2);
      // SOF0~SOF15(DHT·JPG·DAC 제외) — 높이·너비
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: v.getUint16(i + 7), height: v.getUint16(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

/** 그림 주소(data URL·http) → 바이트. 받지 못하면 null */
export async function loadImage(src: string): Promise<ImageBytes | null> {
  const inline = fromDataUrl(src);
  if (inline) return inline;
  if (!/^(https?:|blob:|\/)/i.test(src)) return null;
  try {
    const res = await fetch(src, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    const type = sniffImage(data);
    return type ? { data, type } : null;
  } catch {
    return null;
  }
}
