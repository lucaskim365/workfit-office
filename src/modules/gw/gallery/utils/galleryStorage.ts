import type { GalleryAlbum, GalleryItem } from '../types';

export const STORAGE_ALBUMS_KEY = 'workfit_phone_gallery_albums_v3';
export const STORAGE_ITEMS_KEY = 'workfit_phone_gallery_items_v3';

export const DEFAULT_ALBUMS: GalleryAlbum[] = [
  { id: 'recent', name: '전체 (최근 항목)', description: '모든 사진이 등록된 기본 앨범', isSystem: true, createdAt: '2026-01-01' },
  { id: 'alb_event', name: '사내 행사', description: '창립기념일, 워크숍, 전사 행사', createdAt: '2026-01-01' },
  { id: 'alb_workshop', name: '세미나 & 교육', description: '기술 세미나 및 사내외 교육', createdAt: '2026-02-15' },
  { id: 'alb_club', name: '동호회 & 소모임', description: '스포츠, 문화 활동 소모임', createdAt: '2026-03-01' },
];

/** 로컬스토리지에서 앨범 목록 로드 (실패 시 기본 앨범 목록) */
export function loadAlbumsFromStorage(): GalleryAlbum[] {
  try {
    const saved = localStorage.getItem(STORAGE_ALBUMS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore json error
  }
  return DEFAULT_ALBUMS;
}

/** 앨범 목록을 로컬스토리지에 저장 */
export function saveAlbumsToStorage(albums: GalleryAlbum[]): void {
  try {
    localStorage.setItem(STORAGE_ALBUMS_KEY, JSON.stringify(albums));
  } catch (error) {
    console.error('Failed to save albums to localStorage:', error);
  }
}

/** 로컬스토리지에서 사진 아이템 목록 로드 (기존 v2 레거시 데이터 무손실 마이그레이션 포함) */
export function loadItemsFromStorage(): GalleryItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_ITEMS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // 기존 묶여있던 다중 사진들도 개별 낱장 카드로 자동 분리
        const flattened: GalleryItem[] = [];
        parsed.forEach((it: any) => {
          if (Array.isArray(it.images) && it.images.length > 1) {
            it.images.forEach((img: string, idx: number) => {
              flattened.push({
                ...it,
                id: `${it.id}-p${idx + 1}`,
                title: `${it.title || '사진'} (${idx + 1})`,
                images: [img],
              });
            });
          } else {
            flattened.push(it);
          }
        });
        return flattened;
      }
    }

    // 구버전 v2 데이터 마이그레이션 호환
    const oldSaved = localStorage.getItem('workfit_gallery_posts_v2');
    if (oldSaved) {
      const oldParsed = JSON.parse(oldSaved);
      if (Array.isArray(oldParsed)) {
        const list: GalleryItem[] = [];
        oldParsed.forEach((p: any) => {
          const imgs = Array.isArray(p.images) ? p.images : p.imageUrl ? [p.imageUrl] : [];
          const baseTitle = p.title || '무제 사진';
          if (imgs.length > 1) {
            imgs.forEach((img: string, idx: number) => {
              list.push({
                id: `${p.id || Date.now()}-p${idx + 1}`,
                title: `${baseTitle} (${idx + 1})`,
                description: p.description || '',
                images: [img],
                albumId: p.folderId && p.folderId.startsWith('alb_') ? p.folderId : 'alb_event',
                date: p.createdAt || new Date().toISOString().split('T')[0],
                authorId: p.authorId,
                authorName: p.authorName || '익명',
                authorDept: p.authorDept || '전사',
                createdAt: p.createdAt || new Date().toISOString().split('T')[0],
              });
            });
          } else {
            list.push({
              id: p.id || `gal-${Date.now()}`,
              title: baseTitle,
              description: p.description || '',
              images: imgs,
              albumId: p.folderId && p.folderId.startsWith('alb_') ? p.folderId : 'alb_event',
              date: p.createdAt || new Date().toISOString().split('T')[0],
              authorId: p.authorId,
              authorName: p.authorName || '익명',
              authorDept: p.authorDept || '전사',
              createdAt: p.createdAt || new Date().toISOString().split('T')[0],
            });
          }
        });
        return list;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/** 사진 목록을 로컬스토리지에 저장 */
export function saveItemsToStorage(items: GalleryItem[]): void {
  try {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save gallery items to localStorage:', error);
  }
}

/**
 * 고해상도 이미지를 브라우저 Canvas로 적정 크기(최대 1920px) 및 압축하여 Base64 용량을 최소화
 */
export function compressImageFile(file: File, maxDimension = 1920, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
