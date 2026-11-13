import type { Attachment, ChatMessage } from './schema';

export interface RoomFile {
  /** 목록 key — 서식 메시지는 첨부가 여럿이라 메시지 id 만으로는 겹친다 */
  key: string;
  messageId: string;
  senderName: string;
  at: string;
  attachment: Attachment;
  type: 'image' | 'file';
}

const isImage = (a: Attachment) => a.mime.startsWith('image/');

/**
 * 대화방 파일함 — 메시지에 붙은 사진·파일을 최신순으로 한 줄씩(웹·PWA 공용).
 * 예전 메시지는 attachment 하나, 서식 메시지(rich, 2026-10 메신저 개편 뒤 모든 전송)는 attachments 여러 개다.
 * 예전에는 attachment 만 봐서 개편 뒤 보낸 파일·사진이 파일함에 하나도 안 나왔다. 지운 메시지는 뺀다.
 */
export function roomFilesOf(messages: readonly ChatMessage[]): RoomFile[] {
  const out: RoomFile[] = [];
  for (const m of messages) {
    if (m.deletedAt) continue;
    const base = { messageId: m.id, senderName: m.senderName, at: m.at };
    if (m.attachment) out.push({ ...base, key: m.id, attachment: m.attachment, type: m.type === 'image' || isImage(m.attachment) ? 'image' : 'file' });
    (m.attachments ?? []).forEach((a, i) => out.push({ ...base, key: `${m.id}:${a.id ?? i}`, attachment: a, type: isImage(a) ? 'image' : 'file' }));
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export interface RoomFileDay {
  /** YYYY-MM-DD */
  day: string;
  /** 2026년 11월 13일 (금) */
  label: string;
  files: RoomFile[];
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 파일함 사진을 날짜별로 묶는다 — 받은 순서(최신순)를 그대로 두고 같은 날끼리 */
export function groupRoomFilesByDay(files: readonly RoomFile[]): RoomFileDay[] {
  const out: RoomFileDay[] = [];
  for (const f of files) {
    const day = f.at.slice(0, 10);
    let g = out[out.length - 1];
    if (!g || g.day !== day) {
      const [y, m, d] = day.split('-').map(Number);
      const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
      g = { day, label: `${y}년 ${m}월 ${d}일 (${wd})`, files: [] };
      out.push(g);
    }
    g.files.push(f);
  }
  return out;
}
