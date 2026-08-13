import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import { databases, APPWRITE_DATABASE_ID, assertAppwriteId } from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';

/**
 * 채번 카운터 Repository — 채널별 시퀀스를 **원자적으로** 발급.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] §5-B / Phase 2 격리영역)
 *
 * 백엔드별 원자성 보장:
 *   - Firestore : runTransaction (읽고-증가-쓰기 원자화)
 *   - Appwrite  : incrementDocumentAttribute (서버측 원자 증가 — 1.9 네이티브)
 *   - memory    : 단일 스레드 in-memory
 * 예: channel = 'AP-260813' → 1, 2, 3 …  동시 호출에도 중복·누락 없음.
 */
const COLL = 'counters';

interface CounterBackend {
  next(channel: string): Promise<number>;
}

// 1) In-memory (미설정 폴백)
class MemoryBackend implements CounterBackend {
  private m: Record<string, number> = {};
  async next(channel: string) {
    this.m[channel] = (this.m[channel] ?? 0) + 1;
    return this.m[channel];
  }
}

// 2) Firestore (현행 — 트랜잭션)
class FirestoreBackend implements CounterBackend {
  async next(channel: string) {
    const fdb = db!;
    const ref = doc(fdb, COLL, channel);
    return runTransaction(fdb, async (tx) => {
      const snap = await tx.get(ref);
      const seq = ((snap.exists() ? (snap.data().seq as number) : 0) || 0) + 1;
      tx.set(ref, { seq }, { merge: true });
      return seq;
    });
  }
}

// 3) Appwrite (원자 증가) — counters/{channel}.seq 를 서버에서 +1 (경합 안전)
class AppwriteBackend implements CounterBackend {
  private get dbs() {
    return databases!;
  }
  private seqOf(d: unknown): number {
    return (d as { seq: number }).seq;
  }
  async next(channel: string): Promise<number> {
    const id = assertAppwriteId(channel);
    try {
      // 기존 채널: 서버측 원자 증가(경합 안전) 후 새 값 반환.
      const d = await this.dbs.incrementDocumentAttribute(APPWRITE_DATABASE_ID, COLL, id, 'seq', 1);
      return this.seqOf(d);
    } catch (e) {
      const code = (e as { code?: number })?.code;
      // 최초 발급(문서 미존재). ⚠ 이 설치(MongoDB primary)는 미존재 문서 증가 시
      // 404 가 아니라 500 을 반환하므로 둘 다 "시드 필요"로 간주한다.
      if (code !== 404 && code !== 500) throw e;
      // seq=0 시드 생성 → 첫 증가가 1. 동시 최초호출은 하나만 성공(409)하고
      // 나머지는 409 를 무시한 뒤 원자 증가로 2,3,… 을 받는다 → 중복 없음.
      try {
        await this.dbs.createDocument(APPWRITE_DATABASE_ID, COLL, id, { seq: 0 });
      } catch (e2) {
        if ((e2 as { code?: number })?.code !== 409) throw e2;
      }
      const d = await this.dbs.incrementDocumentAttribute(APPWRITE_DATABASE_ID, COLL, id, 'seq', 1);
      return this.seqOf(d);
    }
  }
}

function selectBackend(): CounterBackend {
  switch (dbDriver) {
    case 'appwrite':
      return new AppwriteBackend();
    case 'firestore':
      return new FirestoreBackend();
    default:
      return new MemoryBackend();
  }
}
const backend: CounterBackend = selectBackend();

export const counterRepo = {
  /** 채널의 다음 시퀀스(1부터). 원자적 — 동시 호출에도 유일 값 보장. */
  next(channel: string): Promise<number> {
    return backend.next(channel);
  },
};
