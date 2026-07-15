/**
 * 파일 저장소 추상화 — 화면은 이 인터페이스만 소비하고, 저장 위치(Firebase | NAS)는 모른다.
 * (계획서: 파일서버_테스트페이지_개발_계획서.md §5)
 *
 * 드라이버·게이트웨이 URL 은 **런타임 설정(localStorage) → 빌드 env** 순으로 결정한다.
 *   - 배포된 테스트 페이지에서 Vercel 환경변수 없이도 화면에서 직접 지정 가능(§테스트 편의).
 *   - VITE_FILE_STORE_DRIVER / VITE_NAS_FILE_API 는 기본값으로만 쓰인다.
 *
 * 검증 성공 시 chatMessage.repo.uploadAttachment 가 이 fileStore().upload('nas') 에 위임하도록 승격.
 */
import * as tus from 'tus-js-client';
import { storage, isFirebaseConfigured } from '@/shared/lib/firebase';

export type StoredFile = {
  /** 다운로드/미리보기 URL(브라우저에서 직접 사용). */
  url: string;
  name: string;
  size: number;
  mime: string;
  /** 게이트웨이 파일 id(nas 드라이버). */
  id?: string;
};

export type UploadAuth = { userId: string; name?: string };
export type UploadOpts = {
  roomId?: string;
  auth?: UploadAuth;
  onProgress?: (pct: number) => void;
};

export interface FileStore {
  upload(file: File, opts?: UploadOpts): Promise<StoredFile>;
  list(opts?: { roomId?: string; auth?: UploadAuth }): Promise<StoredFile[]>;
}

// ── 런타임 설정(localStorage 우선, 없으면 빌드 env) ──
const LS_DRIVER = 'filelab.driver';
const LS_API = 'filelab.api';

export type DriverName = 'firebase' | 'nas';

export function getDriver(): DriverName {
  const o = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_DRIVER) : null;
  return ((o || import.meta.env.VITE_FILE_STORE_DRIVER || 'firebase') as DriverName);
}

export function getApiBase(): string {
  const o = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_API) : null;
  return ((o || (import.meta.env.VITE_NAS_FILE_API as string | undefined) || '') as string).replace(
    /\/+$/,
    '',
  );
}

/** 화면 설정 저장. driver 필수, api 는 nas 일 때만 의미. */
export function setStoreConfig(driver: DriverName, api?: string): void {
  localStorage.setItem(LS_DRIVER, driver);
  if (api != null) localStorage.setItem(LS_API, api.trim());
}

// ── Layer 1 토큰: 앱 사용자 id 로 게이트웨이 JWT 발급(데모). 사용자별 캐시. ──
const tokenCache = new Map<string, string>();
async function gatewayToken(auth?: UploadAuth): Promise<string> {
  const userId = auth?.userId ?? 'dev-user';
  const cacheKey = `${getApiBase()}::${userId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;
  const res = await fetch(`${getApiBase()}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, name: auth?.name }),
  });
  if (!res.ok) throw new Error('게이트웨이 토큰 발급 실패');
  const { token } = (await res.json()) as { token: string };
  tokenCache.set(cacheKey, token);
  return token;
}

function downloadUrl(id: string, token: string): string {
  return `${getApiBase()}/download/${id}?t=${encodeURIComponent(token)}`;
}

// ── NAS 드라이버(tus → WebDAV 게이트웨이) ──
const nasStore: FileStore = {
  async upload(file, opts) {
    if (!getApiBase()) throw new Error('게이트웨이 URL 이 설정되지 않았습니다(설정에서 지정).');
    const token = await gatewayToken(opts?.auth);
    return new Promise<StoredFile>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${getApiBase()}/upload`,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024, // 5MB 청크(이어올리기 단위)
        headers: { Authorization: `Bearer ${token}` },
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: file.name,
          filetype: file.type || 'application/octet-stream',
          roomId: opts?.roomId ?? '',
          uploaderId: opts?.auth?.userId ?? '',
        },
        onError: reject,
        onProgress: (sent, total) =>
          opts?.onProgress?.(total ? Math.round((sent / total) * 100) : 0),
        onSuccess: async () => {
          const id = (upload.url ?? '').split('/').filter(Boolean).pop() ?? '';
          // 실제 저장된 이름(중복 시 (1) 포함)을 게이트웨이에서 되읽어 표시 일치.
          let storedName = file.name;
          try {
            const r = await fetch(`${getApiBase()}/files/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r.ok) storedName = ((await r.json()) as { name?: string }).name ?? file.name;
          } catch {
            /* 되읽기 실패 시 원본명으로 표시(치명적 아님) */
          }
          resolve({
            id,
            url: downloadUrl(id, token),
            name: storedName,
            size: file.size,
            mime: file.type || 'application/octet-stream',
          });
        },
      });
      upload.start();
    });
  },

  async list(opts) {
    if (!getApiBase()) return [];
    const token = await gatewayToken(opts?.auth);
    const qs = opts?.roomId ? `?roomId=${encodeURIComponent(opts.roomId)}` : '';
    const res = await fetch(`${getApiBase()}/files${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      id: string;
      name: string;
      size: number;
      mime: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      size: r.size,
      mime: r.mime,
      url: downloadUrl(r.id, token),
    }));
  },
};

// ── Firebase 드라이버(현행 Storage; uploadAttachment 사상 재사용) ──
const firebaseStore: FileStore = {
  async upload(file, opts) {
    const meta = {
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
    };
    if (isFirebaseConfigured && storage) {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const safe = file.name.replace(/[^\w.\-가-힣]/g, '_');
      const scope = opts?.roomId ?? 'lab';
      const path = `filelab/${scope}/${Date.now()}-${safe}`;
      const r = ref(storage, path);
      await uploadBytes(r, file, {
        contentType: meta.mime,
        contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      });
      opts?.onProgress?.(100);
      return { url: await getDownloadURL(r), ...meta };
    }
    // 미설정 폴백: base64 data URL
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    opts?.onProgress?.(100);
    return { url, ...meta };
  },

  // Firebase 는 목록 API 가 없어(listAll 별도) 검증 페이지에서는 세션 로컬 상태로만 표시.
  async list() {
    return [];
  },
};

/** 현재 런타임 드라이버에 맞는 저장소 반환. */
export function fileStore(): FileStore {
  return getDriver() === 'nas' ? nasStore : firebaseStore;
}
