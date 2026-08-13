import { fileStorage } from '@/shared/lib/storage';
import { companyInfoSchema, type CompanyInfo } from '@/domain/companyInfo/schema';
import { COMPANY_INFO_SEED } from '@/data/seeds/companyInfo.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 회사 기본정보 Repository — 단일 문서(싱글톤, id='main').
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const DOC_ID = 'main';

const backend = createCrudBackend<CompanyInfo>({
  coll: 'companyInfo',
  parse: (raw) => {
    const p = companyInfoSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse companyInfo:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (c) => c.id,
  seed: COMPANY_INFO_SEED.map((c) => companyInfoSchema.parse(c)),
});

export const companyInfoRepo = {
  /** 회사 기본정보 단건 조회. 없으면 시드 기본값 반환. */
  async get(): Promise<CompanyInfo> {
    const all = await backend.loadAll();
    return all.find((c) => c.id === DOC_ID) ?? companyInfoSchema.parse(COMPANY_INFO_SEED[0]);
  },

  /** 수정(upsert). 문서 ID = 'main' 고정. */
  async save(info: CompanyInfo): Promise<void> {
    await backend.save(companyInfoSchema.parse({ ...info, id: DOC_ID }));
  },

  /**
   * 회사 로고 업로드 — 이미지는 Storage `branding/`에, 결과 URL·경로를 반환.
   * 화면이 받아 companyInfo.logoUrl/logoPath에 저장(자동저장)한다.
   * prevPath가 있으면 교체 후 이전 파일을 best-effort 삭제.
   * Firebase 미설정이면 base64 data URL로 폴백(세션 한정 미리보기).
   */
  async uploadLogo(file: File, prevPath?: string): Promise<{ url: string; path: string }> {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `branding/company-logo-${Date.now()}.${ext}`;
    const url = await fileStorage.put(path, file, { contentType: file.type || 'image/png' });
    // 교체 시 이전 파일 best-effort 삭제 (data URL 폴백에서는 no-op)
    if (prevPath && prevPath !== path) {
      await fileStorage.remove(prevPath);
    }
    return { url, path };
  },
};
