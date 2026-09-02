export interface GalleryPost {
  id: string;
  title: string;
  description: string;
  images: string[]; // 다중 이미지 DataURL / URL 목록
  authorId?: string;
  authorName: string;
  authorDept: string;
  createdAt: string; // YYYY-MM-DD
  updatedAt?: string; // YYYY-MM-DD
  isEdited?: boolean;
  likes?: number;
}

export const INITIAL_GALLERY_POSTS: GalleryPost[] = [];
