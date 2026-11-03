import { fileStorage } from '@/shared/lib/storage';
import { createCrudBackend } from '@/data/_backend/crudBackend';
import { companyMarkSchema, newMarkId, type CompanyMark, type CompanyMarkKind } from '@/domain/companyMark/schema';

/**
 * 회사 로고·직인 목록 Repository — companyMarks 컬렉션.
 * 대표 지정은 회사 기본정보(companyInfo) 쪽에서 한다(그림 주소를 그대로 복사).
 */
const backend = createCrudBackend<CompanyMark>({
  coll: 'companyMarks',
  parse: (raw) => {
    const p = companyMarkSchema.safeParse(raw);
    return p.success ? p.data : null;
  },
  idOf: (x) => x.id,
  seed: [],
});

export const companyMarkRepo = {
  async list(): Promise<CompanyMark[]> {
    return backend.loadAll();
  },

  /** 그림을 올리고 목록에 더한다 — 저장소 서명 규칙상 chat/ 아래 경로. 파일은 지우지 않는다(완료 문서가 쓸 수 있음) */
  async add(kind: CompanyMarkKind, name: string, file: File, order: number): Promise<CompanyMark> {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `chat/branding/company-${kind}-${Date.now()}.${ext}`;
    const url = await fileStorage.put(path, file, { contentType: file.type || 'image/png' });
    const mark = companyMarkSchema.parse({ id: newMarkId(), kind, name, url, path, order });
    await backend.insert(mark);
    return mark;
  },

  /** 이미 올라가 있는 그림(예: 예전 대표 로고·직인)을 목록에 넣는다 */
  async addExisting(kind: CompanyMarkKind, name: string, url: string, path: string, order: number): Promise<CompanyMark> {
    const mark = companyMarkSchema.parse({ id: newMarkId(), kind, name, url, path, order });
    await backend.insert(mark);
    return mark;
  },

  /** 이름·순서 고치기 */
  async save(mark: CompanyMark): Promise<void> {
    await backend.save(companyMarkSchema.parse(mark));
  },

  /** 목록에서 뺀다 — 그림 파일은 남긴다(이미 낸 문서·대표가 같은 주소를 쓸 수 있음) */
  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },
};
