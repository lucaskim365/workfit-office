import { z } from 'zod';

/**
 * 갤러리 폴더(디렉토리) 스키마
 * - parentId를 통해 무제한 계층(Tree) 디렉토리 지원
 * - 최상위(루트 직속) 폴더는 parentId가 null
 */
export const galleryFolderSchema = z.object({
  id: z.string(),
  name: z.string().min(1, '폴더명을 입력해주세요.'),
  description: z.string().optional().default(''),
  parentId: z.string().nullable().default(null),
  path: z.string().default('/'),
  depth: z.number().default(0),
  order: z.number().default(0),
  coverImageUrl: z.string().optional(),
  isSystem: z.boolean().optional().default(false),
  createdBy: z.string().default('system'),
  creatorName: z.string().default('관리자'),
  creatorDept: z.string().default('전사'),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type GalleryFolder = z.infer<typeof galleryFolderSchema>;

/**
 * 갤러리 사진(파일) 스키마
 * - folderId를 통해 특정 디렉토리에 소속
 * - fileUrl은 S3/Appwrite 스토리지 오브젝트 URL
 */
export const galleryPhotoSchema = z.object({
  id: z.string(),
  folderId: z.string().default('root'),
  title: z.string().default(''),
  caption: z.string().optional().default(''),
  fileUrl: z.string(),
  thumbnailUrl: z.string().optional(),
  fileName: z.string().default(''),
  fileSize: z.number().default(0),
  mimeType: z.string().default('image/jpeg'),
  width: z.number().optional(),
  height: z.number().optional(),
  eventDate: z.string(), // 촬영/행사 일자 YYYY-MM-DD
  authorId: z.string().default('guest'),
  authorName: z.string().default('직원'),
  authorDept: z.string().default('전사'),
  createdAt: z.string(),
});

export type GalleryPhoto = z.infer<typeof galleryPhotoSchema>;
