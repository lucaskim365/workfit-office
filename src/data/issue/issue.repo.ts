import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { issueSchema, type Issue, type IssueStatus } from '@/domain/issue/schema';
import { ISSUE_SEED } from '@/data/seeds/issue.seed';

/**
 * 불출 Repository — header(materials 임베드) + 상태 전이. 재고 반영은 services/issuing.service.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'issues';

let memory: Issue[] = ISSUE_SEED.map((i) => issueSchema.parse(i));

async function persist(x: Issue): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, x.no), x);
    return;
  }
  const i = memory.findIndex((m) => m.no === x.no);
  if (i >= 0) memory[i] = x;
  else memory = [x, ...memory];
}

export const issueRepo = {
  async list(): Promise<Issue[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => issueSchema.parse(d.data()));
    }
    return memory;
  },

  async get(no: string): Promise<Issue | null> {
    return (await this.list()).find((i) => i.no === no) ?? null;
  },

  async setStatus(no: string, status: IssueStatus): Promise<void> {
    const x = await this.get(no);
    if (!x) throw new Error(`불출 없음: ${no}`);
    await persist(issueSchema.parse({ ...x, status }));
  },
};
