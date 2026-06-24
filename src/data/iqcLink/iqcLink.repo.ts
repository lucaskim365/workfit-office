import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { iqcLinkSchema, type IqcLink } from '@/domain/iqcLink/schema';
import { IQC_LINK_SEED } from '@/data/seeds/iqcLink.seed';

/**
 * IQC 연동 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'iqcLinks';

export interface IqcLinkFilter {
  iqcStatus?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: IqcLink[] = IQC_LINK_SEED.map((it) => iqcLinkSchema.parse(it));

function applyFilter(rows: IqcLink[], f?: IqcLinkFilter): IqcLink[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.iqcStatus || it.iqcStatus === f.iqcStatus) &&
      (!kw ||
        it.lot.toLowerCase().includes(kw) ||
        it.code.toLowerCase().includes(kw) ||
        it.name.toLowerCase().includes(kw)),
  );
}

export const iqcLinkRepo = {
  /** 전체 조회 + 클라이언트 필터(조회 마스터 규모상 적합). */
  async list(filter?: IqcLinkFilter): Promise<IqcLink[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => iqcLinkSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(lot: string): Promise<IqcLink | null> {
    const rows = await this.list();
    return rows.find((it) => it.lot === lot) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 추적번호(Lot). */
  async save(item: IqcLink): Promise<void> {
    const valid = iqcLinkSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.lot), valid);
      return;
    }
    const i = memory.findIndex((m) => m.lot === valid.lot);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(lot: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, lot));
      return;
    }
    memory = memory.filter((m) => m.lot !== lot);
  },
};
