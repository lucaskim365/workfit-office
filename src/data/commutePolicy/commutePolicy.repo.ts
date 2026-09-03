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

export const commutePolicyRepo = {
  async list(): Promise<CommutePolicy[]> {
    const list = await backend.loadAll();
    if (list.length === 0) {
      return [DEFAULT_COMMUTE_POLICY];
    }
    return list;
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
    await backend.save(updated);
    return updated;
  },
};
