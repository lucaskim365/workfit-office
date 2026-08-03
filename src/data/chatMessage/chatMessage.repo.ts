import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { fileStorage } from '@/shared/lib/storage';
import {
  chatMessageSchema,
  MAX_ATTACHMENT_BYTES,
  type ChatMessage,
  type Attachment,
} from '@/domain/chatMessage/schema';
import { CHAT_MESSAGE_SEED } from '@/data/seeds/chatMessage.seed';

/**
 * 채팅 메시지 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 정본 패턴)
 * 플랫 top-level 컬렉션(roomId 필드로 방 구분). Firebase 미설정 시 in-memory seed.
 */
const COLL = 'chatMessages';

let memory: ChatMessage[] = CHAT_MESSAGE_SEED.map((m) => chatMessageSchema.parse(m));

/** 전체 메시지 로드(저장소 무관). vendor 패턴대로 전건 로드 후 방별 필터. */
async function loadAll(): Promise<ChatMessage[]> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    const snap = await getDocs(collection(fdb, COLL));
    // 문서별 안전 파싱 — 불량 문서(모바일이 쓴 미지원 type 등) 하나 때문에
    // 전체 조회가 예외로 실패하지 않도록 실패 문서만 건너뛴다.
    const out: ChatMessage[] = [];
    for (const d of snap.docs) {
      const raw = d.data();
      const parsed = chatMessageSchema.safeParse({
        ...raw,
        text: raw.text ?? '',
        type: raw.type ?? 'text',
        readBy: Array.isArray(raw.readBy) ? raw.readBy : [],
      });
      if (parsed.success) {
        out.push(parsed.data);
      }
    }
    return out;
  }
  return memory;
}

export const chatMessageRepo = {
  /** 특정 방의 메시지를 시간 오름차순으로. */
  async listByRoom(roomId: string): Promise<ChatMessage[]> {
    const rows = await loadAll();
    return rows.filter((m) => m.roomId === roomId).sort((a, b) => a.at.localeCompare(b.at));
  },

  /** 방별 미읽음 수(도출) — 내가 보내지 않았고 readBy 에 내가 없는 메시지 수. */
  async unreadByRoom(userId: string): Promise<Record<string, number>> {
    const rows = await loadAll();
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
   * 데모 한정 10MB 제한(storage.rules 와 동일). Firebase 미설정 시 base64 data URL 폴백.
   * ([[companyInfo.repo]] uploadLogo 패턴 재사용)
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
    if (isFirebaseConfigured && db) {
      const fdb = db;
      await setDoc(doc(fdb, COLL, valid.id), valid);
    } else {
      memory = [...memory, valid];
    }

  },

  /** 방 진입 시 읽음 처리 — 방의 모든 메시지 readBy 에 userId 추가. */
  async markRead(roomId: string, userId: string): Promise<void> {
    const targets = (await this.listByRoom(roomId)).filter((m) => !m.readBy.includes(userId));
    for (const m of targets) {
      const updated = { ...m, readBy: [...m.readBy, userId] };
      if (isFirebaseConfigured && db) {
        const fdb = db;
        await setDoc(doc(fdb, COLL, updated.id), updated);
      } else {
        const i = memory.findIndex((x) => x.id === updated.id);
        if (i >= 0) memory[i] = updated;
      }
    }
  },
};
