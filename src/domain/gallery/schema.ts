import { z } from 'zod';

/**
 * 갤러리 폴더(디렉토리) 스키마
 * - parentId를 통해 무제한 계층(Tree) 디렉토리 지원
 * - 최상위(루트 직속) 폴더는 parentId가 null
 */
const nullToUndefined = (v: unknown) => (v === null ? undefined : v);

export const galleryFolderSchema = z.object({
  id: z.string(),
  name: z.string().min(1, '폴더명을 입력해주세요.'),
  description: z.preprocess(nullToUndefined, z.string().optional().default('')),
  parentId: z.preprocess((v) => (v === '' ? null : v), z.string().nullable().default(null)),
  path: z.string().default('/'),
  depth: z.number().default(0),
  order: z.number().default(0),
  coverImageUrl: z.preprocess(nullToUndefined, z.string().optional()),
  isSystem: z.preprocess(nullToUndefined, z.boolean().optional().default(false)),
  createdBy: z.string().default('system'),
  creatorName: z.string().default('관리자'),
  creatorDept: z.string().default('전사'),
  createdAt: z.string(),
  updatedAt: z.preprocess(nullToUndefined, z.string().optional()),
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
  title: z.preprocess(nullToUndefined, z.string().optional().default('')),
  caption: z.preprocess(nullToUndefined, z.string().optional().default('')),
  fileUrl: z.string(),
  thumbnailUrl: z.preprocess(nullToUndefined, z.string().optional()),
  fileName: z.preprocess(nullToUndefined, z.string().optional().default('')),
  fileSize: z.preprocess(nullToUndefined, z.number().optional().default(0)),
  mimeType: z.preprocess(nullToUndefined, z.string().optional().default('image/jpeg')),
  width: z.preprocess(nullToUndefined, z.number().optional()),
  height: z.preprocess(nullToUndefined, z.number().optional()),
  eventDate: z.preprocess(nullToUndefined, z.string().optional().default('')),
  authorId: z.string().default('guest'),
  authorName: z.string().default('직원'),
  authorDept: z.string().default('전사'),
  createdAt: z.string(),
});

export type GalleryPhoto = z.infer<typeof galleryPhotoSchema>;
