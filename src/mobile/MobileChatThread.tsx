import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Paperclip, FileSignature, FileText } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatThread, useSendMessage, useSendAttachment, useMarkRead, useEditMessage, useUpdateMessageReactions } from '@/features/chat/useChatThread';
import { useChatRooms, useLeaveRoom, useDeleteRoom, useInviteMembers, useUpdateRoomName } from '@/features/chat/useChatRooms';
import { useUsers } from '@/features/user/useUsers';
import { MAX_ATTACHMENT_BYTES, type ChatMessage, type Attachment, type ApprovalBotPayload } from '@/domain/chatMessage/schema';
import type { ChatRoom } from '@/domain/chatRoom/schema';
import { getRoomDisplayName, fmtBubbleTime, fmtSize, msgPreview, downloadAttachment } from './chatUtils';
import { MobileActionSheet, type SheetAction } from './MobileActionSheet';
import { MobileMemberPicker } from './MobileMemberPicker';
import { statusColor } from './MobileApprovalList';

/** 사용자 ID에 따른 다채로운 파스텔톤 아바타 스타일 매핑. */
export function getAvatarStyle(userId: string): { bg: string; text: string } {
  const PASTEL_PALETTE = [
    { bg: '#e0f2fe', text: '#0369a1' }, // 파스텔 스카이 블루
    { bg: '#fce7f3', text: '#be185d' }, // 파스텔 핑크
    { bg: '#dcfce7', text: '#15803d' }, // 파스텔 민트/그린
    { bg: '#fef9c3', text: '#a16207' }, // 파스텔 옐로우
    { bg: '#f3e8ff', text: '#6b21a8' }, // 파스텔 퍼플
    { bg: '#ffedd5', text: '#c2410c' }, // 파스텔 오렌지
    { bg: '#e0e7ff', text: '#3730a3' }, // 파스텔 인디고
  ];
  if (!userId) return PASTEL_PALETTE[0];
  let sum = 0;
  for (let i = 0; i < userId.length; i++) {
    sum += userId.charCodeAt(i);
  }
  return PASTEL_PALETTE[sum % PASTEL_PALETTE.length];
}

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
  const updateReactions = useUpdateMessageReactions(roomId);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const [sheetMessage, setSheetMessage] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const copyToClipboard = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      window.alert('메시지가 복사되었습니다.');
    } catch {
      window.alert('복사에 실패했습니다.');
    }
  };

  const handleToggleEmoji = async (messageId: string, emoji: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    const curReactions = targetMsg.reactions ? { ...targetMsg.reactions } as Record<string, string[]> : {} as Record<string, string[]>;
    const userList = curReactions[emoji] ? [...curReactions[emoji]] : [];

    let nextUserList: string[];
    if (userList.includes(me)) {
      nextUserList = userList.filter((uid) => uid !== me);
    } else {
      nextUserList = [...userList, me];
    }

    if (nextUserList.length === 0) {
      delete curReactions[emoji];
    } else {
      curReactions[emoji] = nextUserList;
    }

    try {
      await updateReactions.mutateAsync({ messageId, reactions: curReactions });
    } catch {
      window.alert("반응 업데이트에 실패했습니다.");
    }
  };

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
  const [viewer, setViewer] = useState<{ attachments: Attachment[]; initialIdx: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  interface StagedFile {
    id: string;
    file: File;
    previewUrl?: string;
  }
  const [attachedFiles, setAttachedFiles] = useState<StagedFile[]>([]);

  const handleFilesAttach = (files: FileList | File[]) => {
    const list = Array.from(files);
    const validFiles: StagedFile[] = [];
    for (const file of list) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        window.alert(`파일 [${file.name}]이 너무 큽니다. 최대 ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB까지 전송할 수 있습니다.`);
        continue;
      }
      const isImg = file.type.startsWith('image/');
      validFiles.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      });
    }
    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearAttachedFiles = (filesList: StagedFile[]) => {
    filesList.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setAttachedFiles([]);
  };

  useEffect(() => {
    return () => {
      attachedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [roomId, attachedFiles]);

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

  const processedItems = useMemo(() => processMessageBundles(filteredMessages), [filteredMessages]);

  useEffect(() => {
    unhideRoom(me, roomId);
    markRead.mutate({ roomId, userId: me });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filteredMessages.length]);

  const submit = async () => {
    const t = text.trim();
    if (!t && attachedFiles.length === 0) return;
    if (sendFile.isPending) return;

    if (attachedFiles.length > 0) {
      try {
        // 첫 번째 파일은 텍스트 및 답글 정보와 함께 전송
        await sendFile.mutateAsync({
          file: attachedFiles[0].file,
          senderId: me,
          senderName: meName,
          text: t,
          replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.senderName || '알 수 없음', text: msgPreview(replyTo) } : null,
        });

        // 나머지 파일들은 빈 텍스트로 순차 전송
        for (let i = 1; i < attachedFiles.length; i++) {
          await sendFile.mutateAsync({
            file: attachedFiles[i].file,
            senderId: me,
            senderName: meName,
            text: '',
          });
        }

        clearAttachedFiles(attachedFiles);
        setText('');
        setReplyTo(null);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : '전송에 실패했습니다.');
      }
    } else {
      send.mutate({
        text: t,
        senderId: me,
        senderName: meName,
        replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.senderName || '알 수 없음', text: msgPreview(replyTo) } : null,
      });
      setText('');
      setReplyTo(null);
    }
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAttach(e.target.files);
    }
    e.target.value = '';
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
        ...(room.type === 'group' && (room.createdBy === me || !room.createdBy) ? [{ label: '대화방 이름 변경', onClick: handleRenameRoom }] : []),
        ...(room.type === 'group' ? [{ label: '방 나가기', danger: true, onClick: onLeave }] : []),
        ...(isAdmin ? [{ label: '방 삭제 (관리자)', danger: true, onClick: onDelete }] : []),
        ...(room.type === 'direct' ? [{ label: '채팅방 삭제', danger: true, onClick: onDeleteDirect }] : []),
      ]
    : [];

  if (inviting && room) {
    return <InviteOverlay room={room} meName={meName} onDone={() => setInviting(false)} />;
  }

  return (
    <div className="flex h-full flex-col" style={{ background: '#f2f8fc' }}>
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
        {processedItems.length === 0 && (
          <div className="py-10 text-center text-[12px] text-ink3">{searchQuery ? '검색된 메시지가 없습니다.' : '대화 내용이 없습니다.'}</div>
        )}
        {processedItems.map((item, idx) => {
          const m = item.message;
          let prevMsg: ChatMessage | null = null;
          if (idx > 0) {
            const prevItem = processedItems[idx - 1];
            if (prevItem.type === 'image-bundle' && prevItem.bundleMessages && prevItem.bundleMessages.length > 0) {
              prevMsg = prevItem.bundleMessages[prevItem.bundleMessages.length - 1];
            } else {
              prevMsg = prevItem.message;
            }
          }
          const nextMsg = idx < processedItems.length - 1 ? processedItems[idx + 1].message : null;

          const showDateDivider = !prevMsg || !isSameDay(prevMsg.at, m.at);

          const lastMsgOfGroup = item.type === 'image-bundle' && item.bundleMessages
            ? item.bundleMessages[item.bundleMessages.length - 1]
            : m;
          const hideTime = nextMsg && lastMsgOfGroup.senderId === nextMsg.senderId && isSameMinute(lastMsgOfGroup.at, nextMsg.at);
          const showTime = !hideTime;

          return (
            <div key={m.id} className="space-y-2">
              {showDateDivider && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-black/5 px-3 py-1 text-[10.5px] text-ink3">
                    {fmtDateDivider(m.at)}
                  </span>
                </div>
              )}
              {item.type === 'image-bundle' && item.bundleMessages ? (
                <ImageBundleBubble
                  bundle={item.bundleMessages}
                  me={me}
                  group={room?.type === 'group'}
                  roomMembers={room?.members ?? []}
                  onOpenImage={(att, list) => setViewer({ attachments: list, initialIdx: list.indexOf(att) })}
                  showTime={showTime}
                  onLongPress={setSheetMessage}
                  onToggleEmoji={handleToggleEmoji}
                />
              ) : (
                <MessageBubble
                  m={m}
                  me={me}
                  group={room?.type === 'group'}
                  roomMembers={room?.members ?? []}
                  onOpenImage={(att) => setViewer({ attachments: [att], initialIdx: 0 })}
                  showTime={showTime}
                  isEditing={editingMessageId === m.id}
                  onCancelEdit={() => setEditingMessageId(null)}
                  onLongPress={setSheetMessage}
                  onToggleEmoji={handleToggleEmoji}
                />
              )}
            </div>
          );
        })}
      </div>

      {readonly ? (
        <div className="shrink-0 border-t border-black/10 bg-black/[0.03] px-4 py-3 text-center text-[11.5px] text-ink3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          공지 전용 방입니다
        </div>
      ) : (
        <div className="shrink-0 border-t border-black/10 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {replyTo && (
            <div className="mx-2.5 mt-2 flex items-center gap-2 rounded-lg border-l-[3px] px-2.5 py-1.5" style={{ borderColor: '#4ea8de', background: '#f2f8fc' }}>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold" style={{ color: '#1890ff' }}>{replyTo.senderName || '메시지'}에게 답장</div>
                <div className="truncate text-[11px] text-ink3">{msgPreview(replyTo)}</div>
              </div>
              <button onClick={() => setReplyTo(null)} title="답장 취소" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[13px] text-ink3 active:bg-black/5">✕</button>
            </div>
          )}
          {/* 다중 첨부 대기 파일 칩 목록 */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 max-h-36 overflow-y-auto px-4 py-2 border-b border-black/5">
              {attachedFiles.map((item) => (
                <div key={item.id} className="relative w-14 h-14 rounded-lg border border-black/10 bg-black/5 overflow-hidden flex items-center justify-center shrink-0 shadow-3xs">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-1 text-center w-full h-full">
                      <span className="text-[16px] leading-none">📄</span>
                      <span className="text-[8px] font-semibold truncate w-full mt-0.5 px-0.5 text-ink leading-tight" title={item.file.name}>
                        {item.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachedFile(item.id)}
                    title="첨부 취소"
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 grid place-items-center text-[8px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 p-2.5">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFile} />
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
            <button onClick={submit} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] text-white" style={{ background: '#4ea8de' }}>↑</button>
          </div>
        </div>
      )}

      {viewer && <ImageViewer attachments={viewer.attachments} initialIdx={viewer.initialIdx} onClose={() => setViewer(null)} />}
      {menuOpen && <MobileActionSheet title={room?.name} actions={menuActions} onClose={() => setMenuOpen(false)} />}
      {sheetMessage && createPortal(
        <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40" onClick={() => setSheetMessage(null)}>
          <div
            className="mx-2 mb-2 overflow-hidden rounded-2xl bg-white shadow-xl p-3"
            style={{ marginBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 이모지 리액션 단축 5종 */}
            <div className="flex items-center justify-around py-2 border-b border-black/5">
              {['👍', '❤️', '😄', '😮', '😢'].map((emoji) => {
                const list = (sheetMessage.reactions as Record<string, string[]> | undefined)?.[emoji] ?? [];
                const active = list.includes(me);
                return (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleToggleEmoji(sheetMessage.id, emoji);
                      setSheetMessage(null);
                    }}
                    className="grid h-10 w-10 place-items-center text-[22px] rounded-full active:bg-black/5"
                    style={active ? { background: '#e6960c20' } : undefined}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* 메시지 액션 목록 */}
            <div className="flex flex-col mt-2">
              <button
                onClick={() => {
                  setReplyTo(sheetMessage);
                  setSheetMessage(null);
                }}
                className="w-full py-3.5 text-center text-[14px] font-semibold border-b border-black/5 text-ink active:bg-black/5"
              >
                답글 달기
              </button>
              <button
                onClick={() => {
                  copyToClipboard(sheetMessage.text || '');
                  setSheetMessage(null);
                }}
                className="w-full py-3.5 text-center text-[14px] font-semibold border-b border-black/5 text-ink active:bg-black/5"
              >
                텍스트 복사
              </button>
              {sheetMessage.senderId === me && sheetMessage.type === 'text' && (
                <button
                  onClick={() => {
                    setEditingMessageId(sheetMessage.id);
                    setSheetMessage(null);
                  }}
                  className="w-full py-3.5 text-center text-[14px] font-semibold text-ink active:bg-black/5"
                >
                  메시지 수정
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setSheetMessage(null)}
            className="mx-2 mb-2 rounded-2xl bg-white py-3.5 text-center text-[14px] font-bold text-ink2 shadow-xl active:bg-black/5"
            style={{ marginBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            취소
          </button>
        </div>,
        document.body
      )}
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
          style={{ background: '#4ea8de' }}
        >
          결재 문서 상세 보기 →
        </button>
      </div>
    </div>
  );
}

function ImageBundleBubble({
  bundle,
  me,
  group,
  roomMembers,
  onOpenImage,
  showTime,
  onLongPress,
  onToggleEmoji,
}: {
  bundle: ChatMessage[];
  me: string;
  group?: boolean;
  roomMembers: string[];
  onOpenImage: (att: Attachment, list: Attachment[]) => void;
  showTime: boolean;
  onLongPress: (m: ChatMessage) => void;
  onToggleEmoji?: (messageId: string, emoji: string) => void;
}) {
  const m = bundle[0];
  const mine = m.senderId === me;
  const unreadCount = roomMembers.filter((uid) => uid !== m.senderId && !m.readBy.includes(uid)).length;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMoving = useRef(false);

  const handleTouchStart = () => {
    isMoving.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isMoving.current) {
        onLongPress(m);
      }
    }, 600);
  };

  const handleTouchMove = () => {
    isMoving.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const fmtBubbleTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const renderGrid = () => {
    const attachments = bundle.map((msg) => msg.attachment).filter(Boolean) as Attachment[];
    if (attachments.length === 0) return null;
    const len = attachments.length;

    if (len === 2) {
      return (
        <div className="grid grid-cols-2 gap-1 w-52 h-28 overflow-hidden rounded-xl border border-black/10">
          {attachments.map((att, i) => (
            <button key={i} onClick={() => onOpenImage(att, attachments)} className="w-full h-full overflow-hidden block">
              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      );
    }

    if (len === 3) {
      return (
        <div className="flex gap-1 w-64 h-40 overflow-hidden rounded-xl border border-black/10">
          <button onClick={() => onOpenImage(attachments[0], attachments)} className="flex-1 h-full overflow-hidden block">
            <img src={attachments[0].url} alt={attachments[0].name} className="w-full h-full object-cover" />
          </button>
          <div className="flex flex-col gap-1 w-[38%] h-full">
            <button onClick={() => onOpenImage(attachments[1], attachments)} className="w-full h-[calc(50%-2px)] overflow-hidden block">
              <img src={attachments[1].url} alt={attachments[1].name} className="w-full h-full object-cover" />
            </button>
            <button onClick={() => onOpenImage(attachments[2], attachments)} className="w-full h-[calc(50%-2px)] overflow-hidden block">
              <img src={attachments[2].url} alt={attachments[2].name} className="w-full h-full object-cover" />
            </button>
          </div>
        </div>
      );
    }

    const displayList = attachments.slice(0, 4);
    const extraCount = attachments.length - 4;

    return (
      <div className="grid grid-cols-2 gap-1 w-60 h-60 overflow-hidden rounded-xl border border-black/10">
        {displayList.map((att, i) => {
          const isLast = i === 3 && extraCount > 0;
          return (
            <button
              key={i}
              onClick={() => onOpenImage(att, attachments)}
              className="relative w-full h-full overflow-hidden block"
            >
              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
              {isLast && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[16px] font-bold">
                  +{extraCount}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const bubbleMeta = (
    <div className={`mt-0.5 flex items-center gap-1.5 ${mine ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
      {mine && unreadCount > 0 && (
        <span className="text-[10px] font-extrabold leading-none" style={{ color: '#1890ff' }}>
          {unreadCount}
        </span>
      )}
      {showTime && <span className="text-[9.5px] tabular-nums text-ink3">{fmtBubbleTime(m.at)}</span>}
    </div>
  );

  const reactions = m.reactions as Record<string, string[]> | undefined;

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!mine && (
          <span style={{ backgroundColor: getAvatarStyle(m.senderId || '').bg, color: getAvatarStyle(m.senderId || '').text }} className="grid h-[30px] w-[30px] shrink-0 place-items-center self-end rounded-full text-[12px] font-bold">
            {m.senderName?.[0] ?? '?'}
          </span>
        )}
        <div className="group min-w-0">
          {!mine && group && <div className="mb-0.5 text-[10.5px] text-ink3">{m.senderName}</div>}
          {m.replyTo && (
            <div className={`mb-1 rounded-md border-l-2 px-2 py-1 ${mine ? 'border-amber/70 bg-black/[0.06]' : 'border-black/10 bg-black/[0.03]'}`}>
              <div className="text-[9.5px] font-bold text-ink2">{m.replyTo.senderName || '메시지'}</div>
              <div className="truncate text-[10px] text-ink3">{m.replyTo.text}</div>
            </div>
          )}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => { e.preventDefault(); onLongPress(m); }}
            className={`relative flex items-center gap-1 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {renderGrid()}
          </div>
          {reactions && Object.keys(reactions).length > 0 && (
            <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(reactions).map(([emoji, uids]) => {
                if (!uids || uids.length === 0) return null;
                const active = uids.includes(me);
                return (
                  <button
                    key={emoji}
                    onClick={() => onToggleEmoji?.(m.id, emoji)}
                    className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold shadow-3xs transition-all active:scale-95"
                    style={active
                      ? { background: '#e6960c20', borderColor: '#e6960c', color: '#e6960c' }
                      : { background: '#fff', borderColor: 'rgba(0,0,0,0.08)', color: '#666' }
                    }
                  >
                    <span>{emoji}</span>
                    <span className="tabular-nums">{uids.length}</span>
                  </button>
                );
              })}
            </div>
          )}
          {bubbleMeta}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  me,
  group,
  roomMembers,
  onOpenImage,
  showTime,
  isEditing,
  onCancelEdit,
  onLongPress,
  onToggleEmoji,
}: {
  m: ChatMessage;
  me: string;
  group?: boolean;
  roomMembers: string[];
  onOpenImage: (att: Attachment, list: Attachment[]) => void;
  showTime: boolean;
  isEditing: boolean;
  onCancelEdit: () => void;
  onLongPress: (msg: ChatMessage) => void;
  onToggleEmoji: (messageId: string, emoji: string) => void;
}) {
  const [editVal, setEditVal] = useState(m.text);
  const editMsg = useEditMessage(m.roomId);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMoving = useRef(false);

  useEffect(() => {
    setEditVal(m.text);
  }, [m.text]);

  const handleTouchStart = () => {
    isMoving.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isMoving.current) {
        onLongPress(m);
      }
    }, 600); // 0.6초 롱탭 인식
  };

  const handleTouchMove = () => {
    isMoving.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

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
          className="w-full bg-[#f8fbfe] text-[12px] text-ink border border-[#bae0ff] rounded-lg px-2 py-1.5 outline-none resize-none"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const val = editVal.trim();
              if (val) {
                editMsg.mutate({ messageId: m.id, text: val });
                onCancelEdit();
              }
            }
          }}
        />
        <div className="flex justify-end gap-1 text-[10px]">
          <button
            onClick={() => { onCancelEdit(); setEditVal(m.text); }}
            className="px-2 py-0.5 bg-black/5 text-ink2 rounded"
          >
            취소
          </button>
          <button
            onClick={async () => {
              const val = editVal.trim();
              if (!val) return;
              try {
                await editMsg.mutateAsync({ messageId: m.id, text: val });
                onCancelEdit();
              } catch (e) {
                window.alert("수정에 실패했습니다.");
              }
            }}
            disabled={editMsg.isPending}
            className="px-2 py-0.5 bg-[#4ea8de] text-white rounded disabled:opacity-50"
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
      <button 
        onClick={() => onOpenImage(att, [att])} 
        onContextMenu={(e) => { e.preventDefault(); onLongPress(m); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handleTouchStart}
        onPointerMove={handleTouchMove}
        onPointerUp={handleTouchEnd}
        className="block overflow-hidden rounded-2xl border border-black/10 select-none -webkit-touch-callout-none"
      >
        <img src={att.url} alt={att.name} className="max-h-52 max-w-full object-cover pointer-events-none" />
      </button>
    );
  } else if (m.type === 'file' && att) {
    body = (
      <button
        onClick={() => downloadAttachment(att)}
        onContextMenu={(e) => { e.preventDefault(); onLongPress(m); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handleTouchStart}
        onPointerMove={handleTouchMove}
        onPointerUp={handleTouchEnd}
        className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left select-none -webkit-touch-callout-none"
        style={mine ? { background: '#bae0ff', color: '#1c2536' } : { background: '#fff', color: '#1a202c' }}
      >
        <FileText size={18} className="shrink-0" />
        <span className="min-w-0 pointer-events-none">
          <span className="block max-w-[190px] truncate text-[12.5px] font-semibold">{att.name}</span>
          <span className={`block text-[10px] ${mine ? 'opacity-85' : 'text-ink3'}`}>{fmtSize(att.size)} · 다운로드</span>
        </span>
      </button>
    );
  } else {
    body = (
      <div
        onContextMenu={(e) => { e.preventDefault(); onLongPress(m); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handleTouchStart}
        onPointerMove={handleTouchMove}
        onPointerUp={handleTouchEnd}
        className="whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed cursor-pointer select-none -webkit-touch-callout-none"
        style={mine ? { background: '#bae0ff', color: '#1c2536' } : { background: '#fff', color: '#1a202c' }}
      >
        {m.text}
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[82%] gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!mine && (
          <span style={{ backgroundColor: getAvatarStyle(m.senderId || '').bg, color: getAvatarStyle(m.senderId || '').text }} className="grid h-[26px] w-[26px] shrink-0 place-items-center self-end rounded-full text-[11px] font-bold">
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
          </div>
          {/* 이모지 반응 배지 목록 */}
          {m.reactions && Object.keys(m.reactions as Record<string, string[]>).length > 0 && (
            <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(m.reactions as Record<string, string[]>).map(([emoji, uids]) => {
                if (!uids || uids.length === 0) return null;
                const active = uids.includes(me);
                return (
                  <button
                    key={emoji}
                    onClick={() => onToggleEmoji(m.id, emoji)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm transition-all"
                    style={active 
                      ? { background: '#e6960c20', borderColor: '#e6960c', color: '#e6960c' } 
                      : { background: '#fff', borderColor: 'rgba(0,0,0,0.08)', color: '#666' }
                    }
                  >
                    <span>{emoji}</span>
                    <span className="tabular-nums">{uids.length}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className={`mt-0.5 flex items-center gap-1.5 ${mine ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
            {mine && unreadCount > 0 && (
              <span className="text-[9.5px] font-extrabold leading-none" style={{ color: '#1890ff' }}>{unreadCount}</span>
            )}
            {showTime && (
              <span className="text-[9.5px] tabular-nums text-ink3">{fmtBubbleTime(m.at)}</span>
            )}
            {m.isEdited && (
              <span className="text-[8.5px] text-ink3/80 font-medium select-none">(수정됨)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 이미지 라이트박스 — 전체화면 원본 표시 + 다운로드 + 이전/다음 슬라이드. 배경/✕ 로 닫기. */
function ImageViewer({
  attachments,
  initialIdx,
  onClose,
}: {
  attachments: Attachment[];
  initialIdx: number;
  onClose: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  const att = attachments[currentIdx];

  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < attachments.length - 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrev) setCurrentIdx((prev) => prev - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNext) setCurrentIdx((prev) => prev + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        setCurrentIdx((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        setCurrentIdx((prev) => prev + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext]);

  if (!att) return null;

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/90 p-4">
      {/* 상단 헤더 영역 */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center gap-3 px-4 py-3 text-white"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
          {att.name} {attachments.length > 1 ? `(${currentIdx + 1}/${attachments.length})` : ''}
        </span>
        <button onClick={() => downloadAttachment(att)} title="다운로드" className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-[15px] active:bg-white/25">⤓</button>
        <button onClick={onClose} title="닫기" className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-[16px] active:bg-white/25">✕</button>
      </div>

      {/* 이미지 렌더링 및 이전/다음 버튼 */}
      <div className="relative flex w-full max-w-full items-center justify-center h-[75vh]" onClick={(e) => e.stopPropagation()}>
        {hasPrev && (
          <button
            onClick={handlePrev}
            title="이전 사진"
            className="absolute left-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-[20px] text-white hover:bg-black/60 active:scale-95 transition-all select-none"
          >
            ◀
          </button>
        )}
        <img src={att.url} alt={att.name} className="max-h-full max-w-full rounded-lg object-contain" />
        {hasNext && (
          <button
            onClick={handleNext}
            title="다음 사진"
            className="absolute right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-[20px] text-white hover:bg-black/60 active:scale-95 transition-all select-none"
          >
            ▶
          </button>
        )}
      </div>
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
    <div className="flex h-full flex-col" style={{ background: '#f2f8fc' }}>
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
          style={{ background: '#4ea8de' }}
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

function isSameDay(dateStr1?: string | null, dateStr2?: string | null): boolean {
  if (!dateStr1 || !dateStr2) return false;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isSameMinute(dateStr1?: string | null, dateStr2?: string | null): boolean {
  if (!dateStr1 || !dateStr2) return false;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate() &&
    d1.getHours() === d2.getHours() &&
    d1.getMinutes() === d2.getMinutes()
  );
}

function fmtDateDivider(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
}

export interface RenderMessageItem {
  type: 'message' | 'image-bundle';
  message: ChatMessage;
  bundleMessages?: ChatMessage[];
}

export function processMessageBundles(msgs: ChatMessage[]): RenderMessageItem[] {
  const items: RenderMessageItem[] = [];
  let i = 0;
  while (i < msgs.length) {
    const cur = msgs[i];
    if (cur.type !== 'image' || cur.text || !cur.attachment) {
      items.push({ type: 'message', message: cur });
      i++;
      continue;
    }

    const bundle: ChatMessage[] = [cur];
    let j = i + 1;
    while (j < msgs.length) {
      const next = msgs[j];
      if (
        next.type === 'image' &&
        !next.text &&
        next.attachment &&
        next.senderId === cur.senderId &&
        isSameMinute(cur.at, next.at)
      ) {
        bundle.push(next);
        j++;
      } else {
        break;
      }
    }

    if (bundle.length >= 2) {
      items.push({
        type: 'image-bundle',
        message: cur,
        bundleMessages: bundle,
      });
      i = j;
    } else {
      items.push({ type: 'message', message: cur });
      i++;
    }
  }
  return items;
}
