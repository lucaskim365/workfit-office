import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { nowLocalIso } from '@/shared/lib/datetime';
import { chatRoomSchema, type ChatRoom, type ChatRoomType, type LastMessage } from '@/domain/chatRoom/schema';
import { CHAT_ROOM_SEED } from '@/data/seeds/chatRoom.seed';

/**
 * 채팅방 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 정본 패턴)
 * Firebase 미설정 시 in-memory seed 로 graceful degrade.
 */
const COLL = 'chatRooms';

/** 신규 방 색상 팔레트(생성 순서대로 순환). 시드 색과 톤 일치. */
const ROOM_COLORS = ['#e6960c', '#3a6ee0', '#17a89a', '#e0483b', '#8b5cf6', '#1f2f55', '#d9488b', '#0ea5a0'];

let memory: ChatRoom[] = CHAT_ROOM_SEED.map((r) => chatRoomSchema.parse(r));

/** 신규 방 채번 'RM-000X' — 기존 최대 번호 + 1. (user.repo nextId 패턴)
 *  ⚠ 데모 한정: 동시 생성 시 충돌 가능(counters 미사용). 시연 규모에선 무영향. */
function nextId(rows: ChatRoom[]): string {
  const max = rows.reduce((m, r) => {
    const n = Number(r.id.replace(/\D/g, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `RM-${String(max + 1).padStart(4, '0')}`;
}

/** 참여자 집합이 같은지(순서 무관) — 1:1 방 중복 판정용. */
function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** 최신 메시지가 위로 오도록 lastMessage.at 내림차순 정렬. */
function sortByRecent(rows: ChatRoom[]): ChatRoom[] {
  return [...rows].sort((a, b) => (b.lastMessage?.at ?? '').localeCompare(a.lastMessage?.at ?? ''));
}

/** 신규 방 생성 입력(시스템 필드 제외). */
export interface CreateRoomInput {
  name: string;
  type: ChatRoomType;
  /** "나"를 포함한 전체 참여자 users.id. */
  members: string[];
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

  /** 신규 방 생성. 1:1(direct)은 동일 참여자 조합이 이미 있으면 그 방을 재사용(중복 방지). */
  async create(input: CreateRoomInput): Promise<ChatRoom> {
    const all = await this.list();
    if (input.type === 'direct') {
      const existing = all.find((r) => r.type === 'direct' && sameMembers(r.members, input.members));
      if (existing) return existing;
    }
    const room = chatRoomSchema.parse({
      id: nextId(all),
      name: input.name,
      type: input.type,
      members: input.members,
      color: ROOM_COLORS[all.length % ROOM_COLORS.length],
      lastMessage: null,
      createdAt: nowLocalIso(),
    });
    await this.save(room);
    return room;
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
