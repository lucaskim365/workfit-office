import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import { databases, APPWRITE_DATABASE_ID, Query, assertAppwriteId } from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';
import { fileStorage } from '@/shared/lib/storage';
import {
  chatMessageSchema,
  MAX_ATTACHMENT_BYTES,
  type ChatMessage,
  type Attachment,
} from '@/domain/chatMessage/schema';
import { CHAT_MESSAGE_SEED } from '@/data/seeds/chatMessage.seed';

/**
 * 채팅 메시지 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 1 PoC)
 *
 * 저장 백엔드(Firestore / Appwrite / in-memory)는 `VITE_DB_DRIVER` 로 결정되며,
 * 아래 ChatMessageBackend 어댑터 뒤에 격리된다. 파생 로직(방별 필터·정렬·미읽음 도출·
 * markRead 루프)은 백엔드와 무관하게 이 파일 상단 공개 메서드에 그대로 남는다.
 *   → 백엔드 교체 = 어댑터 구현 하나만 추가/변경. features·UI 무손상.
 *
 * 플랫 top-level 컬렉션(roomId 필드로 방 구분). 미설정 시 in-memory seed.
 */
const COLL = 'chatMessages';

// ─────────────────────────────────────────────────────────────
// 백엔드 어댑터 인터페이스 — 저장소 원시 연산만 정의(파생 로직 제외)
// ─────────────────────────────────────────────────────────────
interface ChatMessageBackend {
  /** 전체 메시지 로드(불량 문서는 건너뜀). */
  loadAll(): Promise<ChatMessage[]>;
  /** id 기준 upsert(추가/갱신 공용). */
  save(message: ChatMessage): Promise<void>;
  /** 특정 방의 메시지 전건 삭제. */
  deleteByRoom(roomId: string): Promise<void>;
}

/** 저장소 무관 안전 파싱 — 불량 문서 하나가 전체 조회를 깨지 않도록 실패분만 건너뛴다. */
function safeParse(raw: Record<string, unknown>): ChatMessage | null {
  const parsed = chatMessageSchema.safeParse({
    ...raw,
    text: raw.text ?? '',
    type: raw.type ?? 'text',
    readBy: Array.isArray(raw.readBy) ? raw.readBy : [],
  });
  return parsed.success ? parsed.data : null;
}

// ─────────────────────────────────────────────────────────────
// 1) In-memory 백엔드 (Firebase/Appwrite 미설정 폴백 — 기존 동작 보존)
// ─────────────────────────────────────────────────────────────
class MemoryBackend implements ChatMessageBackend {
  private rows: ChatMessage[] = CHAT_MESSAGE_SEED.map((m) => chatMessageSchema.parse(m));
  async loadAll() {
    return this.rows;
  }
  async save(message: ChatMessage) {
    const i = this.rows.findIndex((x) => x.id === message.id);
    if (i >= 0) this.rows[i] = message;
    else this.rows = [...this.rows, message];
  }
  async deleteByRoom(roomId: string) {
    this.rows = this.rows.filter((m) => m.roomId !== roomId);
  }
}

// ─────────────────────────────────────────────────────────────
// 2) Firestore 백엔드 (현행)
// ─────────────────────────────────────────────────────────────
class FirestoreBackend implements ChatMessageBackend {
  async loadAll() {
    const snap = await getDocs(collection(db!, COLL));
    const out: ChatMessage[] = [];
    for (const d of snap.docs) {
      const m = safeParse(d.data());
      if (m) out.push(m);
    }
    return out;
  }
  async save(message: ChatMessage) {
    await setDoc(doc(db!, COLL, message.id), message);
  }
  async deleteByRoom(roomId: string) {
    const snap = await getDocs(collection(db!, COLL));
    for (const d of snap.docs) {
      if (d.data().roomId === roomId) await deleteDoc(doc(db!, COLL, d.id));
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 3) Appwrite 백엔드 (이관 목표)
//    - 중첩 객체(attachment/replyTo/approvalPayload)는 Appwrite 속성으로 직접 저장이
//      까다로워 JSON 문자열 속성으로 보관하고, 읽을 때 복원한다.
//    - 문서 $id = 앱 메시지 id (upsert·삭제 대상 지정을 위해 결정적으로 매핑).
//    - 페이지네이션: listDocuments 기본 25건 → limit 100 + offset 루프로 전건 로드.
// ─────────────────────────────────────────────────────────────
type AppwriteRow = Record<string, unknown> & { $id: string };

class AppwriteBackend implements ChatMessageBackend {
  private get dbs() {
    return databases!;
  }

  /** 도메인 객체 → Appwrite 속성(중첩은 JSON 문자열). id는 $id로 별도 전달. */
  private toAttrs(m: ChatMessage): Record<string, unknown> {
    return {
      roomId: m.roomId,
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      type: m.type,
      at: m.at,
      readBy: m.readBy,
      attachment: m.attachment ? JSON.stringify(m.attachment) : null,
      replyTo: m.replyTo ? JSON.stringify(m.replyTo) : null,
      approvalPayload: m.approvalPayload ? JSON.stringify(m.approvalPayload) : null,
    };
  }

  /** Appwrite row → 도메인 객체(JSON 복원 후 안전 파싱). */
  private fromRow(row: AppwriteRow): ChatMessage | null {
    const parseJson = (v: unknown) => (typeof v === 'string' && v ? JSON.parse(v) : null);
    return safeParse({
      id: row.$id,
      roomId: row.roomId,
      senderId: row.senderId,
      senderName: row.senderName,
      text: row.text,
      type: row.type,
      at: row.at,
      readBy: row.readBy,
      attachment: parseJson(row.attachment),
      replyTo: parseJson(row.replyTo),
      approvalPayload: parseJson(row.approvalPayload),
    });
  }

  async loadAll() {
    const out: ChatMessage[] = [];
    const PAGE = 100;
    for (let offset = 0; ; offset += PAGE) {
      const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, COLL, [
        Query.limit(PAGE),
        Query.offset(offset),
      ]);
      for (const row of res.documents as unknown as AppwriteRow[]) {
        const m = this.fromRow(row);
        if (m) out.push(m);
      }
      if (res.documents.length < PAGE) break;
    }
    return out;
  }

  async save(message: ChatMessage) {
    const id = assertAppwriteId(message.id);
    const attrs = this.toAttrs(message);
    try {
      // 기존 문서 갱신(markRead 등)
      await this.dbs.updateDocument(APPWRITE_DATABASE_ID, COLL, id, attrs);
    } catch (e) {
      // 없으면 생성(append). 그 외 오류는 전파.
      if ((e as { code?: number })?.code === 404) {
        await this.dbs.createDocument(APPWRITE_DATABASE_ID, COLL, id, attrs);
      } else {
        throw e;
      }
    }
  }

  async deleteByRoom(roomId: string) {
    const PAGE = 100;
    for (;;) {
      const res = await this.dbs.listDocuments(APPWRITE_DATABASE_ID, COLL, [
        Query.equal('roomId', roomId),
        Query.limit(PAGE),
      ]);
      for (const row of res.documents as unknown as AppwriteRow[]) {
        await this.dbs.deleteDocument(APPWRITE_DATABASE_ID, COLL, row.$id);
      }
      if (res.documents.length < PAGE) break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 활성 백엔드 선택 (모듈 로드 시 1회)
// ─────────────────────────────────────────────────────────────
function selectBackend(): ChatMessageBackend {
  switch (dbDriver) {
    case 'appwrite':
      return new AppwriteBackend();
    case 'firestore':
      return new FirestoreBackend();
    default:
      return new MemoryBackend();
  }
}
const backend: ChatMessageBackend = selectBackend();

export const chatMessageRepo = {
  /** 특정 방의 메시지를 시간 오름차순으로. */
  async listByRoom(roomId: string): Promise<ChatMessage[]> {
    const rows = await backend.loadAll();
    return rows.filter((m) => m.roomId === roomId).sort((a, b) => a.at.localeCompare(b.at));
  },

  /** 방별 미읽음 수(도출) — 내가 보내지 않았고 readBy 에 내가 없는 메시지 수. */
  async unreadByRoom(userId: string): Promise<Record<string, number>> {
    const rows = await backend.loadAll();
    const acc: Record<string, number> = {};
    for (const m of rows) {
      if (m.senderId !== userId && !m.readBy.includes(userId)) {
        acc[m.roomId] = (acc[m.roomId] ?? 0) + 1;
      }
    }
    return acc;
  },

  /**
   * 첨부 파일 업로드 → Storage `chat/{roomId}/` 에 저장하고 첨부 메타 반환.
   * 데모 한정 10MB 제한. 저장 백엔드(Garage/Firebase)는 fileStorage 어댑터가 결정.
   */
  async uploadAttachment(roomId: string, file: File): Promise<Attachment> {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`파일이 너무 큽니다(최대 ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB).`);
    }
    const meta = { name: file.name, size: file.size, mime: file.type || 'application/octet-stream' };
    // 다운로드 시 원본 파일명 보존을 위해 filename 을 넘긴다(어댑터가 Content-Disposition 처리).
    const safe = file.name.replace(/[^\w.\-가-힣]/g, '_');
    const path = `chat/${roomId}/${Date.now()}-${safe}`;
    const url = await fileStorage.put(path, file, { contentType: meta.mime, filename: file.name });
    return { url, ...meta };
  },

  /** 메시지 추가(전송). 문서 ID = 메시지 ID. */
  async append(message: ChatMessage): Promise<void> {
    const valid = chatMessageSchema.parse(message);
    await backend.save(valid);
  },

  /** 방 진입 시 읽음 처리 — 방의 모든 메시지 readBy 에 userId 추가. */
  async markRead(roomId: string, userId: string): Promise<void> {
    const targets = (await this.listByRoom(roomId)).filter((m) => !m.readBy.includes(userId));
    for (const m of targets) {
      await backend.save({ ...m, readBy: [...m.readBy, userId] });
    }
  },

  /** 특정 방의 메시지 전건 삭제 */
  async deleteByRoom(roomId: string): Promise<void> {
    await backend.deleteByRoom(roomId);
  },
};
