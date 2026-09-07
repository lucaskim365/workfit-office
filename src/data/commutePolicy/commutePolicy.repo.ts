import { createCrudBackend } from '@/data/_backend/crudBackend';
import {
  commutePolicySchema,
  DEFAULT_COMMUTE_POLICY,
  type CommutePolicy,
} from '@/domain/commutePolicy/schema';
import { nowLocalIso } from '@/shared/lib/datetime';

const backend = createCrudBackend<CommutePolicy>({
  coll: 'commutePolicies',
  parse: (raw) => {
    const p = commutePolicySchema.safeParse(raw);
    return p.success ? p.data : null;
  },
  idOf: (item) => item.id,
  seed: [DEFAULT_COMMUTE_POLICY],
});

const LOCAL_STORAGE_KEY = 'workfit.commutePolicy';

function loadLocalPolicy(): CommutePolicy | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = commutePolicySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveLocalPolicy(policy: CommutePolicy): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(policy));
  } catch {
    /* noop */
  }
}

export const commutePolicyRepo = {
  async list(): Promise<CommutePolicy[]> {
    try {
      const list = await backend.loadAll();
      if (list.length > 0) return list;
    } catch (e) {
      // 컬렉션이 없거나 일시 오류인 경우 로컬 캐시 또는 기본 정책으로 폴백
      console.warn('commutePolicies backend load failed, fallback to local/default:', e);
    }
    const local = loadLocalPolicy();
    return [local || DEFAULT_COMMUTE_POLICY];
  },

  async getDefault(): Promise<CommutePolicy> {
    const list = await this.list();
    const found = list.find((p) => p.isDefault) || list[0];
    return found || DEFAULT_COMMUTE_POLICY;
  },

  async save(policy: CommutePolicy, actorName?: string): Promise<CommutePolicy> {
    const updated: CommutePolicy = commutePolicySchema.parse({
      ...policy,
      updatedAt: nowLocalIso(),
      updatedBy: actorName || '관리자',
    });
    // 브라우저 로컬 저장 우선 보장
    saveLocalPolicy(updated);
    try {
      await backend.save(updated);
    } catch (e) {
      console.warn('commutePolicies backend save failed, saved locally:', e);
    }
    return updated;
  },
};
