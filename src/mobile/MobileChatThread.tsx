import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatThread, useSendMessage, useMarkRead } from '@/features/chat/useChatThread';
import { useChatRooms } from '@/features/chat/useChatRooms';

/** 모바일 대화창 — 메시지 목록 + 전송(+ 답글 인용 렌더). */
export default function MobileChatThread() {
  const { roomId = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const me = user!.id;

  const { data: messages = [] } = useChatThread(roomId);
  const { data: rooms = [] } = useChatRooms(me);
  const room = rooms.find((r) => r.id === roomId);
  const send = useSendMessage(roomId);
  const markRead = useMarkRead();

  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markRead.mutate({ roomId, userId: me });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    send.mutate({ text: t, senderId: me, senderName: user!.name });
    setText('');
  };

  return (
    <div className="flex h-full flex-col" style={{ background: '#faf6f0' }}>
      <header className="flex items-center gap-2 px-2 py-3 text-white" style={{ background: '#101830' }}>
        <button onClick={() => nav('/m')} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[18px] hover:bg-white/10">←</button>
        <span className="truncate text-[15px] font-bold">{room?.name ?? '채팅방'}</span>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-10 text-center text-[12px] text-ink3">대화 내용이 없습니다.</div>
        )}
        {messages.map((m) => {
          if (m.type === 'system') {
            return (
              <div key={m.id} className="my-1 flex justify-center">
                <span className="rounded-full bg-black/5 px-3 py-1 text-[10.5px] text-ink3">{m.text}</span>
              </div>
            );
          }
          const mine = m.senderId === me;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[78%]">
                {!mine && room?.type === 'group' && <div className="mb-0.5 text-[10px] text-ink3">{m.senderName}</div>}
                {m.replyTo && (
                  <div className="mb-1 truncate rounded-md border-l-2 border-black/20 bg-black/[0.06] px-2 py-1 text-[10.5px] text-ink3">
                    <b>{m.replyTo.senderName || '메시지'}</b> {m.replyTo.text}
                  </div>
                )}
                <div
                  className="whitespace-pre-line break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed"
                  style={mine ? { background: '#e6960c', color: '#fff' } : { background: '#fff', color: '#1a202c' }}
                >
                  {m.type === 'image' && m.attachment ? (
                    <a href={m.attachment.url} target="_blank" rel="noreferrer">
                      <img src={m.attachment.url} alt={m.attachment.name} className="max-h-52 max-w-full rounded-lg" />
                    </a>
                  ) : m.type === 'file' && m.attachment ? (
                    <a href={m.attachment.url} target="_blank" rel="noreferrer" className="underline">
                      📎 {m.attachment.name}
                    </a>
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="flex items-center gap-2 border-t border-black/10 bg-white p-2.5"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }}
          placeholder="메시지를 입력하세요…"
          className="min-w-0 flex-1 rounded-full bg-black/5 px-4 py-2.5 text-[13px] text-ink outline-none"
        />
        <button onClick={submit} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] text-white" style={{ background: '#e6960c' }}>
          ↑
        </button>
      </div>
    </div>
  );
}
