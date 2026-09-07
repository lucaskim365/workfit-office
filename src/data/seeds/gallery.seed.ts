export interface GalleryFolder {
  id: string;
  name: string;
  icon?: string;
  isSystem?: boolean;
}

export interface GalleryPost {
  id: string;
  title: string;
  description: string;
  images: string[]; // 다중 이미지 DataURL / URL 목록
  folderId?: string; // 소속 폴더 ID (기본: 'f_event' 등)
  authorId?: string;
  authorName: string;
  authorDept: string;
  createdAt: string; // YYYY-MM-DD
  updatedAt?: string; // YYYY-MM-DD
  isEdited?: boolean;
  likes?: number;
}

export const DEFAULT_GALLERY_FOLDERS: GalleryFolder[] = [
  { id: 'f_event', name: '사내 행사', icon: '🎉', isSystem: true },
  { id: 'f_workshop', name: '워크숍 & 세미나', icon: '🏕️', isSystem: true },
  { id: 'f_club', name: '동호회 & 소모임', icon: '⚽', isSystem: true },
  { id: 'f_project', name: '프로젝트 활동', icon: '🚀', isSystem: true },
  { id: 'f_etc', name: '기타 미디어', icon: '📁', isSystem: true },
];

export const INITIAL_GALLERY_POSTS: GalleryPost[] = [];

