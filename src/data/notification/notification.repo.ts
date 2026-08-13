import { collection, doc, getDocs, setDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import {
  client as appwriteClient,
  databases,
  APPWRITE_DATABASE_ID,
  ID,
  Query,
} from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';
import { nowLocalIso } from '@/shared/lib/datetime';
import { notificationSchema, type LiveNotification } from '@/domain/liveNotification/schema';

/**
 * 실시간 알림 Repository — Firestore→Appwrite 이관 PoC(Phase 1) **Realtime 검증 대상**.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] §5-A 실시간)
 *
 * 공개 인터페이스(list/create/markAsRead/markAllAsRead/removePendingRequests/subscribe)는
 * 불변. 저장·구독 백엔드만 VITE_DB_DRIVER 로 교체된다.
 *   - onSnapshot(Firestore) ↔ client.subscribe(Appwrite Realtime) 를 subscribe() 뒤에 격리.
 */
const COLL = 'notifications';

interface NotificationBackend {
  list(userId: string): Promise<LiveNotification[]>;
  create(noti: LiveNotification): Promise<LiveNotification>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  removePendingRequests(docId: string): Promise<void>;
  /** userId 대상 실시간 구독. 변경 시 최신 목록으로 callback. 해지 함수 반환. */
  subscribe(userId: string, callback: (notis: LiveNotification[]) => void): () => void;
  /** create 시 부여할 새 id(백엔드별 규칙). */
  newId(): string;
}

const byNewestFirst = (list: LiveNotification[]) =>
  [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

function isPendingApprovalRequest(n: LiveNotification, docId: string): boolean {
  return Boolean(
    !n.read && n.linkUrl && n.linkUrl.includes(docId) && n.type === '결재' && n.title === '결재 요청',
  );
}

// ─────────────────────────────────────────────────────────────
// 1) In-memory 백엔드 (미설정 폴백)
// ─────────────────────────────────────────────────────────────
class MemoryBackend implements NotificationBackend {
  private rows: LiveNotification[] = [];
  private listeners = new Set<() => void>();
  private emit() {
    this.listeners.forEach((l) => l());
  }
  newId() {
    const max = this.rows.reduce((m, r) => {
      const n = Number(r.id.replace(/\D/g, ''));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `NT-${String(max + 1).padStart(4, '0')}`;
  }
  async list(userId: string) {
    return byNewestFirst(this.rows.filter((n) => n.userId === userId));
  }
  async create(noti: LiveNotification) {
    this.rows.push(noti);
    this.emit();
    return noti;
  }
  async markAsRead(id: string) {
    const i = this.rows.findIndex((n) => n.id === id);
    if (i !== -1) {
      this.rows[i] = { ...this.rows[i], read: true };
      this.emit();
    }
  }
  async markAllAsRead(userId: string) {
    this.rows = this.rows.map((n) => (n.userId === userId ? { ...n, read: true } : n));
    this.emit();
  }
  async removePendingRequests(docId: string) {
    this.rows = this.rows.filter((n) => !isPendingApprovalRequest(n, docId));
    this.emit();
  }
  subscribe(userId: string, callback: (notis: LiveNotification[]) => void) {
    const listener = () => {
      void this.list(userId).then(callback);
    };
    this.listeners.add(listener);
    listener();
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 2) Firestore 백엔드 (현행 — onSnapshot 실시간)
// ─────────────────────────────────────────────────────────────
class FirestoreBackend implements NotificationBackend {
  newId() {
    return doc(collection(db!, COLL)).id;
  }
  async list(userId: string) {
    const snap = await getDocs(collection(db!, COLL));
    return byNewestFirst(
      snap.docs.map((d) => notificationSchema.parse(d.data())).filter((n) => n.userId === userId),
    );
  }
  async create(noti: LiveNotification) {
    await setDoc(doc(db!, COLL, noti.id), noti);
    return noti;
  }
  async markAsRead(id: string) {
    const snap = await getDocs(collection(db!, COLL));
    const found = snap.docs.find((d) => d.id === id);
    if (found) await setDoc(doc(db!, COLL, id), { ...found.data(), read: true });
  }
  async markAllAsRead(userId: string) {
    const snap = await getDocs(collection(db!, COLL));
    for (const d of snap.docs.filter((x) => x.data().userId === userId && !x.data().read)) {
      await setDoc(doc(db!, COLL, d.id), { ...d.data(), read: true });
    }
  }
  async removePendingRequests(docId: string) {
    const snap = await getDocs(collection(db!, COLL));
    for (const d of snap.docs.filter((x) =>
      isPendingApprovalRequest(notificationSchema.parse(x.data()), docId),
    )) {
      await deleteDoc(doc(db!, COLL, d.id));
    }
  }
  subscribe(userId: string, callback: (notis: LiveNotification[]) => void) {
    const q = query(collection(db!, COLL), where('userId', '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        callback(byNewestFirst(snapshot.docs.map((d) => notificationSchema.parse(d.data()))));
      },
      (err) => {
        console.warn('[notifications] Firestore 구독 실패(권한 등) → 빈 목록 폴백:', err);
        callback([]);
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 3) Appwrite 백엔드 (이관 목표 — Realtime = client.subscribe)
//    실시간: 이벤트 발생 시 최신 목록을 재조회해 onSnapshot 과 동일한 "전체 목록" 시맨틱 유지.
//    채널: Appwrite 버전별로 documents(구) / rows(1.9 TablesDB) 표기가 달라 둘 다 구독한다.
//    ⚠️ 구독 수신은 컬렉션에 read 권한이 있어야 한다(보고서 이슈: 권한 [] → 이벤트 미수신).
// ─────────────────────────────────────────────────────────────
class AppwriteBackend implements NotificationBackend {
  private get dbs() {
    return databases!;
  }
  private channels(): string[] {
    const d = APPWRITE_DATABASE_ID;
    return [
      `databases.${d}.collections.${COLL}.documents`, // 구 표기
      `databases.${d}.tables.${COLL}.rows`, // 1.9 TablesDB 표기
    ];
  }
  private toAttrs(n: LiveNotification): Record<string, unknown> {
    return {
      userId: n.userId,
      type: n.type,
      title: n.title,
      text: n.text,
      senderName: n.senderName,
      linkUrl: n.linkUrl ?? null,
      read: n.read,
      createdAt: n.createdAt,
    };
  }
  private fromRow(row: Record<string, unknown> & { $id: string }): LiveNotification {
    return notificationSchema.parse({ ...row, id: row.$id });
  }
  newId() {
    return ID.unique();
  }
  async list(userId: string) {
    const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, COLL, [
      Query.equal('userId', userId),
      Query.orderDesc('createdAt'),
      Query.limit(100),
    ]);
    return (res.documents as unknown as Array<Record<string, unknown> & { $id: string }>).map((r) =>
      this.fromRow(r),
    );
  }
  async create(noti: LiveNotification) {
    const created = await this.dbs.createDocument(
      APPWRITE_DATABASE_ID,
      COLL,
      noti.id,
      this.toAttrs(noti),
    );
    return this.fromRow(created as unknown as Record<string, unknown> & { $id: string });
  }
  async markAsRead(id: string) {
    await this.dbs.updateDocument(APPWRITE_DATABASE_ID, COLL, id, { read: true });
  }
  async markAllAsRead(userId: string) {
    const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, COLL, [
      Query.equal('userId', userId),
      Query.equal('read', false),
      Query.limit(100),
    ]);
    for (const r of res.documents as unknown as Array<{ $id: string }>) {
      await this.dbs.updateDocument(APPWRITE_DATABASE_ID, COLL, r.$id, { read: true });
    }
  }
  async removePendingRequests(docId: string) {
    const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, COLL, [
      Query.equal('type', '결재'),
      Query.equal('title', '결재 요청'),
      Query.equal('read', false),
      Query.limit(100),
    ]);
    for (const r of res.documents as unknown as Array<Record<string, unknown> & { $id: string }>) {
      const n = this.fromRow(r);
      if (isPendingApprovalRequest(n, docId)) {
        await this.dbs.deleteDocument(APPWRITE_DATABASE_ID, COLL, r.$id);
      }
    }
  }
  subscribe(userId: string, callback: (notis: LiveNotification[]) => void) {
    // 초기 1회 로드
    void this.list(userId).then(callback);
    // 이벤트 발생 시 최신 목록 재조회(userId 필터는 재조회 쿼리에서 처리)
    const unsub = appwriteClient!.subscribe(this.channels(), () => {
      void this.list(userId).then(callback);
    });
    return unsub;
  }
}

// ─────────────────────────────────────────────────────────────
// 활성 백엔드 선택
// ─────────────────────────────────────────────────────────────
function selectBackend(): NotificationBackend {
  switch (dbDriver) {
    case 'appwrite':
      return new AppwriteBackend();
    case 'firestore':
      return new FirestoreBackend();
    default:
      return new MemoryBackend();
  }
}
const backend: NotificationBackend = selectBackend();

export const notificationRepo = {
  list(userId: string): Promise<LiveNotification[]> {
    return backend.list(userId);
  },

  async create(input: {
    userId: string;
    type: LiveNotification['type'];
    title: string;
    text: string;
    senderName: string;
    linkUrl?: string | null;
  }): Promise<LiveNotification> {
    const noti: LiveNotification = {
      id: backend.newId(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      text: input.text,
      senderName: input.senderName,
      linkUrl: input.linkUrl ?? null,
      read: false,
      createdAt: nowLocalIso(),
    };
    return backend.create(noti);
  },

  markAsRead(id: string): Promise<void> {
    return backend.markAsRead(id);
  },

  markAllAsRead(userId: string): Promise<void> {
    return backend.markAllAsRead(userId);
  },

  removePendingRequests(docId: string): Promise<void> {
    return backend.removePendingRequests(docId);
  },

  subscribe(userId: string, callback: (notis: LiveNotification[]) => void): () => void {
    return backend.subscribe(userId, callback);
  },
};
