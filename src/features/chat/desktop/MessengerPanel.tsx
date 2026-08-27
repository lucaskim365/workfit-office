import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { ChangeEvent, MouseEvent, PointerEvent, ReactNode, WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatRooms, useCreateRoom, useInviteMembers, useLeaveRoom, useDeleteRoom, useUpdateRoomName } from '@/features/chat/useChatRooms';
import { useChatThread, useSendMessage, useSendAttachment, useMarkRead, useEditMessage, useUpdateMessageReactions } from '@/features/chat/useChatThread';
import { useUsers } from '@/features/user/useUsers';
import { useOrgTree, type OrgNode } from '@/features/gw/useOrgTree';
import type { ChatRoom } from '@/domain/chatRoom/schema';
import { MAX_ATTACHMENT_BYTES, type ChatMessage, type Attachment } from '@/domain/chatMessage/schema';

/** ISO 시각 → 오늘 HH:MM / 어제 / MM/DD 표시. */
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

// SW 알림 클릭(데스크톱) → 메신저 도크에서 열 방 ID 를 전달하는 브릿지.
let pendingChatRoomId: string | null = null;
export function requestOpenChatRoom(roomId: string): void {
  pendingChatRoomId = roomId || null;
  window.dispatchEvent(new CustomEvent('workfit-open-chat-room'));
}

function getRoomDisplayName(room: ChatRoom, me: string, users: any[]): string {
  if (room.type !== 'direct') return room.name;
  const otherId = room.members.find((m) => m !== me);
  if (!otherId) return room.name;
  const u = users.find((x) => x.id === otherId);
  return u ? `${u.name} ${u.position}` : room.name;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function msgPreview(m: ChatMessage): string {
  if (m.type === 'image') return '📷 사진';
  if (m.type === 'file') return `📎 ${m.attachment?.name ?? '파일'}`;
  return m.text;
}

function downloadAttachment(att: Attachment) {
  const a = document.createElement('a');
  a.href = att.url;
  a.download = att.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 메신저 패널 — 방 목록 ↔ 대화 뷰 2-state 전환. */
export function MessengerPanel() {
  const { user } = useAuth();
  const me = user?.id ?? 'U001';
  const meName = user?.name ?? '김승기';
  const isAdmin = user?.roleGroup === 'ADMIN';
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const { data: rooms = [] } = useChatRooms(me);
  const { data: users = [] } = useUsers();
  const openRoom = rooms.find((r) => r.id === openRoomId) ?? null;

  // 알림 클릭(데스크톱) → 지정된 방 열기. 마운트 직후 대기값 소비 + 이후 이벤트 수신.
  useEffect(() => {
    const consume = () => {
      if (pendingChatRoomId) {
        setComposing(false);
        setOpenRoomId(pendingChatRoomId);
        pendingChatRoomId = null;
      }
    };
    consume();
    window.addEventListener('workfit-open-chat-room', consume);
    return () => window.removeEventListener('workfit-open-chat-room', consume);
  }, []);

  const handleCreated = (id: string) => {
    setComposing(false);
    setOpenRoomId(id);
  };

  const handleHideRoom = (roomId: string) => {
    if (!window.confirm('이 채팅방을 대화 목록에서 숨기시겠습니까?\n(새로운 메시지가 오면 다시 표시됩니다.)')) return;
    try {
      const key = `workfit-hidden-rooms-${me}`;
      const hidden: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (!hidden.includes(roomId)) {
        localStorage.setItem(key, JSON.stringify([...hidden, roomId]));
      }
    } catch {
      /* 무시 */
    }
  };

  const visibleRooms = useMemo(() => {
    try {
      const key = `workfit-hidden-rooms-${me}`;
      const hidden: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      return rooms.filter((r) => !hidden.includes(r.id));
    } catch {
      return rooms;
    }
  }, [rooms, me]);

  if (composing) {
    return <NewRoomView me={me} onCancel={() => setComposing(false)} onCreated={handleCreated} />;
  }

  if (openRoom) {
    // 방 진입 시 로컬스토리지 숨김 해제
    try {
      const key = `workfit-hidden-rooms-${me}`;
      const hidden: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (hidden.includes(openRoom.id)) {
        localStorage.setItem(key, JSON.stringify(hidden.filter((id) => id !== openRoom.id)));
      }
    } catch {
      /* 무시 */
    }

    return (
      <MessengerThread
        room={openRoom}
        me={me}
        meName={meName}
        isAdmin={isAdmin}
        users={users}
        onBack={() => setOpenRoomId(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-panel px-4 py-2.5">
        <span className="text-[12.5px] font-bold text-ink2">대화방 ({visibleRooms.length})</span>
        <button
          onClick={() => setComposing(true)}
          title="새 대화방"
          className="grid h-7 w-7 place-items-center rounded-lg text-[15px] font-extrabold text-[#2a3344] hover:bg-panel-alt"
        >
          ＋
        </button>
      </div>

      <div className="menu-scroll flex-1 overflow-y-auto">
        {visibleRooms.length === 0 ? (
          <div className="py-12 text-center text-[12.5px] text-ink3">개설된 대화방이 없습니다.</div>
        ) : (
          visibleRooms.map((r) => {
            const display = getRoomDisplayName(r, me, users);
            // 내 미읽음 수
            const unread = r.lastMessage && r.lastMessage.senderId !== me && !(r.lastMessage as any).readBy?.includes(me);
            return (
              <div
                key={r.id}
                onClick={() => setOpenRoomId(r.id)}
                className="group relative flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-panel-alt cursor-pointer"
              >
                <span
                  style={{ background: r.color + '22', color: r.color }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[15px] font-bold"
                >
                  {r.type === 'direct' ? display[0] : '👥'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[12.5px] font-bold text-ink">{display}</span>
                    <span className="shrink-0 text-[10px] text-ink3">{fmtTime(r.lastMessage?.at)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-ink3">{r.lastMessage ? msgPreview(r.lastMessage as any) : '대화 내용이 없습니다.'}</div>
                </div>
                {unread && <span className="absolute right-4 top-[22px] h-2.5 w-2.5 rounded-full bg-danger" />}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHideRoom(r.id);
                  }}
                  title="대화방 숨기기"
                  className="absolute right-2 top-2 hidden h-5 w-5 place-items-center rounded bg-black/5 text-[9px] text-ink3 hover:bg-black/10 group-hover:grid"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MessengerThread({
  room,
  me,
  meName,
  isAdmin,
  users,
  onBack,
}: {
  room: ChatRoom;
  me: string;
  meName: string;
  isAdmin: boolean;
  users: any[];
  onBack: () => void;
}) {
  const displayName = getRoomDisplayName(room, me, users);
  const { data: messages = [] } = useChatThread(room.id);
  const send = useSendMessage(room.id);
  const sendFile = useSendAttachment(room.id);
  const markRead = useMarkRead();
  const leave = useLeaveRoom();
  const remove = useDeleteRoom();
  const updateRoomName = useUpdateRoomName();
  const updateReactions = useUpdateMessageReactions(room.id);

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

  const [text, setText] = useState('');
  const [inviting, setInviting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<{ m: ChatMessage; x: number; y: number; mine: boolean } | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenu) return;
    const close = () => setActiveMenu(null);
    const timer = setTimeout(() => {
      window.addEventListener('click', close);
      window.addEventListener('contextmenu', close);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [activeMenu]);

  const handleRenameRoom = async () => {
    if (room.createdBy !== me) {
      window.alert("채팅방을 생성한 사람만 이름을 변경할 수 있습니다.");
      return;
    }
    const newName = window.prompt("새로운 대화방 이름을 입력하세요:", room.name);
    if (!newName || !newName.trim() || newName === room.name) return;
    try {
      await updateRoomName.mutateAsync({ roomId: room.id, name: newName.trim(), userName: meName });
    } catch (e) {
      window.alert("방 이름 변경에 실패했습니다.");
    }
  };

  const [viewer, setViewer] = useState<Attachment | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readonly = room.type === 'notice';

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [showMemberList, setShowMemberList] = useState(false);
  const memberDetails = useMemo(() => {
    return room.members
      .map((mId) => users.find((u) => u.id === mId))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [room.members, users]);

  const [isDragging, setIsDragging] = useState(false);
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
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
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
  }, [room.id, attachedFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    if (readonly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (readonly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAttach(e.dataTransfer.files);
    }
  };

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      if (m.type === 'system') return false;
      const textMatch = m.text?.toLowerCase().includes(q);
      const fileMatch = m.attachment?.name?.toLowerCase().includes(q);
      return textMatch || fileMatch;
    });
  }, [messages, searchQuery]);

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAttach(e.target.files);
    }
    e.target.value = '';
  };

  const canLeave = room.type === 'group';
  const canDelete = isAdmin;

  const onLeave = async () => {
    if (leave.isPending) return;
    if (!window.confirm(`'${room.name}' 방에서 나가시겠어요?\n대화 내용은 보존됩니다.`)) return;
    await leave.mutateAsync({ roomId: room.id, userId: me, userName: meName });
    onBack();
  };
  const onDelete = async () => {
    if (remove.isPending) return;
    if (!window.confirm(`'${room.name}' 방을 삭제하시겠어요?\n목록에서 숨겨지지만 대화 내용은 보존되어 관리자가 조회할 수 있습니다.`)) return;
    await remove.mutateAsync({ roomId: room.id, adminId: me, adminName: meName });
    onBack();
  };
  const onDeleteDirect = () => {
    if (!window.confirm('채팅방을 목록에서 삭제하시겠어요?\n(새로운 대화를 시작하면 이전 대화가 다시 표시됩니다.)')) return;
    try {
      const hiddenKey = `workfit-hidden-rooms-${me}`;
      const hiddenStr = localStorage.getItem(hiddenKey);
      const hidden = hiddenStr ? JSON.parse(hiddenStr) : [];
      if (!hidden.includes(room.id)) {
        hidden.push(room.id);
        localStorage.setItem(hiddenKey, JSON.stringify(hidden));
      }
    } catch (e) {
      console.error(e);
    }
    onBack();
  };

  useEffect(() => {
    markRead.mutate({ roomId: room.id, userId: me });
  }, [room.id, me]);

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
        await sendFile.mutateAsync({
          file: attachedFiles[0].file,
          senderId: me,
          senderName: meName,
          text: t,
          replyTo: replyTo
            ? { id: replyTo.id, senderName: replyTo.senderName || '알 수 없음', text: msgPreview(replyTo as any) }
            : null,
        });

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
        replyTo: replyTo
          ? { id: replyTo.id, senderName: replyTo.senderName || '알 수 없음', text: msgPreview(replyTo as any) }
          : null,
      });
      setText('');
      setReplyTo(null);
    }
  };

  if (inviting) {
    return <InviteView room={room} meName={meName} onCancel={() => setInviting(false)} onDone={() => setInviting(false)} />;
  }

  return (
    <div
      onDragOver={handleDragOver}
      className="flex h-full flex-col relative"
    >
      {isDragging && !readonly && (
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
          onDrop={handleDrop}
          className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#f2f8fc]/95 backdrop-blur-xs border-2 border-dashed border-amber m-2 rounded-2xl"
        >
          <div className="text-[32px] mb-2">📥</div>
          <div className="text-[13px] font-extrabold text-[#1c2536]">여기에 파일을 놓아 전송</div>
          <div className="text-[10.5px] text-ink3 mt-1">최대 {Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB</div>
        </div>
      )}
      
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-panel px-2.5 py-2.5">
        <button onClick={onBack} title="목록" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] text-ink2 hover:bg-panel-alt">←</button>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[14px] font-bold" style={{ background: room.color + '22', color: room.color }}>
          {room.type === 'direct' ? displayName[0] : '👥'}
        </span>
        <div className="min-w-0 flex-1 ml-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-[12.5px] font-bold text-ink">{displayName}</span>
            {room.type === 'group' && room.createdBy === me && (
              <button
                onClick={handleRenameRoom}
                title="대화방 이름 변경"
                className="text-[10px] opacity-60 hover:opacity-100 hover:text-teal transition-all shrink-0 cursor-pointer"
              >
                ✏️
              </button>
            )}
          </div>
          {room.type !== 'direct' && (
            <button
              onClick={() => setShowMemberList((prev) => !prev)}
              className="text-[10px] text-ink3 hover:text-teal font-semibold hover:underline transition-colors flex items-center gap-0.5"
            >
              {room.members.length}명 {showMemberList ? '▲' : '▼'}
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setShowSearch((prev) => !prev);
            if (showSearch) setSearchQuery('');
          }}
          title="대화 검색"
          className={`grid h-7 w-7 place-items-center rounded-lg text-[15px] hover:bg-panel-alt ${showSearch ? 'text-amber bg-panel-alt' : 'text-ink2'}`}
        >
          🔍
        </button>
        {room.type === 'group' && (
          <button onClick={() => setInviting(true)} title="멤버 초대" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[17px] leading-none text-ink2 hover:bg-panel-alt">＋</button>
        )}
        {(canLeave || canDelete || room.type === 'direct') && (
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen((v) => !v)} title="더보기" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] leading-none text-ink2 hover:bg-panel-alt">⋮</button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-32 overflow-hidden rounded-lg border border-border bg-panel py-1 shadow-lg">
                  {canLeave && (
                    <button onClick={() => { setMenuOpen(false); onLeave(); }} className="block w-full px-3 py-2 text-left text-[12px] text-ink hover:bg-panel-alt">방 나가기</button>
                  )}
                  {canDelete && (
                    <button onClick={() => { setMenuOpen(false); onDelete(); }} className="block w-full px-3 py-2 text-left text-[12px] text-danger hover:bg-panel-alt">방 삭제</button>
                  )}
                  {room.type === 'direct' && (
                    <button onClick={() => { setMenuOpen(false); onDeleteDirect(); }} className="block w-full px-3 py-2 text-left text-[12px] text-danger hover:bg-panel-alt">채팅방 삭제</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showMemberList && room.type !== 'direct' && (
        <div className="shrink-0 border-b border-[#d0e6f7] bg-[#f2f8fc] px-4 py-3 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-ink2">대화방 참여자 ({memberDetails.length})</span>
            <button
              onClick={() => setShowMemberList(false)}
              className="text-[10px] text-ink3 hover:text-ink hover:underline"
            >
              닫기
            </button>
          </div>
          <div className="space-y-2">
            {memberDetails.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-[11.5px]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#bae0ff] text-[10px] font-bold text-[#1c2536]">
                  {m.name?.[0] ?? '?'}
                </span>
                <span className="font-semibold text-ink">{m.name}</span>
                <span className="text-[10px] text-ink3">{m.position ?? ''}</span>
                <span className="text-[10px] text-ink3">/ {m.dept ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSearch && (
        <div className="shrink-0 border-b border-border bg-panel px-4 py-2">
          <div className="flex items-center gap-2 rounded-full border border-border-hi bg-panel px-3 py-1.5">
            <span className="text-[11px] text-ink3">🔍</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="메시지 또는 첨부파일명 검색..."
              className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-ink3"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[10px] text-ink3 hover:text-ink w-4 h-4 grid place-items-center rounded bg-black/5"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="menu-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {filteredMessages.map((m, idx) => {
          const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
          const showDateDivider = !prevMsg || (() => {
            const d1 = new Date(m.at).toDateString();
            const d2 = prevMsg.at ? new Date(prevMsg.at).toDateString() : '';
            return d1 !== d2;
          })();

          const formatDateDivider = (iso?: string) => {
            if (!iso) return '';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            const y = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = dayNames[d.getDay()];
            return `${y}년 ${month}월 ${day}일 ${dayName}요일`;
          };

          return (
            <div key={m.id} className="space-y-2.5">
              {showDateDivider && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-panel-alt px-3.5 py-1 text-[10px] font-extrabold text-ink3 tracking-wider shadow-3xs border border-border/40 select-none">
                    📅 {formatDateDivider(m.at)}
                  </span>
                </div>
              )}
              <MessageBubble
                m={m}
                me={me}
                group={room.type === 'group'}
                roomMembers={room.members}
                onOpenImage={setViewer}
                onReply={setReplyTo}
                isEditing={editingMsgId === m.id}
                onStartEdit={() => setEditingMsgId(m.id)}
                onCancelEdit={() => setEditingMsgId(null)}
                onToggleEmoji={handleToggleEmoji}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const fontScaleStr = window.getComputedStyle(document.documentElement).getPropertyValue('--font-scale') || '1.1875';
                  const zoom = parseFloat(fontScaleStr) || 1.1875;
                  setActiveMenu({ m, x: e.clientX / zoom, y: e.clientY / zoom, mine: m.senderId === me });
                }}
              />
            </div>
          );
        })}
        {filteredMessages.length === 0 && searchQuery && (
          <div className="py-12 text-center text-[11.5px] text-ink3">검색된 메시지가 없습니다</div>
        )}
      </div>

      {viewer && <ImageViewer att={viewer} onClose={() => setViewer(null)} />}

      {readonly ? (
        <div className="shrink-0 border-t border-border bg-panel-alt px-4 py-3 text-center text-[11px] text-ink3">공지 전용 방입니다</div>
      ) : (
        <div className="shrink-0 border-t border-border bg-panel p-3">
          {replyTo && (
            <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-[3px] border-amber bg-panel-alt px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold text-amber">{(replyTo.senderName || '메시지')}에게 답장</div>
                <div className="truncate text-[11px] text-ink3">{msgPreview(replyTo as any)}</div>
              </div>
              <button onClick={() => setReplyTo(null)} title="답장 취소" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[13px] text-ink3 hover:bg-black/5">✕</button>
            </div>
          )}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 max-h-36 overflow-y-auto px-1 py-0.5 border-b border-border">
              {attachedFiles.map((item) => (
                <div key={item.id} className="relative w-14 h-14 rounded-lg border border-border-hi bg-panel-alt overflow-hidden flex items-center justify-center shrink-0 shadow-3xs">
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
                    className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full w-4 h-4 grid place-items-center text-[8px] transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border-hi bg-panel py-1 pl-2 pr-1.5">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={sendFile.isPending}
              title={`파일 첨부 (최대 ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB)`}
              className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[16px] text-ink3 hover:bg-panel-alt disabled:opacity-40"
            >
              📎
            </button>
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={sendFile.isPending ? '파일 전송 중…' : '메시지를 입력하세요…'}
              className="flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink3 resize-none max-h-20 py-1 leading-normal"
            />
            <button onClick={submit} className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-amber text-[14px] text-white">↑</button>
          </div>
        </div>
      )}
      {activeMenu && createPortal(
        <div
          style={{
            top: `${activeMenu.y}px`,
            left: `${activeMenu.x}px`,
            backgroundColor: '#ffffff',
            color: '#1c2536',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(16, 24, 48, 0.15)',
            right: 'auto',
            bottom: 'auto',
            margin: 0,
          }}
          className="fixed z-[99999] min-w-[150px] rounded-lg py-1 text-[11.5px] font-medium outline-none"
          onClick={() => setActiveMenu(null)}
        >
          {/* 이모지 리액션 단축 5종 */}
          <div className="flex items-center justify-around border-b border-border/40 px-2 py-1 bg-panel-alt/30" onClick={(e) => e.stopPropagation()}>
            {['👍', '❤️', '😄', '😮', '😢'].map((emoji) => {
              const list = (activeMenu.m.reactions as Record<string, string[]> | undefined)?.[emoji] ?? [];
              const active = list.includes(me);
              return (
                <button
                  key={emoji}
                  onClick={() => {
                    handleToggleEmoji(activeMenu.m.id, emoji);
                    setActiveMenu(null);
                  }}
                  className="grid h-6 w-6 place-items-center text-[13px] rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
                  style={active ? { background: '#e6960c20' } : undefined}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          {activeMenu.m.type === 'text' ? (
            <>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeMenu.m.text);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-black/5 transition-colors cursor-pointer"
              >
                메시지 복사
              </button>
              <button
                onClick={() => setReplyTo(activeMenu.m)}
                className="w-full px-3 py-1.5 text-left hover:bg-black/5 transition-colors cursor-pointer"
              >
                답장
              </button>
              {activeMenu.mine && (
                <button
                  onClick={() => setEditingMsgId(activeMenu.m.id)}
                  className="w-full px-3 py-1.5 text-left hover:bg-black/5 transition-colors text-teal cursor-pointer"
                >
                  수정
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setReplyTo(activeMenu.m)}
                className="w-full px-3 py-1.5 text-left hover:bg-black/5 transition-colors cursor-pointer"
              >
                답장
              </button>
              {activeMenu.m.attachment && (
                <button
                  onClick={() => downloadAttachment(activeMenu.m.attachment!)}
                  className="w-full px-3 py-1.5 text-left hover:bg-black/5 transition-colors cursor-pointer"
                >
                  다운로드
                </button>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function MessageBubble({
  m,
  me,
  group,
  roomMembers,
  onOpenImage,
  onReply,
  isEditing,
  onStartEdit: _onStartEdit,
  onCancelEdit,
  onContextMenu,
  onToggleEmoji,
}: {
  m: ChatMessage;
  me: string;
  group: boolean;
  roomMembers: string[];
  onOpenImage: (att: Attachment) => void;
  onReply: (m: ChatMessage) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleEmoji?: (messageId: string, emoji: string) => void;
}) {
  const [editVal, setEditVal] = useState(m.text);
  const editMsg = useEditMessage(m.roomId);

  useEffect(() => {
    setEditVal(m.text);
  }, [m.text]);

  if (m.type === 'system') {
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-full bg-panel-alt px-3 py-1 text-[10.5px] text-ink3">{m.text}</span>
      </div>
    );
  }
  const mine = m.senderId === me;
  const att = m.attachment;

  const fmtBubbleTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const unreadCount = roomMembers.filter((uid) => uid !== m.senderId && !m.readBy.includes(uid)).length;

  let body: ReactNode;
  if (isEditing) {
    body = (
      <div className="flex flex-col gap-1 w-full min-w-[180px]">
        <textarea
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          className="w-full bg-[#f8fbfe] text-[11.5px] text-ink border border-[#bae0ff] rounded-lg px-2 py-1.5 outline-none resize-none"
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
        <div className="flex justify-end gap-1 text-[9.5px]">
          <button
            onClick={() => { onCancelEdit(); setEditVal(m.text); }}
            className="px-1.5 py-0.5 bg-[#bae0ff]/30 text-ink2 rounded hover:bg-[#bae0ff]/50"
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
            className="px-1.5 py-0.5 bg-amber text-white rounded hover:bg-amber-dark disabled:opacity-50"
          >
            {editMsg.isPending ? '...' : '저장'}
          </button>
        </div>
      </div>
    );
  } else if (m.type === 'image' && att) {
    body = (
      <div className="flex flex-col gap-1.5" onContextMenu={onContextMenu}>
        <button onClick={() => onOpenImage(att)} title="크게 보기" className="block overflow-hidden rounded-xl border border-border">
          <img src={att.url} alt={att.name} className="max-h-52 w-auto max-w-full object-cover" />
        </button>
        {m.text && (
          <div
            style={mine ? { backgroundColor: '#bae0ff', color: '#1c2536' } : undefined}
            className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? '' : 'border border-border bg-panel text-ink'}`}
          >
            {m.text}
          </div>
        )}
      </div>
    );
  } else if (m.type === 'file' && att) {
    body = (
      <div className="flex flex-col gap-1.5" onContextMenu={onContextMenu}>
        <button
          type="button"
          onClick={() => downloadAttachment(att)}
          title="다운로드"
          style={mine ? { backgroundColor: '#bae0ff', color: '#1c2536' } : undefined}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? '' : 'border border-border bg-panel text-ink'}`}
        >
          <span className="text-[18px]">📄</span>
          <span className="min-w-0">
            <span className="block max-w-[180px] truncate text-[12px] font-semibold">{att.name}</span>
            <span className={`block text-[10px] ${mine ? 'opacity-85' : 'text-ink3'}`}>{fmtSize(att.size)} · 다운로드</span>
          </span>
        </button>
        {m.text && (
          <div
            style={mine ? { backgroundColor: '#bae0ff', color: '#1c2536' } : undefined}
            className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? '' : 'border border-border bg-panel text-ink'}`}
          >
            {m.text}
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <div
        style={mine ? { backgroundColor: '#bae0ff', color: '#1c2536' } : undefined}
        className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? '' : 'border border-border bg-panel text-ink'}`}
        onContextMenu={onContextMenu}
      >
        {m.text}
      </div>
    );
  }

  const bubbleMeta = (
    <div className={`mt-0.5 flex items-center gap-1.5 ${mine ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
      {mine && unreadCount > 0 && (
        <span className="text-[9.5px] font-extrabold leading-none" style={{ color: '#1890ff' }}>
          {unreadCount}
        </span>
      )}
      <span className="text-[9.5px] tabular-nums text-ink3">{fmtBubbleTime(m.at)}</span>
      {m.isEdited && (
        <span className="text-[8.5px] text-ink3/80 font-medium select-none">(수정됨)</span>
      )}
    </div>
  );

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[82%] gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!mine && <span className="grid h-[26px] w-[26px] shrink-0 place-items-center self-end rounded-full bg-teal-soft text-[11px] font-bold text-teal">{m.senderName?.[0] ?? '?'}</span>}
        <div className="group min-w-0">
          {!mine && group && <div className="mb-0.5 text-[10px] text-ink3">{m.senderName}</div>}
          {m.replyTo && (
            <div className={`mb-1 rounded-md border-l-2 px-2 py-1 ${mine ? 'border-amber/70 bg-black/[0.06]' : 'border-border-hi bg-panel-alt'}`}>
              <div className="text-[9.5px] font-bold text-ink2">{m.replyTo.senderName || '메시지'}</div>
              <div className="truncate text-[10.5px] text-ink3">{m.replyTo.text}</div>
            </div>
          )}
          <div
            className={`flex items-center gap-1 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {body}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => onReply(m)}
                title="답글"
                className="grid h-6 w-6 place-items-center rounded-full text-[12px] text-ink3 hover:bg-panel-alt"
              >
                ↩
              </button>
            </div>
          </div>
          {m.reactions && Object.keys(m.reactions as Record<string, string[]>).length > 0 && (
            <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(m.reactions as Record<string, string[]>).map(([emoji, uids]) => {
                if (!uids || uids.length === 0) return null;
                const active = uids.includes(me);
                return (
                  <button
                    key={emoji}
                    onClick={() => onToggleEmoji?.(m.id, emoji)}
                    className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold shadow-3xs transition-all hover:scale-105"
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

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

function ImageViewer({ att, onClose }: { att: Attachment; onClose: () => void }) {
  const [z, setZ] = useState({ scale: 1, tx: 0, ty: 0 });
  const [panning, setPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, startY: 0, baseTx: 0, baseTy: 0, moved: false });

  useEffect(() => { setZ({ scale: 1, tx: 0, ty: 0 }); }, [att.url]);

  const clamp = (n: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));

  const applyZoom = useCallback((calc: (prev: number) => number, cx?: number, cy?: number) => {
    setZ((prev) => {
      const s2 = clamp(calc(prev.scale));
      if (s2 === prev.scale) return prev;
      if (s2 <= ZOOM_MIN) return { scale: ZOOM_MIN, tx: 0, ty: 0 };
      const el = containerRef.current;
      let { tx, ty } = prev;
      if (el) {
        const r = el.getBoundingClientRect();
        const dx = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2);
        const dy = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
        const k = s2 / prev.scale;
        tx = tx * k + dx * (1 - k);
        ty = ty * k + dy * (1 - k);
      }
      return { scale: s2, tx, ty };
    });
  }, []);

  const reset = useCallback(() => setZ({ scale: 1, tx: 0, ty: 0 }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') applyZoom((s) => s * 1.4);
      else if (e.key === '-' || e.key === '_') applyZoom((s) => s / 1.4);
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, applyZoom, reset]);

  const onWheel = (e: WheelEvent) => {
    applyZoom((s) => s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  };
  const onDoubleClick = (e: MouseEvent) => {
    applyZoom((s) => (s > 1 ? 1 : 2.5), e.clientX, e.clientY);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (z.scale <= 1) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, baseTx: z.tx, baseTy: z.ty, moved: false };
    setPanning(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!panning) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    setZ((prev) => ({ ...prev, tx: drag.current.baseTx + dx, ty: drag.current.baseTy + dy }));
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!panning) return;
    setPanning(false);
    if (drag.current.moved) e.stopPropagation();
  };

  const pct = Math.round(z.scale * 100);

  return createPortal(
    <div
      ref={containerRef}
      onClick={onClose}
      onWheel={onWheel}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black/85 p-6"
    >
      <div className="absolute left-0 right-0 top-0 flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{att.name}</span>
        <button
          type="button"
          onClick={() => downloadAttachment(att)}
          title="다운로드"
          className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-[15px] hover:bg-white/25"
        >
          ⤓
        </button>
        <button onClick={onClose} title="닫기(Esc)" className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-[16px] hover:bg-white/25">✕</button>
      </div>
      <img
        src={att.url}
        alt={att.name}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`,
          transformOrigin: 'center center',
          transition: panning ? 'none' : 'transform 120ms ease-out',
          cursor: z.scale > 1 ? (panning ? 'grabbing' : 'grab') : 'zoom-in',
          touchAction: 'none',
        }}
        className="max-h-[86vh] max-w-full select-none rounded-lg object-contain shadow-2xl"
      />
      <div
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white/12 px-1.5 py-1 text-white backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={() => applyZoom((s) => s / 1.4)} title="축소(−)" className="grid h-8 w-8 place-items-center rounded-lg text-[17px] hover:bg-white/20">－</button>
        <button onClick={reset} title="원본(0)" className="min-w-[52px] rounded-lg px-2 py-1 text-[12px] font-semibold tabular-nums hover:bg-white/20">{pct}%</button>
        <button onClick={() => applyZoom((s) => s * 1.4)} title="확대(+)" className="grid h-8 w-8 place-items-center rounded-lg text-[17px] hover:bg-white/20">＋</button>
      </div>
    </div>,
    document.body,
  );
}

function OrgTreeNode({
  node,
  exclude,
  selected,
  onToggle,
  expanded,
  toggleExpand,
  isExpanded,
}: {
  node: OrgNode;
  exclude: string[];
  selected: string[];
  onToggle: (id: string) => void;
  expanded: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  isExpanded: (id: string) => boolean;
}) {
  const { rankOf } = useOrgTree();
  const show = isExpanded(node.dept.id);
  const deptUsers = useMemo(() => {
    const filtered = node.members.filter((u) => u.status === '사용' && !exclude.includes(u.id));
    return filtered.sort((a, b) => rankOf(a.position) - rankOf(b.position));
  }, [node.members, exclude, rankOf]);

  const hasContent = deptUsers.length > 0 || node.children.length > 0;
  if (!hasContent) return null;

  return (
    <div className="flex flex-col mt-0.5">
      <div
        onClick={() => toggleExpand(node.dept.id)}
        className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-black/5"
      >
        <span className="text-[10px] text-ink3 w-3 h-3 grid place-items-center">
          {show ? '▼' : '▶'}
        </span>
        <span className="text-[12px] font-bold text-ink2">{node.dept.name}</span>
        <span className="text-[10px] text-ink3">({node.members.filter((u) => u.status === '사용').length})</span>
      </div>

      {show && (
        <div className="flex flex-col pl-3.5 border-l border-border/50 ml-3.5 my-0.5 gap-0.5">
          {deptUsers.map((u) => {
            const on = selected.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => onToggle(u.id)}
                className="flex items-center gap-3 py-1.5 px-2 rounded-lg text-left hover:bg-panel-alt transition-colors w-full"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-soft text-[11px] font-bold text-teal">
                  {u.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-medium text-ink">{u.name}</span>
                  <span className="text-[10px] text-ink3 ml-1.5">{u.position}</span>
                </div>
                <span className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border text-[9px] font-bold ${on ? 'border-amber bg-amber text-white' : 'border-border-hi text-transparent'}`}>✓</span>
              </button>
            );
          })}

          {node.children.map((child) => (
            <OrgTreeNode
              key={child.dept.id}
              node={child}
              exclude={exclude}
              selected={selected}
              onToggle={onToggle}
              expanded={expanded}
              toggleExpand={toggleExpand}
              isExpanded={isExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberPicker({ exclude, selected, onToggle }: { exclude: string[]; selected: string[]; onToggle: (id: string) => void }) {
  const { roots, isLoading } = useOrgTree();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const isExpanded = (id: string) => expanded[id] !== false;

  if (isLoading) {
    return <div className="p-10 text-center text-[12px] text-ink3">조직도를 불러오는 중...</div>;
  }

  return (
    <div className="p-3.5 flex flex-col gap-0.5 select-none">
      {roots.map((root) => (
        <OrgTreeNode
          key={root.dept.id}
          node={root}
          exclude={exclude}
          selected={selected}
          onToggle={onToggle}
          expanded={expanded}
          toggleExpand={toggleExpand}
          isExpanded={isExpanded}
        />
      ))}
    </div>
  );
}

function NewRoomView({ me, onCancel, onCreated }: { me: string; onCancel: () => void; onCreated: (id: string) => void }) {
  const { data: users = [] } = useUsers();
  const create = useCreateRoom();
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const isGroup = selected.length >= 2;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pickedNames = users.filter((u) => selected.includes(u.id)).map((u) => u.name);

  const submit = async () => {
    if (!selected.length || create.isPending) return;
    const roomName = isGroup ? (name.trim() || pickedNames.join(', ')) : (pickedNames[0] ?? '새 대화');
    const room = await create.mutateAsync({
      name: roomName,
      type: isGroup ? 'group' : 'direct',
      members: [me, ...selected],
    });
    onCreated(room.id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-panel px-3 py-2.5">
        <button onClick={onCancel} title="취소" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] text-ink2 hover:bg-panel-alt">←</button>
        <div className="flex-1 text-[12.5px] font-bold text-ink">새 대화</div>
        <button
          onClick={submit}
          disabled={!selected.length || create.isPending}
          className="rounded-lg bg-amber px-3 py-1.5 text-[11.5px] font-bold text-white transition-opacity disabled:opacity-40"
        >
          {isGroup ? `그룹 만들기 (${selected.length})` : '대화 시작'}
        </button>
      </div>
      {isGroup && (
        <div className="shrink-0 border-b border-border bg-panel px-4 py-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={pickedNames.join(', ')}
            className="w-full rounded-lg border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink3"
          />
        </div>
      )}
      <div className="menu-scroll min-h-0 flex-1 overflow-y-auto">
        <MemberPicker exclude={[me]} selected={selected} onToggle={toggle} />
      </div>
    </div>
  );
}

function InviteView({ room, meName, onCancel, onDone }: { room: ChatRoom; meName: string; onCancel: () => void; onDone: () => void }) {
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
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-panel px-3 py-2.5">
        <button onClick={onCancel} title="취소" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] text-ink2 hover:bg-panel-alt">←</button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-bold text-ink">멤버 초대</div>
          <div className="text-[10px] text-ink3">{room.name}</div>
        </div>
        <button
          onClick={submit}
          disabled={!selected.length || invite.isPending}
          className="rounded-lg bg-amber px-3 py-1.5 text-[11.5px] font-bold text-white transition-opacity disabled:opacity-40"
        >
          초대 ({selected.length})
        </button>
      </div>
      <div className="menu-scroll min-h-0 flex-1 overflow-y-auto">
        <MemberPicker exclude={room.members} selected={selected} onToggle={toggle} />
      </div>
    </div>
  );
}
