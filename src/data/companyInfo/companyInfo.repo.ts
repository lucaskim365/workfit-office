import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { companyInfoSchema, type CompanyInfo } from '@/domain/companyInfo/schema';
import { COMPANY_INFO_SEED } from '@/data/seeds/companyInfo.seed';

/**
 * 회사 기본정보 Repository — 단일 문서(싱글톤, id='main').
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'companyInfo';
const DOC_ID = 'main';

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: CompanyInfo = companyInfoSchema.parse(COMPANY_INFO_SEED[0]);

export const companyInfoRepo = {
  /** 회사 기본정보 단건 조회. 없으면 시드 기본값 반환. */
  async get(): Promise<CompanyInfo> {
    if (isFirebaseConfigured && db) {
      const snap = await getDoc(doc(db, COLL, DOC_ID));
      if (snap.exists()) return companyInfoSchema.parse(snap.data());
      return companyInfoSchema.parse(COMPANY_INFO_SEED[0]);
    }
    return memory;
  },

  /** 수정(upsert). 문서 ID = 'main' 고정. */
  async save(info: CompanyInfo): Promise<void> {
    const valid = companyInfoSchema.parse({ ...info, id: DOC_ID });
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, DOC_ID), valid);
      return;
    }
    memory = valid;
  },
};
