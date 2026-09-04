import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import { databases, APPWRITE_DATABASE_ID, Query, safeDocId } from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';

/**
 * 공유 CRUD 백엔드 어댑터 — Phase 3 보존 repo 일괄 전환용.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 *
 * 저장 원시연산(loadAll/save/remove)만 제공. 각 repo의 파생 로직(list 필터·get·
 * 커스텀 메서드)은 그대로 두고 저장 접근만 이 백엔드로 위임한다.
 * 백엔드는 VITE_DB_DRIVER 로 Memory/Firestore/Appwrite 를 선택.
 *
 * 옵션:
 *  - jsonFields   : Appwrite 저장 시 JSON 문자열로 직렬화할 중첩 필드(배열-of-객체·record 등).
 *                   Appwrite 속성은 스칼라/스칼라배열만 가능하므로 중첩은 문자열로.
 *  - firestoreEncode/Decode : Firestore 전용 코덱(중첩 배열 제약 회피 — authRole/roleGroup).
 */
export interface CrudBackend<T> {
  loadAll(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface CrudOpts<T> {
  coll: string;
  /** 안전 파싱: 성공 시 T, 실패 시 null(스킵). 불량 문서 1건이 전체를 깨지 않게. */
  parse: (raw: unknown) => T | null;
  /** 문서 $id 추출(예: item.id / item.code / `${a}__${b}`). */
  idOf: (item: T) => string;
  /** in-memory 폴백 시드. */
  seed: T[];
  /** Appwrite: JSON 직렬화할 중첩 필드명. */
  jsonFields?: string[];
  /** Appwrite: 저장 전 페이로드에서 제외할 클라이언트 전용 필드명. */
  stripFields?: string[];
  /** Firestore write 인코더(중첩 배열 코덱). */
  firestoreEncode?: (item: T) => unknown;
  /** Firestore read 디코더(파싱 전 적용). */
  firestoreDecode?: (raw: unknown) => unknown;
}

export function createCrudBackend<T>(opts: CrudOpts<T>): CrudBackend<T> {
  const { coll, parse, idOf, seed, jsonFields = [], stripFields = [], firestoreEncode, firestoreDecode } = opts;

  // ── Appwrite 직렬화(중첩 → JSON 문자열) ──
  const toRow = (item: T): Record<string, unknown> => {
    const row: Record<string, unknown> = { ...(item as Record<string, unknown>) };
    // Appwrite 시스템 메타데이터 및 클라이언트 임시 필드 제거
    delete row.$id;
    delete row.$createdAt;
    delete row.$updatedAt;
    delete row.$permissions;
    delete row.$databaseId;
    delete row.$collectionId;
    delete row.$sequence;

    for (const f of stripFields) {
      delete row[f];
    }

    for (const f of jsonFields) {
      const v = (item as Record<string, unknown>)[f];
      row[f] = v == null ? null : JSON.stringify(v);
    }
    return row;
  };
  const fromRow = (row: Record<string, unknown>): T | null => {
    const obj: Record<string, unknown> = { ...row };
    if (!obj.id && obj.$id) {
      obj.id = obj.$id;
    }
    for (const f of jsonFields) {
      const v = row[f];
      obj[f] = typeof v === 'string' && v ? JSON.parse(v) : (v ?? null);
    }
    return parse(obj);
  };

  if (dbDriver === 'appwrite') {
    const dbs = () => databases!;
    return {
      async loadAll() {
        const out: T[] = [];
        const PAGE = 100;
        for (let offset = 0; ; offset += PAGE) {
          const res = await dbs().listDocuments(APPWRITE_DATABASE_ID, coll, [Query.limit(PAGE), Query.offset(offset)]);
          for (const row of res.documents as unknown as Record<string, unknown>[]) {
            const m = fromRow(row);
            if (m) out.push(m);
          }
          if (res.documents.length < PAGE) break;
        }
        return out;
      },
      async save(item: T) {
        const id = safeDocId(idOf(item)); // 한글 등 규격 밖 자연키는 결정적 해시 $id 로 매핑
        const row = toRow(item);
        try {
          await dbs().updateDocument(APPWRITE_DATABASE_ID, coll, id, row);
        } catch (e) {
          if ((e as { code?: number })?.code === 404) await dbs().createDocument(APPWRITE_DATABASE_ID, coll, id, row);
          else throw e;
        }
      },
      async remove(id: string) {
        await dbs().deleteDocument(APPWRITE_DATABASE_ID, coll, safeDocId(id));
      },
    };
  }

  if (dbDriver === 'firestore') {
    return {
      async loadAll() {
        const snap = await getDocs(collection(db!, coll));
        const out: T[] = [];
        for (const d of snap.docs) {
          const raw = firestoreDecode ? firestoreDecode(d.data()) : d.data();
          const m = parse(raw);
          if (m) out.push(m);
        }
        return out;
      },
      async save(item: T) {
        const payload = firestoreEncode ? firestoreEncode(item) : (item as Record<string, unknown>);
        await setDoc(doc(db!, coll, idOf(item)), payload as Record<string, unknown>);
      },
      async remove(id: string) {
        await deleteDoc(doc(db!, coll, id));
      },
    };
  }

  // ── in-memory ──
  let mem: T[] = seed.slice();
  return {
    async loadAll() {
      return mem;
    },
    async save(item: T) {
      const i = mem.findIndex((m) => idOf(m) === idOf(item));
      if (i >= 0) mem[i] = item;
      else mem = [...mem, item];
    },
    async remove(id: string) {
      mem = mem.filter((m) => idOf(m) !== id);
    },
  };
}
