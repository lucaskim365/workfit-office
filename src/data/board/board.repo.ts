import { postSchema, type Post } from '@/domain/board/schema';
import { BOARD_POSTS_SEED } from '@/data/seeds/board.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 게시판 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임.
 */
const backend = createCrudBackend<Post>({
  coll: 'posts',
  parse: (raw) => {
    const p = postSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse post:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (p) => String(p.id),
  seed: BOARD_POSTS_SEED.map((p) => postSchema.parse(p)),
  jsonFields: ['attachedFiles'],
});

export const boardRepo = {
  /** 전체 조회 */
  async list(): Promise<Post[]> {
    return backend.loadAll();
  },

  async get(id: string): Promise<Post | null> {
    return (await backend.loadAll()).find((p) => String(p.id) === id) ?? null;
  },

  /** 등록/수정(upsert) */
  async save(item: Post): Promise<void> {
    await backend.save(postSchema.parse(item));
  },

  /** 삭제 */
  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },
};
