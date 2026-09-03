import type { ChatRoom } from '@/domain/chatRoom/schema';
import type { ChatMessage, Attachment } from '@/domain/chatMessage/schema';

/**
 * 모바일 메신저 공용 순수 헬퍼 — 데스크톱 QuickDock 과 동일 규칙을 공유.
 * (표시명·시각 포맷·미리보기·다운로드) 목록/대화 화면에서 함께 사용.
 */

type UserLite = { id: string; name: string; position: string };

/** 1:1 방은 상대방 "이름 직급", 그 외(그룹·공지)는 저장된 방 이름. */
export function getRoomDisplayName(room: ChatRoom, me: string, users: UserLite[]): string {
  if (room.type !== 'direct') return room.name;
  const otherId = room.members.find((m) => m !== me);
  if (!otherId) return room.name;
  const u = users.find((x) => x.id === otherId);
  return u ? `${u.name} ${u.position}` : room.name;
}

/** ISO 시각 → 오늘 HH:MM / 어제 / MM/DD (목록용). */
export function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yst = new Date(now);
  yst.setDate(now.getDate() - 1);
  if (d.toDateString() === yst.toDateString()) return '어제';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 전송 시각(HH:MM) — 말풍선 하단용. */
export function fmtBubbleTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 바이트 → 사람이 읽는 크기(KB/MB). */
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 메시지 미리보기(답글 인용·목록용). 데스크톱과 동일 규칙. */
export function msgPreview(m: ChatMessage): string {
  if (m.type === 'image') return '📷 사진';
  if (m.type === 'file') return `📎 ${m.attachment?.name ?? '파일'}`;
  return m.text;
}

import { downloadFile } from '@/shared/lib/download';

/**
 * 첨부 다운로드 — 원본 파일명 보존.
 */
export function downloadAttachment(att: Attachment) {
  void downloadFile(att.url, att.name);
}
