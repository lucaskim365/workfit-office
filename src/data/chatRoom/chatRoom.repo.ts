import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { chatRoomSchema, type ChatRoom, type LastMessage } from '@/domain/chatRoom/schema';
import { CHAT_ROOM_SEED } from '@/data/seeds/chatRoom.seed';

/**
 * 채팅방 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 정본 패턴)
 * Firebase 미설정 시 in-memory seed 로 graceful degrade.
 */
const COLL = 'chatRooms';

let memory: ChatRoom[] = CHAT_ROOM_SEED.map((r) => chatRoomSchema.parse(r));

/** 최신 메시지가 위로 오도록 lastMessage.at 내림차순 정렬. */
function sortByRecent(rows: ChatRoom[]): ChatRoom[] {
  return [...rows].sort((a, b) => (b.lastMessage?.at ?? '').localeCompare(a.lastMessage?.at ?? ''));
}

export const chatRoomRepo = {
  /** 방 목록. memberId 지정 시 그 사용자가 참여한 방만. */
  async list(memberId?: string): Promise<ChatRoom[]> {
    let rows: ChatRoom[];
    if (isFirebaseConfigured && db) {
      const fdb = db;
      const snap = await getDocs(collection(fdb, COLL));
      rows = snap.docs.map((d) => chatRoomSchema.parse(d.data()));
    } else {
      rows = memory;
    }
    const scoped = memberId ? rows.filter((r) => r.members.includes(memberId)) : rows;
    return sortByRecent(scoped);
  },

  async get(id: string): Promise<ChatRoom | null> {
    if (isFirebaseConfigured && db) {
      const rows = await this.list();
      return rows.find((r) => r.id === id) ?? null;
    }
    return memory.find((r) => r.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 방 ID. 신규 방 생성·시드 적재 공용. */
  async save(room: ChatRoom): Promise<void> {
    const valid = chatRoomSchema.parse(room);
    if (isFirebaseConfigured && db) {
      const fdb = db;
      await setDoc(doc(fdb, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  /** 그룹초대 — 기존 방 members 에 userIds 추가(중복 제거). */
  async addMembers(id: string, userIds: string[]): Promise<void> {
    const room = await this.get(id);
    if (!room) throw new Error(`채팅방을 찾을 수 없습니다: ${id}`);
    const merged = Array.from(new Set([...room.members, ...userIds]));
    await this.save({ ...room, members: merged });
  },

  /** 새 메시지 전송 시 목록 표시용 lastMessage 갱신. */
  async updateLastMessage(id: string, last: LastMessage): Promise<void> {
    const room = await this.get(id);
    if (!room) throw new Error(`채팅방을 찾을 수 없습니다: ${id}`);
    await this.save({ ...room, lastMessage: last });
  },
};
