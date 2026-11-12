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
