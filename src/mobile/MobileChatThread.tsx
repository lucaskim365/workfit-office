import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Paperclip, FileSignature, FileText } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatThread, useSendMessage, useSendAttachment, useMarkRead, useEditMessage } from '@/features/chat/useChatThread';
import { useChatRooms, useLeaveRoom, useDeleteRoom, useInviteMembers, useUpdateRoomName } from '@/features/chat/useChatRooms';
import { useUsers } from '@/features/user/useUsers';
import { MAX_ATTACHMENT_BYTES, type ChatMessage, type Attachment, type ApprovalBotPayload } from '@/domain/chatMessage/schema';
import type { ChatRoom } from '@/domain/chatRoom/schema';
import { getRoomDisplayName, fmtBubbleTime, fmtSize, msgPreview, downloadAttachment } from './chatUtils';
import { MobileActionSheet, type SheetAction } from './MobileActionSheet';
import { MobileMemberPicker } from './MobileMemberPicker';
import { statusColor } from './MobileApprovalList';

/** 방 진입 시 숨김(삭제) 해제 — 데스크톱과 동일 규칙. */
function unhideRoom(me: string, roomId: string) {
  try {
    const key = `workfit-hidden-rooms-${me}`;
    const hidden: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (hidden.includes(roomId)) {
      localStorage.setItem(key, JSON.stringify(hidden.filter((id) => id !== roomId)));
    }
  } catch {
    /* 무시 */
  }
}

/** 모바일 대화창 — 답글·첨부·읽음수·검색·초대·방 관리 지원. */
export default function MobileChatThread() {
  const { roomId = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const me = user!.id;
  const meName = user!.name;
  const isAdmin = user!.roleGroup === 'ADMIN';

  const { data: messages = [] } = useChatThread(roomId);
  const { data: rooms = [] } = useChatRooms(me);
  const { data: users = [] } = useUsers();
  const room = rooms.find((r) => r.id === roomId);
  const send = useSendMessage(roomId);
  const sendFile = useSendAttachment(roomId);
  const markRead = useMarkRead();
  const leave = useLeaveRoom();
  const remove = useDeleteRoom();
  const updateRoomName = useUpdateRoomName();

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const handleRenameRoom = async () => {
    if (!room) return;
    const newName = window.prompt("새로운 대화방 이름을 입력하세요:", room.name);
    if (!newName || !newName.trim() || newName === room.name) return;
    try {
      await updateRoomName.mutateAsync({ roomId: room.id, name: newName.trim(), userName: meName });
    } catch (e) {
      window.alert("방 이름 변경에 실패했습니다.");
    }
  };
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readonly = room?.type === 'notice';
  const displayName = room ? getRoomDisplayName(room, me, users) : '채팅방';

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      if (m.type === 'system') return false;
      return m.text?.toLowerCase().includes(q) || m.attachment?.name?.toLowerCase().includes(q);
    });
  }, [messages, searchQuery]);

  useEffect(() => {
    unhideRoom(me, roomId);
    markRead.mutate({ roomId, userId: me });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filteredMessages.length]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    send.mutate({
      text: t,
      senderId: me,
      senderName: meName,
      replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.senderName || '알 수 없음', text: msgPreview(replyTo) } : null,
    });
    setText('');
    setReplyTo(null);
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || sendFile.isPending) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      window.alert(`파일이 너무 큽니다. 최대 ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB까지 전송할 수 있습니다.`);
      return;
    }
    try {
      await sendFile.mutateAsync({ file, senderId: me, senderName: meName });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '전송에 실패했습니다.');
    }
  };

  const onLeave = async () => {
    if (!room || leave.isPending) return;
    if (!window.confirm(`'${room.name}' 방에서 나가시겠어요?\n대화 내용은 보존됩니다.`)) return;
    await leave.mutateAsync({ roomId: room.id, userId: me, userName: meName });
    nav('/m');
  };
  const onDelete = async () => {
    if (!room || remove.isPending) return;
    if (!window.confirm(`'${room.name}' 방을 삭제하시겠어요?\n목록에서 숨겨지지만 대화 내용은 보존됩니다.`)) return;
    await remove.mutateAsync({ roomId: room.id, adminId: me, adminName: meName });
    nav('/m');
  };
  const onDeleteDirect = () => {
    if (!room) return;
    if (!window.confirm('채팅방을 목록에서 삭제하시겠어요?\n(새로운 대화를 시작하면 이전 대화가 다시 표시됩니다.)')) return;
    try {
      const key = `workfit-hidden-rooms-${me}`;
      const hidden: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (!hidden.includes(room.id)) localStorage.setItem(key, JSON.stringify([...hidden, room.id]));
    } catch {
      /* 무시 */
    }
    nav('/m');
  };

  const menuActions: SheetAction[] = room
    ? [
        ...(room.type === 'group' ? [{ label: '방 나가기', danger: true, onClick: onLeave }] : []),
        ...(isAdmin ? [{ label: '방 삭제 (관리자)', danger: true, onClick: onDelete }] : []),
        ...(room.type === 'direct' ? [{ label: '채팅방 삭제', danger: true, onClick: onDeleteDirect }] : []),
      ]
    : [];

  if (inviting && room) {
    return <InviteOverlay room={room} meName={meName} onDone={() => setInviting(false)} />;
  }

  return (
    <div className="flex h-full flex-col" style={{ background: '#faf6f0' }}>
      <header className="flex shrink-0 items-center gap-1 px-2 py-3 text-white" style={{ background: '#101830' }}>
        <button onClick={() => nav('/m')} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[18px] hover:bg-white/10">←</button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="truncate text-[15px] font-bold text-white">{displayName}</div>
            {room && room.type === 'group' && (room.createdBy === me || !room.createdBy) && (
              <button
                onClick={handleRenameRoom}
                title="방 이름 변경"
                className="text-[11px] opacity-70 hover:opacity-100 transition-all shrink-0 cursor-pointer"
              >
                ✏️
              </button>
            )}
          </div>
          {room && room.type !== 'direct' && <div className="text-[10px] text-white/60">{room.members.length}명</div>}
        </div>
        <button
          onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery(''); }}
          title="대화 검색"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/10 ${showSearch ? 'bg-white/15' : ''}`}
        >
          <Search size={16} />
        </button>
        {room?.type === 'group' && (
          <button onClick={() => setInviting(true)} title="멤버 초대" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[19px] leading-none hover:bg-white/10">＋</button>
        )}
        {menuActions.length > 0 && (
          <button onClick={() => setMenuOpen(true)} title="더보기" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[17px] leading-none hover:bg-white/10">⋮</button>
        )}
      </header>

      {showSearch && (
        <div className="shrink-0 border-b border-black/10 bg-white px-4 py-2">
          <div className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1.5">
            <Search size={13} className="shrink-0 text-ink3" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="메시지 또는 첨부파일명 검색…"
              className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-ink3"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="grid h-4 w-4 place-items-center rounded bg-black/10 text-[10px] text-ink3">✕</button>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {filteredMessages.length === 0 && (
          <div className="py-10 text-center text-[12px] text-ink3">{searchQuery ? '검색된 메시지가 없습니다.' : '대화 내용이 없습니다.'}</div>
        )}
        {filteredMessages.map((m) => (
          <MessageBubble
            key={m.id}
            m={m}
            me={me}
            group={room?.type === 'group'}
            roomMembers={room?.members ?? []}
            onOpenImage={setViewer}
            onReply={setReplyTo}
          />
        ))}
      </div>

      {readonly ? (
        <div className="shrink-0 border-t border-black/10 bg-black/[0.03] px-4 py-3 text-center text-[11.5px] text-ink3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          공지 전용 방입니다
        </div>
      ) : (
        <div className="shrink-0 border-t border-black/10 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {replyTo && (
            <div className="mx-2.5 mt-2 flex items-center gap-2 rounded-lg border-l-[3px] px-2.5 py-1.5" style={{ borderColor: '#e6960c', background: '#faf6f0' }}>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold" style={{ color: '#e6960c' }}>{replyTo.senderName || '메시지'}에게 답장</div>
                <div className="truncate text-[11px] text-ink3">{msgPreview(replyTo)}</div>
              </div>
              <button onClick={() => setReplyTo(null)} title="답장 취소" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[13px] text-ink3 active:bg-black/5">✕</button>
            </div>
          )}
          <div className="flex items-center gap-2 p-2.5">
            <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={sendFile.isPending}
              title={`파일 첨부 (최대 ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB)`}
              className="grid h-10 w-9 shrink-0 place-items-center rounded-full text-ink3 active:bg-black/5 disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }}
              placeholder={sendFile.isPending ? '파일 전송 중…' : '메시지를 입력하세요…'}
              className="min-w-0 flex-1 rounded-full bg-black/5 px-4 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink3"
            />
            <button onClick={submit} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] text-white" style={{ background: '#e6960c' }}>↑</button>
          </div>
        </div>
      )}

      {viewer && <ImageViewer att={viewer} onClose={() => setViewer(null)} />}
      {menuOpen && <MobileActionSheet title={room?.name} actions={menuActions} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}

/** 전자결재 알림 봇 카드 — 탭 시 결재 상세(/m/approval/:id)로 이동. Flutter approval_notification_card 와 동일 역할. */
function ApprovalBotCard({ payload, text }: { payload: ApprovalBotPayload; text: string }) {
  const nav = useNavigate();
  const canOpen = !!payload.docId;
  return (
    <div className="w-[240px] overflow-hidden rounded-2xl border border-black/10 bg-white">
      <div className="flex items-center gap-1.5 px-3 py-2 text-white" style={{ background: '#101830' }}>
        <FileSignature size={14} className="shrink-0" />
        <span className="text-[11.5px] font-bold">전자결재 알림</span>
        <span
          className="ml-auto rounded-md px-1.5 py-0.5 text-[9.5px] font-bold"
          style={{ background: `${statusColor(payload.status)}33`, color: '#fff' }}
        >
          {payload.status}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-[11px] text-ink3">{text || '전자결재 문서를 확인해 주세요.'}</div>
        <div className="mt-1.5 line-clamp-2 text-[13px] font-bold text-ink">{payload.title || '(제목 없음)'}</div>
        <div className="mt-1 text-[11px] text-ink3">
          {payload.drafterName}
          {payload.drafterDept ? ` · ${payload.drafterDept}` : ''}
          {payload.docNo ? ` · ${payload.docNo}` : ''}
        </div>
        <button
          onClick={() => canOpen && nav(`/m/approval/${payload.docId}`)}
          disabled={!canOpen}
          className="mt-2.5 w-full rounded-lg py-2 text-[12px] font-bold text-white disabled:opacity-40"
          style={{ background: '#e6960c' }}
        >
          결재 문서 상세 보기 →
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ m, me, group, roomMembers, onOpenImage, onReply }: {
  m: ChatMessage;
  me: string;
  group?: boolean;
  roomMembers: string[];
  onOpenImage: (att: Attachment) => void;
  onReply: (m: ChatMessage) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(() => m.text.replace(/ \(수정됨\)$/, ''));
  const editMsg = useEditMessage(m.roomId);

  useEffect(() => {
    setEditVal(m.text.replace(/ \(수정됨\)$/, ''));
  }, [m.text]);

  if (m.type === 'system') {
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-full bg-black/5 px-3 py-1 text-[10.5px] text-ink3">{m.text}</span>
      </div>
    );
  }
  const mine = m.senderId === me;
  const att = m.attachment;
  // 안 읽은 인원 수: 방 멤버 중 readBy 에 없는 사람(본인 제외).
  const unreadCount = roomMembers.filter((uid) => uid !== m.senderId && !m.readBy.includes(uid)).length;

  let body;
  if (isEditing) {
    body = (
      <div className="flex flex-col gap-1 w-full min-w-[180px]">
        <textarea
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          className="w-full bg-[#fcfaf5] text-[12px] text-ink border border-[#e6960c] rounded-lg px-2 py-1.5 outline-none resize-none"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const val = editVal.trim();
              if (val) {
                const textWithIndicator = `${val} (수정됨)`;
                editMsg.mutate({ messageId: m.id, text: textWithIndicator });
                setIsEditing(false);
              }
            }
          }}
        />
        <div className="flex justify-end gap-1 text-[10px]">
          <button
            onClick={() => { setIsEditing(false); setEditVal(m.text.replace(/ \(수정됨\)$/, '')); }}
            className="px-2 py-0.5 bg-black/5 text-ink2 rounded"
          >
            취소
          </button>
          <button
            onClick={async () => {
              const val = editVal.trim();
              if (!val) return;
              try {
                const textWithIndicator = `${val} (수정됨)`;
                await editMsg.mutateAsync({ messageId: m.id, text: textWithIndicator });
                setIsEditing(false);
              } catch (e) {
                window.alert("수정에 실패했습니다.");
              }
            }}
            disabled={editMsg.isPending}
            className="px-2 py-0.5 bg-[#e6960c] text-white rounded disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    );
  } else if (m.type === 'approval_bot' && m.approvalPayload) {
    body = <ApprovalBotCard payload={m.approvalPayload} text={m.text} />;
  } else if (m.type === 'image' && att) {
    body = (
      <button onClick={() => onOpenImage(att)} className="block overflow-hidden rounded-2xl border border-black/10">
        <img src={att.url} alt={att.name} className="max-h-52 max-w-full object-cover" />
      </button>
    );
  } else if (m.type === 'file' && att) {
    body = (
      <button
        onClick={() => downloadAttachment(att)}
        className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left"
        style={mine ? { background: '#e6960c', color: '#fff' } : { background: '#fff', color: '#1a202c' }}
      >
        <FileText size={18} className="shrink-0" />
        <span className="min-w-0">
          <span className="block max-w-[190px] truncate text-[12.5px] font-semibold">{att.name}</span>
          <span className={`block text-[10px] ${mine ? 'opacity-85' : 'text-ink3'}`}>{fmtSize(att.size)} · 다운로드</span>
        </span>
      </button>
    );
  } else {
    body = (
      <div
        className="whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed"
        style={mine ? { background: '#e6960c', color: '#fff' } : { background: '#fff', color: '#1a202c' }}
      >
        {m.text}
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[82%] gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!mine && (
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center self-end rounded-full bg-teal-soft text-[11px] font-bold text-teal">
            {m.senderName?.[0] ?? '?'}
          </span>
        )}
        <div className="min-w-0">
          {!mine && group && <div className="mb-0.5 text-[10px] text-ink3">{m.senderName}</div>}
          {m.replyTo && (
            <div className={`mb-1 truncate rounded-md border-l-2 px-2 py-1 text-[10.5px] ${mine ? 'border-white/50 bg-black/[0.08] text-ink2' : 'border-black/20 bg-black/[0.06] text-ink3'}`}>
              <b>{m.replyTo.senderName || '메시지'}</b> {m.replyTo.text}
            </div>
          )}
          <div className={`flex items-center gap-1 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
            {body}
            <div className="flex shrink-0 items-center gap-0.5 opacity-60">
              <button
                onClick={() => onReply(m)}
                title="답글"
                className="grid h-6 w-6 place-items-center rounded-full text-[12px] text-ink3 active:bg-black/5"
              >
                ↩
              </button>
              {mine && m.type === 'text' && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  title="수정"
                  className="grid h-6 w-6 place-items-center rounded-full text-[10px] text-ink3 active:bg-black/5"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>
          <div className={`mt-0.5 flex items-center gap-1 ${mine ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
            {mine && unreadCount > 0 && (
              <span className="text-[9.5px] font-extrabold leading-none" style={{ color: '#e6960c' }}>{unreadCount}</span>
            )}
            <span className="text-[9.5px] tabular-nums text-ink3">{fmtBubbleTime(m.at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 이미지 라이트박스 — 전체화면 원본 표시 + 다운로드. 배경/✕ 로 닫기. */
function ImageViewer({ att, onClose }: { att: Attachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/90 p-4">
      <div
        className="absolute left-0 right-0 top-0 flex items-center gap-3 px-4 py-3 text-white"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{att.name}</span>
        <button onClick={() => downloadAttachment(att)} title="다운로드" className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-[15px] active:bg-white/25">⤓</button>
        <button onClick={onClose} title="닫기" className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-[16px] active:bg-white/25">✕</button>
      </div>
      <img src={att.url} alt={att.name} onClick={(e) => e.stopPropagation()} className="max-h-[82vh] max-w-full rounded-lg object-contain" />
    </div>,
    document.body,
  );
}

/** 그룹 멤버 초대 — 조직도에서 비참여자 다중 선택 → members 확장 + 시스템 메시지. */
function InviteOverlay({ room, meName, onDone }: { room: ChatRoom; meName: string; onDone: () => void }) {
  const { data: users = [] } = useUsers();
  const invite = useInviteMembers();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (!selected.length || invite.isPending) return;
    const inviteeNames = users.filter((u) => selected.includes(u.id)).map((u) => u.name);
    await invite.mutateAsync({ roomId: room.id, userIds: selected, inviterName: meName, inviteeNames });
    onDone();
  };

  return (
    <div className="flex h-full flex-col" style={{ background: '#faf6f0' }}>
      <header className="flex shrink-0 items-center gap-2 px-2 py-3 text-white" style={{ background: '#101830' }}>
        <button onClick={onDone} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[18px] hover:bg-white/10">←</button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">멤버 초대</div>
          <div className="text-[10px] text-white/60">{room.name}</div>
        </div>
        <button
          onClick={submit}
          disabled={!selected.length || invite.isPending}
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white transition-opacity disabled:opacity-40"
          style={{ background: '#e6960c' }}
        >
          초대 ({selected.length})
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <MobileMemberPicker exclude={room.members} selected={selected} onToggle={toggle} />
      </div>
    </div>
  );
}
