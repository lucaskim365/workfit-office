import type { GalleryFolder, GalleryPhoto } from '@/domain/gallery/schema';

export type { GalleryFolder, GalleryPhoto };

/**
 * 기존 UI 호환용 앨범 인터페이스
 */
export interface GalleryAlbum {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  createdAt?: string;
  isSystem?: boolean;
}

/**
 * 갤러리 UI 호환 사진 아이템 타입
 */
export interface GalleryItem extends GalleryPhoto {
  /** 기존 UI 호환용 다중/단일 이미지 URL 배열 */
  images: string[];
  /** 기존 UI 호환용 설명 */
  description: string;
  /** 기존 UI 호환용 폴더 ID */
  albumId: string;
  /** 기존 UI 호환용 일자 (YYYY-MM-DD) */
  date: string;
}

export interface UploadImageItem {
  id: string;
  url: string;
  caption: string;
}

export interface TimelineMonthGroup {
  ym: string;
  monthStr: string;
  count: number;
}

export interface TimelineYearGroup {
  year: string;
  count: number;
  months: TimelineMonthGroup[];
}

export interface DateGroupedItems {
  dateKey: string;
  displayDate: string;
  items: GalleryItem[];
}

export type YearGroup = TimelineYearGroup;
export type DateGroup = DateGroupedItems;

/**
 * GalleryPhoto -> GalleryItem 변환 헬퍼
 */
export function toGalleryItem(p: GalleryPhoto): GalleryItem {
  return {
    ...p,
    images: [p.fileUrl],
    description: p.caption || p.title || '',
    albumId: p.folderId,
    date: p.eventDate,
  };
}
