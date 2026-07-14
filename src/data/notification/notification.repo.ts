import { collection, doc, getDocs, setDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { nowLocalIso } from '@/shared/lib/datetime';
import { notificationSchema, type LiveNotification } from '@/domain/liveNotification/schema';

const COLL = 'notifications';

let memory: LiveNotification[] = [];
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function nextId(rows: LiveNotification[]): string {
  const max = rows.reduce((m, r) => {
    const n = Number(r.id.replace(/\D/g, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `NT-${String(max + 1).padStart(4, '0')}`;
}

export const notificationRepo = {
  async list(userId: string): Promise<LiveNotification[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const list = snap.docs
        .map((d) => notificationSchema.parse(d.data()))
        .filter((n) => n.userId === userId);
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      const list = memory.filter((n) => n.userId === userId);
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  },

  async create(input: {
    userId: string;
    type: LiveNotification['type'];
    title: string;
    text: string;
    senderName: string;
    linkUrl?: string | null;
  }): Promise<LiveNotification> {
    const id = isFirebaseConfigured && db ? doc(collection(db, COLL)).id : nextId(memory);
    const noti: LiveNotification = {
      id,
      userId: input.userId,
      type: input.type,
      title: input.title,
      text: input.text,
      senderName: input.senderName,
      linkUrl: input.linkUrl ?? null,
      read: false,
      createdAt: nowLocalIso(),
    };

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, id), noti);
    } else {
      memory.push(noti);
      notifyListeners();
    }
    return noti;
  },

  async markAsRead(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      const ref = doc(db, COLL, id);
      // Fetch current doc to get full structure
      const snap = await getDocs(collection(db, COLL));
      const found = snap.docs.find((d) => d.id === id);
      if (found) {
        const noti = { ...found.data(), read: true };
        await setDoc(ref, noti);
      }
    } else {
      const idx = memory.findIndex((n) => n.id === id);
      if (idx !== -1) {
        memory[idx] = { ...memory[idx], read: true };
        notifyListeners();
      }
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const targetDocs = snap.docs.filter((d) => d.data().userId === userId && !d.data().read);
      for (const d of targetDocs) {
        await setDoc(doc(db, COLL, d.id), { ...d.data(), read: true });
      }
    } else {
      memory = memory.map((n) => (n.userId === userId ? { ...n, read: true } : n));
      notifyListeners();
    }
  },

  subscribe(userId: string, callback: (notis: LiveNotification[]) => void): () => void {
    if (isFirebaseConfigured && db) {
      const q = query(collection(db, COLL), where('userId', '==', userId));
      return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map((d) => notificationSchema.parse(d.data()));
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callback(list);
      }, (err) => {
        console.warn('Firestore notifications subscription failed (possibly permission-denied). Fallback to empty list:', err);
        callback([]);
      });
    } else {
      const listener = () => {
        const list = memory.filter((n) => n.userId === userId);
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callback(list);
      };
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    }
  },
};
