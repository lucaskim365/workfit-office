import type { GalleryFolder, GalleryPhoto } from '@/domain/gallery/schema';

/**
 * 갤러리 초기 시드 데이터 (초기 상태: 빈 배열)
 * - 임의의 샘플 데이터를 임의 생성하지 않고, 사용자가 직접 폴더를 생성하고 사진을 등록하도록 빈 상태 유지
 */
export const GALLERY_FOLDERS_SEED: GalleryFolder[] = [];

export const GALLERY_PHOTOS_SEED: GalleryPhoto[] = [];
