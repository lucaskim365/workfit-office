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
import { isPdfFile, openPdfViewer } from './MobilePdfViewer';
import { canShareFileType, getChatFile, loadChatFile, saveBlob, shareFile } from './chatFileStore';

/**
 * 첨부 다운로드 — 원본 파일명 보존.
 */
export function downloadAttachment(att: Attachment) {
  void downloadFile(att.url, att.name);
}

/** 받는 중인 첨부 — 받는 동안 또 눌러도 겹쳐 받지 않게 */
const opening = new Set<string>();

/**
 * 첨부 열기(카카오톡처럼) — 처음 누르면 받아서 앱 보관함에 두고 열고, 다음부터는 보관함에서 바로 연다(chatFileStore).
 * - PDF: 앱 안 보기 화면(휴대폰 뒤로가기로 대화방에 돌아옴)
 * - 그 밖(한글·엑셀 등): 휴대폰 공유 창(다른 앱으로 열기 — 앱 화면 위에 떠서 뒤로가기로 돌아옴). 공유 창은 누른 직후에만
 *   띄울 수 있어(휴대폰 보안 규칙) 받는 데 오래 걸렸으면 말풍선이 '받음'으로 바뀌고, 다시 누르면 바로 뜬다.
 *   공유 창이 없는 기기는 휴대폰에 저장(다운로드)
 * 다운로드한 파일을 다른 뷰어 앱으로 열면 휴대폰에 따라 뒤로가기에 앱이 아니라 홈 화면으로 나가 버렸다
 */
export async function openAttachment(att: Attachment) {
  if (opening.has(att.url)) return;
  // 한글·엑셀·워드 등 공유 창으로 못 넘기는 문서 — 바로 다운로드(휴대폰 다운로드 알림의 [열기]로 연다)
  if (!isPdfFile(att.name, att.mime) && !canShareFileType(att.name)) return downloadAttachment(att);
  opening.add(att.url);
  try {
    let blob = await getChatFile(att.url);
    const fromCache = !!blob;
    if (!blob) {
      try {
        blob = await loadChatFile(att.url, att.mime);
      } catch {
        return; // 말풍선이 '받기 실패'를 보인다
      }
    }
    if (isPdfFile(att.name, att.mime)) return openPdfViewer({ blob, name: att.name, mime: att.mime || 'application/pdf' });
    const r = await shareFile(blob, att.name, att.mime);
    // 공유 창이 없거나 휴대폰이 이 파일을 거절 — 보관함에서 바로 꺼냈는데 거절했으면 '누른 지 오래됨'이 아니라 종류 거절이다
    if (r === 'unsupported' || (r === 'expired' && fromCache)) saveBlob(blob, att.name);
  } finally {
    opening.delete(att.url);
  }
}
