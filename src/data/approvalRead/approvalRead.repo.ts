import { createCrudBackend, type CrudBackend } from '@/data/_backend/crudBackend';
import { Query } from '@/shared/lib/appwrite';
import {
  approvalReadId,
  approvalReadSchema,
  BASELINE_DOC_ID,
  isMarkerDocId,
  REJECT_BASELINE_DOC_ID,
  type ApprovalRead,
} from '@/domain/approvalRead/schema';

/**
 * 전자결재 읽음 기록 저장소(`approvalReads`). 한 사람·한 문서당 한 행이고 처음 읽은 시각만 남긴다.
 * 예전 반려함 열람 기록은 브라우저 localStorage 에만 있어 기기마다 달랐다 — 이제 DB 하나로 모은다.
 */
const appBackend = createCrudBackend<ApprovalRead>({
  coll: 'approvalReads',
  parse: (raw) => {
    const p = approvalReadSchema.safeParse(raw);
    return p.success ? p.data : null;
  },
  idOf: (r) => r.id,
  seed: [],
  stripFields: ['id'], // 컬렉션에 id 속성이 없다 — 문서 $id 로 저장되고 읽을 때 복원된다
});

const isConflict = (err: unknown) => (err as { code?: number } | null)?.code === 409;

export function createApprovalReadRepo(backend: CrudBackend<ApprovalRead>) {
  async function rowsOf(userId: string): Promise<ApprovalRead[]> {
    const rows = await backend.loadWithQueries([Query.equal('userId', userId)]);
    return rows.filter((r) => r.userId === userId); // 쿼리를 무시하는 백엔드(메모리)에서도 본인 것만
  }

  async function writeMissing(userId: string, docIds: string[], now: Date): Promise<void> {
    const have = new Set((await rowsOf(userId)).map((r) => r.docId));
    const readAt = now.toISOString();
    for (const docId of new Set(docIds)) {
      if (have.has(docId)) continue; // 한 번 읽으면 끝 — 처음 읽은 시각을 덮어쓰지 않는다
      try {
        await backend.save({ id: approvalReadId(userId, docId), userId, docId, readAt });
      } catch (err) {
        // 다른 탭·같은 화면의 동시 기록이 먼저 만들었다 — 원하던 상태(읽음)이므로 실패가 아니다
        if (!isConflict(err)) throw err;
      }
    }
  }

  return {
    rowsOf,

    /** 읽은 문서 목록과 처음 적용 기준선을 남겼는지 */
    async readState(userId: string): Promise<{ readDocIds: Set<string>; hasBaseline: boolean; hasRejectBaseline: boolean }> {
      const rows = await rowsOf(userId);
      return {
        readDocIds: new Set(rows.filter((r) => !isMarkerDocId(r.docId)).map((r) => r.docId)),
        hasBaseline: rows.some((r) => r.docId === BASELINE_DOC_ID),
        hasRejectBaseline: rows.some((r) => r.docId === REJECT_BASELINE_DOC_ID),
      };
    },

    /** 문서를 읽음으로 기록(이미 있으면 그대로) */
    async markRead(userId: string, docIds: string[], now: Date = new Date()): Promise<void> {
      await writeMissing(userId, docIds.filter((id) => !isMarkerDocId(id)), now);
    },

    /** 처음 적용 기준선 — 기존 문서(반려함 포함)를 읽음으로 남기고 기준선 표시 행 둘을 쓴다(한 사람당 한 번) */
    async applyBaseline(userId: string, docIds: string[], now: Date = new Date()): Promise<void> {
      await writeMissing(userId, [...docIds.filter((id) => !isMarkerDocId(id)), BASELINE_DOC_ID, REJECT_BASELINE_DOC_ID], now);
    },

    /**
     * 반려함 기준선 — 기준선을 이미 남긴 사람이 반려함을 처음 조회할 때 한 번.
     * 그때 반려함에 있던 문서를 읽음으로 남겨, 예전 반려 문서에 빨간 동그라미가 뜨지 않게 한다.
     */
    async applyRejectBaseline(userId: string, docIds: string[], now: Date = new Date()): Promise<void> {
      await writeMissing(userId, [...docIds.filter((id) => !isMarkerDocId(id)), REJECT_BASELINE_DOC_ID], now);
    },
  };
}

export const approvalReadRepo = createApprovalReadRepo(appBackend);
