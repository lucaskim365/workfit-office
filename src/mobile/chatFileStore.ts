import { useEffect, useSyncExternalStore } from 'react';

/**
 * 채팅 첨부 보관함(휴대폰 앱) — 한 번 받은 파일을 앱 전용 보관함(브라우저 Cache Storage)에 두고 다음엔 바로 연다.
 * 휴대폰의 '다운로드' 폴더에 저장한 파일은 웹 앱이 다시 읽을 수 없어서, 앱이 읽을 수 있는 곳에 따로 둔다(카카오톡처럼
 * 처음엔 받고, 그다음부터는 바로 열기). 휴대폰에 남기려면 보기 화면의 [저장](다운로드).
 *
 * 보관 한도: 최근 MAX_ITEMS 개·MAX_BYTES 까지 — 넘으면 먼저 받은 것부터 지운다.
 * 보관함은 이 휴대폰·이 앱에만 있다(로그아웃·앱 데이터 삭제 때 함께 지워짐).
 */
const CACHE = 'workfit-chat-files';
const MAX_ITEMS = 60;
const MAX_BYTES = 200 * 1024 * 1024;
const SAVED_AT = 'x-workfit-saved-at';

export type ChatFileStatus = { state: 'idle' | 'loading' | 'ready' | 'error'; progress: number };
const IDLE: ChatFileStatus = { state: 'idle', progress: 0 };

const statuses = new Map<string, ChatFileStatus>();
const listeners = new Set<() => void>();
const checked = new Set<string>();

function setStatus(url: string, s: ChatFileStatus) {
  statuses.set(url, s);
  listeners.forEach((l) => l());
}

const hasCache = () => typeof caches !== 'undefined';

/** 보관함에 있는 파일(없으면 null) */
export async function getChatFile(url: string): Promise<Blob | null> {
  if (!hasCache()) return null;
  try {
    const res = await (await caches.open(CACHE)).match(url);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

async function touch(cache: Cache, url: string, blob: Blob, type: string) {
  try {
    await cache.put(url, new Response(blob, { headers: { 'content-type': type, [SAVED_AT]: String(Date.now()) } }));
  } catch {
    /* 기록 실패 — 그대로 둔다 */
  }
}

/** 받기 — 진행률을 알리고 다 받으면 보관함에 넣는다. 실패하면 throw */
export async function loadChatFile(url: string, mime: string): Promise<Blob> {
  setStatus(url, { state: 'loading', progress: 0 });
  try {
    // no-store: 화면이 먼저 받아 둔 캐시(CORS 헤더 없음)를 쓰지 않게(download.ts 와 같은 이유)
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const total = Number(res.headers.get('content-length')) || 0;
    let blob: Blob;
    if (res.body && total > 0) {
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as BlobPart);
        got += value.byteLength;
        setStatus(url, { state: 'loading', progress: Math.min(99, Math.round((got / total) * 100)) });
      }
      blob = new Blob(chunks, { type: mime || res.headers.get('content-type') || '' });
    } else {
      blob = await res.blob();
    }
    if (hasCache()) {
      try {
        const cache = await caches.open(CACHE);
        await touch(cache, url, blob, blob.type || mime);
        void evict(cache);
      } catch {
        /* 보관 실패(저장 공간 등) — 이번엔 그냥 연다 */
      }
    }
    setStatus(url, { state: 'ready', progress: 100 });
    return blob;
  } catch (e) {
    setStatus(url, { state: 'error', progress: 0 });
    throw e;
  }
}

/** 한도를 넘으면 먼저 받은 것부터 지운다 */
async function evict(cache: Cache) {
  const keys = await cache.keys();
  const items: { req: Request; at: number; size: number }[] = [];
  for (const req of keys) {
    const res = await cache.match(req);
    if (!res) continue;
    const size = Number(res.headers.get('content-length')) || (await res.clone().blob()).size;
    items.push({ req, at: Number(res.headers.get(SAVED_AT)) || 0, size });
  }
  items.sort((a, b) => b.at - a.at);
  let bytes = 0;
  for (let i = 0; i < items.length; i++) {
    bytes += items[i].size;
    if (i >= MAX_ITEMS || bytes > MAX_BYTES) {
      await cache.delete(items[i].req);
      statuses.delete(items[i].req.url);
    }
  }
  listeners.forEach((l) => l());
}

/** 말풍선용 — 이 파일을 받았는지·받는 중인지(처음 그릴 때 보관함을 한 번 들여다본다) */
export function useChatFileStatus(url: string | undefined): ChatFileStatus {
  const status = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (url ? (statuses.get(url) ?? IDLE) : IDLE)
  );
  useEffect(() => {
    if (!url || checked.has(url) || !hasCache()) return;
    checked.add(url);
    void caches
      .open(CACHE)
      .then((c) => c.match(url))
      .then((res) => {
        if (res && (statuses.get(url)?.state ?? 'idle') === 'idle') setStatus(url, { state: 'ready', progress: 100 });
      })
      .catch(() => {});
  }, [url]);
  return status;
}

/** 휴대폰 '다운로드' 폴더에 저장 — 받아 둔 파일로(다시 받지 않음) */
export function saveBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * 다른 앱으로 열기 — 휴대폰 공유 창(앱 화면 위에 뜸 → 고른 앱에서 뒤로가기하면 채팅방으로 돌아옴).
 * 'unsupported': 공유 창이 없는 기기, 'expired': 누른 지 오래돼 휴대폰이 막음(다시 누르면 됨), 'cancelled': 사용자가 닫음
 */
export async function shareFile(blob: Blob, name: string, mime: string): Promise<'shared' | 'unsupported' | 'expired' | 'cancelled'> {
  const file = new File([blob], name, { type: mime || blob.type || 'application/octet-stream' });
  if (typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], title: name });
    return 'shared';
  } catch (e) {
    const err = e as { name?: string };
    if (err?.name === 'AbortError') return 'cancelled';
    if (err?.name === 'NotAllowedError') return 'expired';
    return 'unsupported';
  }
}
