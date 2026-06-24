import { doc, runTransaction } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';

/**
 * 채번 카운터 Repository — 채널별 시퀀스를 원자적으로 발급.
 * Firebase: counters/{channel} 문서를 트랜잭션으로 증가(동시성 안전).
 * 미설정: in-memory 증가. ([[데이터_모델_설계서.md]] §3 / [[DB_이관_대비_설계원칙.md]])
 */
const COLL = 'counters';
const memory: Record<string, number> = {};

export const counterRepo = {
  /** 채널의 다음 시퀀스(1부터). 예: channel = 'WO-260624'. */
  async next(channel: string): Promise<number> {
    if (isFirebaseConfigured && db) {
      const fdb = db;
      const ref = doc(fdb, COLL, channel);
      return runTransaction(fdb, async (tx) => {
        const snap = await tx.get(ref);
        const seq = ((snap.exists() ? (snap.data().seq as number) : 0) || 0) + 1;
        tx.set(ref, { seq }, { merge: true });
        return seq;
      });
    }
    memory[channel] = (memory[channel] ?? 0) + 1;
    return memory[channel];
  },
};
