import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pill } from '@/shared/ui/Pill';
import profilePhoto from '@/assets/profile-honchaewon.png';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatRooms, useUnreadCounts } from '@/features/chat/useChatRooms';
import { useChatThread, useSendMessage, useMarkRead } from '@/features/chat/useChatThread';
import type { ChatRoom } from '@/domain/chatRoom/schema';
import type { ChatMessage } from '@/domain/chatMessage/schema';

interface Tool {
  key: string;
  label: string;
  icon: string;
  color: string;
}

const DOCK_TOOLS: Tool[] = [
  { key: 'gw', label: '그룹웨어', icon: '▦', color: '#16b8cf' },
  { key: 'bot', label: '위디', icon: '✦', color: '#17a89a' },
  { key: 'msg', label: '메신저', icon: '💬', color: '#e6960c' },
];

const PANEL_W = 384;

/** 우측 가장자리 퀵 도크(세로 책갈피 탭 + 슬라이드 패널). 와이어프레임 quick-dock.jsx 정본.
 * scrolling: 본문 스크롤 중이면 탭을 더 밀어내고 흐리게(양보) → 멈추면 복귀. */
export function QuickDock({ scrolling = false }: { scrolling?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const tool = DOCK_TOOLS.find((t) => t.key === open);

  return (
    <>
      {/* dim */}
      <div
        onClick={() => setOpen(null)}
        className="fixed inset-0 z-[70] bg-navy-deep/30 transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />

      {/* 세로 책갈피 탭 */}
      <div className="fixed right-0 top-1/2 z-[72] flex -translate-y-1/2 flex-col items-end">
        {DOCK_TOOLS.map((t, i) => {
          const peeked = hover === t.key || open === t.key;
          const first = i === 0;
          const last = i === DOCK_TOOLS.length - 1;
          // 평상시 22px만 노출, 스크롤 중엔 40px까지 양보(+흐리게), 호버/열림 시 완전 노출.
          const tx = peeked ? 0 : scrolling ? 40 : 22;
          return (
            <button
              key={t.key}
              onMouseEnter={() => setHover(t.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setOpen(open === t.key ? null : t.key)}
              style={{
                background: t.color,
                transform: `translateX(${tx}px)`,
                opacity: !peeked && scrolling ? 0.35 : 1,
                borderRadius: `${first ? 12 : 0}px 0 0 ${last ? 12 : 0}px`,
                boxShadow: '-4px 4px 14px rgba(16,24,48,.22)',
              }}
              className="flex w-8 flex-col-reverse items-center gap-2 pb-3.5 pt-3 text-white transition-[transform,opacity] duration-200"
            >
              <span className="rotate-[-90deg] text-base leading-none">{t.icon}</span>
              <span className="text-[12.5px] font-bold tracking-wide [writing-mode:sideways-lr]">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 슬라이드 패널 */}
      <aside
        style={{ width: PANEL_W, right: open ? 0 : -(PANEL_W + 12) }}
        className="fixed bottom-0 top-0 z-[73] flex flex-col bg-bg shadow-[-12px_0_40px_rgba(16,24,48,0.25)] transition-[right] duration-300"
      >
        {tool && tool.key === 'gw' && <GroupwarePanel onClose={() => setOpen(null)} />}
        {tool && tool.key !== 'gw' && (
          <>
            <DockHeader tool={tool} onClose={() => setOpen(null)} />
            <div className="menu-scroll min-h-0 flex-1 overflow-y-auto">
              {tool.key === 'bot' && <ChatbotPanel />}
              {tool.key === 'msg' && <MessengerPanel />}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function DockHeader({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  return (
    <header style={{ background: tool.color }} className="flex h-14 shrink-0 items-center justify-between px-4">
      <span className="flex items-center gap-2.5 text-white">
        <span className="text-[17px]">{tool.icon}</span>
        <span className="text-[14.5px] font-extrabold">{tool.label}</span>
      </span>
      <button onClick={onClose} title="닫기" className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-white/20 text-[15px] text-white">
        ›
      </button>
    </header>
  );
}

/** 도크 패널 공용 카드(흰 배경 + 틸 액센트 바). */
function DockCard({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-3.5 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-sm bg-teal" />
        <span className="text-[12.5px] font-bold text-ink">{title}</span>
        {count && <span className="rounded-full bg-danger/10 px-[7px] py-px text-[10px] font-extrabold text-danger">{count}</span>}
      </div>
      {children}
    </div>
  );
}

/* ---------- 그룹웨어 (앱 타일 그리드 + 결재 + 공지) ---------- */
function GroupwarePanel({ onClose }: { onClose: () => void }) {
  const CYAN = '#16b8cf';
  const apps = [
    { l: '전자결재', icon: '🖋️', badge: '3', hot: true },
    { l: '일정관리', icon: '📅', hot: true },
    { l: '메일', icon: '✉️', hot: true },
    { l: '자원예약', icon: '📦', badge: '99+' },
    { l: '전자설문', icon: '📋' },
    { l: '게시판', icon: '📌' },
    { l: '커뮤니티', icon: '💬' },
    { l: '문서관리', icon: '🗂️', badge: '9' },
    { l: '인명관리', icon: '👥' },
    { l: '업무관리', icon: '📗' },
    { l: '휴가관리', icon: '🏖️' },
    { l: '조직도', icon: '🏢' },
  ];
  const approvals: [string, string, string][] = [
    ['연차 휴가 신청', '김철수 · 생산1팀', '대기'],
    ['설비 구매 품의서', '이순신 · 설비보전팀', '대기'],
    ['외주 가공 계약 검토', '유관순 · 구매팀', '진행'],
  ];
  const notices: [string, string][] = [
    ['[필독] 2분기 안전점검 일정 안내', '06.18'],
    ['하계 휴가 신청 마감 안내', '06.16'],
    ['사내 동호회 지원금 신청', '06.12'],
  ];
  return (
    <div className="flex h-full flex-col bg-[#eaf7fb]">
      {/* 프로필 헤더 */}
      <header className="flex shrink-0 items-center gap-3 px-4 pb-[18px] pt-4" style={{ background: 'linear-gradient(135deg, #34d2de, #14b6cf)' }}>
        <img src={profilePhoto} alt="홍채원" className="h-[54px] w-[54px] shrink-0 rounded-full border-2 border-white/75 object-cover" />
        <div className="min-w-0 flex-1 text-white">
          <div className="text-[15.5px] font-extrabold tracking-tight">홍채원 <span className="text-[11.5px] font-semibold opacity-90">사원</span></div>
          <div className="mt-0.5 text-[10.5px] opacity-90">개발팀</div>
        </div>
        <button title="알림" className="relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white/20 text-[14px] text-white">
          🔔
          <span className="absolute -right-[3px] -top-[3px] grid h-[15px] min-w-[15px] place-items-center rounded-full border-[1.5px] border-white bg-[#ff5b5b] px-[3px] text-[8px] font-extrabold text-white">1</span>
        </button>
        <button onClick={onClose} title="닫기" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white/20 text-[16px] text-white">›</button>
      </header>

      {/* 앱 타일 + 결재 + 공지 (스크롤) */}
      <div className="menu-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
        <div className="grid grid-cols-4 gap-2">
          {apps.map((a, i) => (
            <button key={i} className="relative flex aspect-square flex-col overflow-hidden rounded-xl border border-[#dcecf1] bg-panel shadow-[0_1px_5px_rgba(20,120,140,0.07)]">
              <div className="truncate px-1.5 py-[5px] text-left text-[9px] font-bold" style={{ background: a.hot ? CYAN : 'transparent', color: a.hot ? '#fff' : '#2a3344' }}>{a.l}</div>
              <div className="grid flex-1 place-items-center pb-0.5"><span className="text-[17px] leading-none">{a.icon}</span></div>
              {a.badge && <span className="absolute right-1 grid h-[14px] min-w-[14px] place-items-center rounded-full border-[1.5px] border-white bg-[#ff5b5b] px-[3px] text-[8px] font-extrabold text-white" style={{ top: a.hot ? 4 : 5 }}>{a.badge}</span>}
            </button>
          ))}
        </div>

        <DockCard title="결재 대기" count="2">
          {approvals.map((a, i) => (
            <div key={i} className={`flex items-center gap-2.5 py-2.5 ${i < approvals.length - 1 ? 'border-b border-border' : ''}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a[2] === '대기' ? 'bg-amber' : 'bg-blue'}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-ink">{a[0]}</div>
                <div className="text-[10px] text-ink3">{a[1]}</div>
              </div>
              <Pill tone={a[2] === '대기' ? 'warn' : 'info'}>{a[2]}</Pill>
            </div>
          ))}
        </DockCard>

        <DockCard title="공지사항">
          {notices.map((n, i) => (
            <div key={i} className={`flex justify-between gap-2 py-[9px] ${i < notices.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="truncate text-[11.5px] font-medium text-ink2">{n[0]}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-ink3">{n[1]}</span>
            </div>
          ))}
        </DockCard>
      </div>
    </div>
  );
}

/* ---------- 위디 ---------- */
function ChatbotPanel() {
  const chips = ['오늘 생산 실적 알려줘', '설비 알람 현황', '재고 부족 품목', '결재 상신 방법'];
  const msgs: { who: 'bot' | 'me'; t: string }[] = [
    { who: 'bot', t: '안녕하세요, 김승기님 👋\n위디입니다. 무엇을 도와드릴까요?' },
    { who: 'me', t: '오늘 M-Line 생산 실적 알려줘' },
    { who: 'bot', t: '오늘 M-Line 실적은 4,182 EA로 목표 대비 104.5% 달성했습니다. 종합 가동률(OEE)은 87.4%입니다. 📈' },
    { who: 'me', t: '불량률은 어때?' },
    { who: 'bot', t: '현재 불량률은 312 PPM으로 전일 대비 6.1% 개선됐어요. 주요 결함은 Scratch(LB-1001)입니다.' },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.who === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[82%] gap-2 ${m.who === 'me' ? 'flex-row-reverse' : 'flex-row'}`}>
              {m.who === 'bot' && <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-teal-soft text-[14px] text-teal">✦</span>}
              <div className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${m.who === 'me' ? 'bg-blue text-white' : 'border border-border bg-panel text-ink'}`}>{m.t}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border bg-panel p-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {chips.map((c, i) => <span key={i} className="cursor-pointer rounded-full bg-teal-soft px-2.5 py-[5px] text-[10.5px] font-semibold text-teal">{c}</span>)}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border-hi bg-panel py-1.5 pl-4 pr-1.5">
          <span className="flex-1 text-[12px] text-ink3">메시지를 입력하세요…</span>
          <button className="grid h-[34px] w-[34px] place-items-center rounded-full bg-teal text-[14px] text-white">↑</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 메신저 ---------- */
/** ISO 시각 → 오늘 HH:MM / 어제 / MM/DD 표시. */
function fmtTime(iso?: string): string {
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

/** 메신저 패널 — 방 목록 ↔ 대화 뷰 2-state 전환. */
function MessengerPanel() {
  const { user } = useAuth();
  const me = user?.id ?? 'U001';
  const meName = user?.name ?? '김승기';
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const { data: rooms = [] } = useChatRooms(me);
  const openRoom = rooms.find((r) => r.id === openRoomId) ?? null;

  if (openRoom) {
    return <MessengerThread room={openRoom} me={me} meName={meName} onBack={() => setOpenRoomId(null)} />;
  }
  return <MessengerList rooms={rooms} me={me} onOpen={setOpenRoomId} />;
}

function MessengerList({ rooms, me, onOpen }: { rooms: ChatRoom[]; me: string; onOpen: (id: string) => void }) {
  const { data: unread = {} } = useUnreadCounts(me);
  const [q, setQ] = useState('');
  const kw = q.trim().toLowerCase();
  const filtered = kw ? rooms.filter((r) => r.name.toLowerCase().includes(kw)) : rooms;

  return (
    <div>
      <div className="border-b border-border bg-panel px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-border-hi px-3.5 py-2">
          <span className="text-[12px] text-ink3">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름, 채팅방 검색"
            className="w-full bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink3"
          />
        </div>
      </div>
      {filtered.map((r) => {
        const n = unread[r.id] ?? 0;
        return (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            className="flex w-full items-center gap-3 border-b border-border bg-panel px-4 py-3 text-left transition-colors hover:bg-panel-alt"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[17px] font-bold" style={{ background: r.color + '22', color: r.color }}>
              {r.type === 'direct' ? r.name[0] : '👥'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <span className="truncate text-[12.5px] font-bold text-ink">{r.name}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-ink3">{fmtTime(r.lastMessage?.at)}</span>
              </div>
              <div className="mt-0.5 flex justify-between gap-2">
                <span className="truncate text-[11.5px] text-ink3">{r.lastMessage?.text ?? '대화를 시작해보세요'}</span>
                {n > 0 && <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-danger px-[5px] text-[9.5px] font-extrabold text-white">{n}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MessengerThread({ room, me, meName, onBack }: { room: ChatRoom; me: string; meName: string; onBack: () => void }) {
  const { data: messages = [] } = useChatThread(room.id);
  const send = useSendMessage(room.id);
  const markRead = useMarkRead();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const readonly = room.type === 'notice';

  // 방 진입 시 읽음 처리.
  useEffect(() => {
    markRead.mutate({ roomId: room.id, userId: me });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, me]);

  // 새 메시지 도착 시 하단으로 스크롤.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    send.mutate({ text: t, senderId: me, senderName: meName });
    setText('');
  };

  return (
    <div className="flex h-full flex-col">
      {/* 대화 서브헤더 */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-panel px-3 py-2.5">
        <button onClick={onBack} title="목록" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] text-ink2 hover:bg-panel-alt">←</button>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[14px] font-bold" style={{ background: room.color + '22', color: room.color }}>
          {room.type === 'direct' ? room.name[0] : '👥'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-bold text-ink">{room.name}</div>
          {room.type !== 'direct' && <div className="text-[10px] text-ink3">{room.members.length}명</div>}
        </div>
      </div>

      {/* 메시지 */}
      <div ref={scrollRef} className="menu-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} me={me} group={room.type === 'group'} />
        ))}
      </div>

      {/* 입력창 / 공지 안내 */}
      {readonly ? (
        <div className="shrink-0 border-t border-border bg-panel-alt px-4 py-3 text-center text-[11px] text-ink3">공지 전용 방입니다</div>
      ) : (
        <div className="shrink-0 border-t border-border bg-panel p-3">
          <div className="flex items-center gap-2 rounded-full border border-border-hi bg-panel py-1.5 pl-4 pr-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="메시지를 입력하세요…"
              className="flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink3"
            />
            <button onClick={submit} className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-amber text-[14px] text-white">↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ m, me, group }: { m: ChatMessage; me: string; group: boolean }) {
  if (m.type === 'system') {
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-full bg-panel-alt px-3 py-1 text-[10.5px] text-ink3">{m.text}</span>
      </div>
    );
  }
  const mine = m.senderId === me;
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[82%] gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!mine && <span className="grid h-[26px] w-[26px] shrink-0 place-items-center self-end rounded-full bg-teal-soft text-[11px] font-bold text-teal">{m.senderName?.[0] ?? '?'}</span>}
        <div className="min-w-0">
          {!mine && group && <div className="mb-0.5 text-[10px] text-ink3">{m.senderName}</div>}
          <div className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? 'bg-blue text-white' : 'border border-border bg-panel text-ink'}`}>{m.text}</div>
        </div>
      </div>
    </div>
  );
}
