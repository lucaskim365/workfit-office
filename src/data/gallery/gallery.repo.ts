import { createCrudBackend } from '@/data/_backend/crudBackend';
import {
  galleryFolderSchema,
  galleryPhotoSchema,
  type GalleryFolder,
  type GalleryPhoto,
} from '@/domain/gallery/schema';
import { GALLERY_FOLDERS_SEED, GALLERY_PHOTOS_SEED } from '@/data/seeds/gallery.seed';

/**
 * 갤러리 폴더(디렉토리) 저장소
 * - 공용 CRUD 백엔드 어댑터를 통해 DB(Appwrite/Firestore/Memory)와 동기화
 */
const folderBackend = createCrudBackend<GalleryFolder>({
  coll: 'gallery_folders',
  parse: (raw) => {
    const res = galleryFolderSchema.safeParse(raw);
    if (!res.success) {
      console.warn('[gallery.repo] Invalid folder row:', res.error);
      return null;
    }
    return res.data;
  },
  idOf: (f) => f.id,
  seed: GALLERY_FOLDERS_SEED.map((f) => galleryFolderSchema.parse(f)),
});

/**
 * 갤러리 사진 저장소
 */
const photoBackend = createCrudBackend<GalleryPhoto>({
  coll: 'gallery_photos',
  parse: (raw) => {
    const res = galleryPhotoSchema.safeParse(raw);
    if (!res.success) {
      console.warn('[gallery.repo] Invalid photo row:', res.error);
      return null;
    }
    return res.data;
  },
  idOf: (p) => p.id,
  seed: GALLERY_PHOTOS_SEED.map((p) => galleryPhotoSchema.parse(p)),
});

export const galleryRepo = {
  // ── 폴더(디렉토리) 관리 ──
  async listFolders(): Promise<GalleryFolder[]> {
    return folderBackend.loadAll();
  },

  async saveFolder(folder: GalleryFolder): Promise<void> {
    await folderBackend.save(galleryFolderSchema.parse(folder));
  },

  async removeFolder(folderId: string): Promise<void> {
    await folderBackend.remove(folderId);
  },

  // ── 사진 파일 관리 ──
  async listPhotos(): Promise<GalleryPhoto[]> {
    return photoBackend.loadAll();
  },

  async savePhoto(photo: GalleryPhoto): Promise<void> {
    await photoBackend.save(galleryPhotoSchema.parse(photo));
  },

  async removePhoto(photoId: string): Promise<void> {
    await photoBackend.remove(photoId);
  },

  /** 사진 일괄 이동 */
  async batchMovePhotos(photoIds: string[], targetFolderId: string): Promise<void> {
    const all = await photoBackend.loadAll();
    const targets = all.filter((p) => photoIds.includes(p.id));
    for (const p of targets) {
      await photoBackend.save({ ...p, folderId: targetFolderId });
    }
  },

  /** 사진 일괄 복사 */
  async batchCopyPhotos(
    photoIds: string[],
    targetFolderId: string,
    author: { id: string; name: string; dept: string },
  ): Promise<void> {
    const all = await photoBackend.loadAll();
    const targets = all.filter((p) => photoIds.includes(p.id));
    const now = new Date().toISOString();
    for (const p of targets) {
      const copyId = `pht_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await photoBackend.save({
        ...p,
        id: copyId,
        folderId: targetFolderId,
        authorId: author.id,
        authorName: author.name,
        authorDept: author.dept,
        createdAt: now,
      });
    }
  },

  /** 사진 일괄 삭제 */
  async batchDeletePhotos(photoIds: string[]): Promise<void> {
    for (const id of photoIds) {
      await photoBackend.remove(id);
    }
  },
};
