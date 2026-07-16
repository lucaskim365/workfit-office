import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, MouseEvent, PointerEvent, ReactNode, WheelEvent } from 'react';
import { Pill } from '@/shared/ui/Pill';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatRooms, useUnreadCounts, useCreateRoom, useInviteMembers, useLeaveRoom, useDeleteRoom } from '@/features/chat/useChatRooms';
import { useChatThread, useSendMessage, useSendAttachment, useMarkRead } from '@/features/chat/useChatThread';
import { useUsers } from '@/features/user/useUsers';
import { useGwSummary } from '@/features/gw/useGwSummary';
import { useOrgTree, type OrgNode } from '@/features/gw/useOrgTree';
import type { ChatRoom } from '@/domain/chatRoom/schema';
import { MAX_ATTACHMENT_BYTES, type ChatMessage, type Attachment } from '@/domain/chatMessage/schema';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/features/notification/useNotifications';

interface Tool {
  key: string;
  label: string;
  icon: string;
  color: string;
}

const DOCK_TOOLS: Tool[] = [
  { key: 'gw', label: '그룹웨어', icon: '🌐', color: '#c7ecc5' },
  { key: 'bot', label: 'Widdy', icon: '✦', color: '#a9c8f5' },
  { key: 'msg', label: '메신저', icon: '👤', color: '#eecfa2' },
];

function getRoomDisplayName(room: ChatRoom, me: string, users: any[]): string {
  if (room.type !== 'direct') return room.name;
  const otherId = room.members.find((m) => m !== me);
  if (!otherId) return room.name;
  const u = users.find((x) => x.id === otherId);
  return u ? `${u.name} ${u.position}` : room.name;
}

const PANEL_W = 384;

/** 메신저 알림 아이템 타입 (추후 실시간 알림 서비스로 교체 예정). */
interface MsgNoti {
  id: string;
  from: string;
  roomName: string;
  text: string;
  at: string;
  read: boolean;
}

/** 목업 메신저 알림 데이터. */
const MOCK_MSG_NOTIS: MsgNoti[] = [];

/** 우측 가장자리 퀵 도크(세로 책갈피 탭 + 슬라이드 패널). 와이어프레임 quick-dock.jsx 정본.
 * scrolling: 본문 스크롤 중이면 탭을 더 밀어내고 흐리게(양보) → 멈추면 복귀. */
export function QuickDock({ open, setOpen }: { open: string | null; setOpen: (v: string | null) => void }) {
  const tool = DOCK_TOOLS.find((t) => t.key === open);
  const [msgNotis, setMsgNotis] = useState<MsgNoti[]>(MOCK_MSG_NOTIS);
  const [msgNotiView, setMsgNotiView] = useState(false);
  const msgUnread = msgNotis.filter((n) => !n.read).length;

  // 메신저 패널이 닫힐때 알림 뷰도 닫음.
  useEffect(() => { if (open !== 'msg') setMsgNotiView(false); }, [open]);

  return (
    <>
      {/* dim */}
      <div
        onClick={() => setOpen(null)}
        className="fixed inset-0 z-[70] bg-navy-deep/30 transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />

      {/* 슬라이드 패널 */}
      <aside
        style={{
          width: PANEL_W,
          right: open ? 0 : -(PANEL_W + 12),
          backgroundColor: open === 'gw' ? '#f2faf3' : open === 'bot' ? '#eaf2ff' : open === 'msg' ? '#faf6f0' : '#f3f6fa'
        }}
        className="fixed bottom-0 top-0 z-[73] flex flex-col shadow-[-12px_0_40px_rgba(16,24,48,0.25)] transition-[right] duration-300"
      >
        {tool && tool.key === 'gw' && <GroupwarePanel onClose={() => setOpen(null)} />}
        {tool && tool.key !== 'gw' && (
          <>
            <DockHeader
              tool={tool}
              onClose={() => setOpen(null)}
              notiCount={tool.key === 'msg' ? msgUnread : undefined}
              notiView={tool.key === 'msg' ? msgNotiView : undefined}
              onNoti={tool.key === 'msg' ? () => { setMsgNotiView((v) => !v); setMsgNotis((list) => list.map((n) => ({ ...n, read: true }))); } : undefined}
            />
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {/* 메신저 패널 */}
              <div className="menu-scroll h-full overflow-y-auto">
                {tool.key === 'bot' && <ChatbotPanel />}
                {tool.key === 'msg' && <MessengerPanel />}
              </div>
              {/* 메신저 알림 기록 슬라이드 오버레이 */}
              {tool.key === 'msg' && (
                <div
                  className="absolute inset-0 flex flex-col overflow-hidden bg-[#faf6f0] transition-transform duration-300"
                  style={{ transform: msgNotiView ? 'translateX(0)' : 'translateX(100%)' }}
                >
                  <div className="border-b border-border px-4 py-2.5">
                    <p className="text-[11px] text-ink3">메신저 알림 기록</p>
                  </div>
                  <div className="menu-scroll flex-1 overflow-y-auto">
                    {msgNotis.length === 0 ? (
                      <div className="py-12 text-center text-[12px] text-ink3">알림이 없습니다.</div>
                    ) : (
                      msgNotis.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 border-b border-border px-4 py-3 ${n.read ? 'opacity-55' : ''}`}
                        >
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#eecfa2] text-[15px]">👤</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-[11.5px] font-bold text-ink">{n.from}</span>
                              <span className="shrink-0 text-[10px] text-ink3">{n.at}</span>
                            </div>
                            <div className="text-[10.5px] text-ink3">{n.roomName}</div>
                            <div className="mt-0.5 truncate text-[11.5px] text-ink2">{n.text}</div>
                          </div>
                          {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-danger" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function DockHeader({ tool, onClose, notiCount, notiView, onNoti }: { tool: Tool; onClose: () => void; notiCount?: number; notiView?: boolean; onNoti?: () => void }) {
  return (
    <header style={{ background: tool.color }} className="flex h-14 shrink-0 items-center justify-between px-4">
      <span className="flex items-center gap-2.5 text-ink">
        <span className="text-[17px]">{tool.icon}</span>
        <span className="text-[14.5px] font-extrabold">
          {notiView ? '메신저 알림' : tool.label}
        </span>
      </span>
      <div className="flex items-center gap-1">
        {/* 메신저 전용 알림 벨 아이콘 (notiView일 때는 닫기 버튼으로 표시) */}
        {onNoti && (
          <button
            onClick={onNoti}
            title={notiView ? '메신저로 돌아가기' : '알림 기록'}
            className="relative grid h-[30px] w-[30px] place-items-center rounded-lg bg-black/10 text-[14px] text-ink hover:bg-black/15 transition-colors"
          >
            {notiView ? '←' : '🔔'}
            {!notiView && notiCount != null && notiCount > 0 && (
              <span className="absolute -right-[3px] -top-[3px] grid h-[14px] min-w-[14px] place-items-center rounded-full border-[1.5px] border-[rgba(0,0,0,0.12)] bg-danger px-[2px] text-[8px] font-extrabold text-white">
                {notiCount}
              </span>
            )}
          </button>
        )}
        <button onClick={onClose} title="닫기" className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-black/10 text-[13px] text-ink hover:bg-black/15 transition-colors">
          ✕
        </button>
      </div>
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
  const CYAN = '#a2d8a0';
  const nav = useNavigate();
  const { user } = useAuth();
  const summary = useGwSummary(user?.id);
  const notis = useNotifications(user?.id);
  const unreadCount = notis.filter((n) => !n.read).length;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [showNotiPanel, setShowNotiPanel] = useState(false);

  // 타일 클릭 → 그룹웨어 앱 라우트로 이동하고 도크를 닫는다.
  const go = (to: string) => { nav(`/gw/${to}`); onClose(); };
  // 결재 문서 딥링크 → 결재함이 해당 문서를 품은 탭으로 이동·선택.
  const goDoc = (id: string) => { nav(`/gw/approval?doc=${id}`); onClose(); };
  const apps = [
    { l: '전자결재', icon: '🖋️', to: 'approval', badge: summary.pendingCount ? String(summary.pendingCount) : undefined, hot: true },
    { l: '일정관리', icon: '📅', to: 'calendar', hot: true },
    { l: '메일', icon: '✉️', to: 'mail', hot: true },
    { l: '자원예약', icon: '📦', to: 'resource', badge: '99+' },
    { l: '전자설문', icon: '📋', to: 'survey' },
    { l: '게시판', icon: '📌', to: 'board' },
    { l: '커뮤니티', icon: '💬', to: 'community' },
    { l: '문서관리', icon: '🗂️', to: 'document', badge: '9' },
    { l: '인명관리', icon: '👥', to: 'contacts' },
    { l: '업무관리', icon: '📗', to: 'task' },
    { l: '휴가관리', icon: '🏖️', to: 'leave' },
    { l: '조직도', icon: '🏢', to: 'orgchart' },
  ];
  const notices: [string, string][] = [
    ['[필독] 2분기 안전점검 일정 안내', '06.18'],
    ['하계 휴가 신청 마감 안내', '06.16'],
    ['사내 동호회 지원금 신청', '06.12'],
  ];
  return (
    <div className="flex h-full flex-col bg-[#f2faf3]">
      {/* 프로필 헤더 */}
      <header className="flex shrink-0 items-center gap-3 px-4 pb-[18px] pt-4" style={{ background: 'linear-gradient(135deg, #c7ecc5, #a2d8a0)' }}>
        <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full border-2 border-ink/20 bg-white/40 text-[20px] font-extrabold text-ink">
          {user?.name?.[0] ?? '?'}
        </span>
        <div className="min-w-0 flex-1 text-ink">
          <div className="text-[15.5px] font-extrabold tracking-tight">
            {user?.name ?? '게스트'} <span className="text-[11.5px] font-semibold opacity-90">{user?.position ?? ''}</span>
          </div>
          <div className="mt-0.5 text-[10.5px] opacity-90">{user?.dept ?? '-'}</div>
        </div>
        <button
          onClick={() => {
            setShowNotiPanel(!showNotiPanel);
          }}
          title="알림"
          className="relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-black/10 text-[14px] text-ink hover:bg-black/15 transition-colors"
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -right-[3px] -top-[3px] grid h-[15px] min-w-[15px] place-items-center rounded-full border-[1.5px] border-[#c7ecc5] bg-[#ff5b5b] px-[3px] text-[8px] font-extrabold text-white">
              {unreadCount}
            </span>
          )}
        </button>
        <button onClick={onClose} title="닫기" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-black/10 text-[14px] text-ink hover:bg-black/15 transition-colors">✕</button>
      </header>

      {/* 알림 레이어 */}
      {showNotiPanel && (
        <div className="absolute inset-x-0 top-[88px] z-50 flex max-h-[360px] flex-col border-b border-border bg-panel shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2 text-[11px] font-bold text-ink2">
            <span>실시간 알림 ({unreadCount})</span>
            {unreadCount > 0 && (
              <button
                onClick={() => user?.id && markAllRead.mutate(user.id)}
                className="text-[10px] text-teal hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>
          <div className="content-scroll min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1">
            {notis.length === 0 ? (
              <div className="py-8 text-center text-[11.5px] text-ink3">알림이 없습니다.</div>
            ) : (
              notis.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead.mutate(n.id);
                    setShowNotiPanel(false);
                    if (n.linkUrl) {
                      nav(n.linkUrl);
                      onClose();
                    }
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors ${n.read ? 'opacity-65 hover:bg-panel-alt' : 'bg-teal-soft/30 hover:bg-teal-soft/50'
                    }`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-panel border text-[13px]">
                    {n.type === '결재' ? '🖋️' : n.type === '메신저' ? '👤' : '📢'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-ink">{n.title}</span>
                      <span className="text-[9.5px] text-ink3">{n.senderName}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-normal text-ink2">{n.text}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 앱 타일 + 결재 + 공지 (스크롤) */}
      <div className="menu-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
        <div className="grid grid-cols-4 gap-2">
          {apps.map((a, i) => {
            const enabled = a.to === 'approval' || a.to === 'orgchart' || a.to === 'leave';
            return (
              <button
                key={i}
                onClick={() => { if (enabled) go(a.to); }}
                disabled={!enabled}
                title={enabled ? a.l : `${a.l} (준비 중)`}
                className={`relative flex aspect-square flex-col overflow-hidden rounded-xl border border-[#dceddd] bg-panel shadow-[0_1px_5px_rgba(20,140,120,0.07)] transition-shadow ${enabled
                    ? 'hover:shadow-[0_2px_10px_rgba(20,140,120,0.18)]'
                    : 'opacity-40 cursor-not-allowed filter grayscale'
                  }`}
              >
                <div className="truncate px-1.5 py-[5px] text-left text-[9px] font-bold" style={{ background: enabled && a.hot ? CYAN : 'transparent', color: enabled && a.hot ? '#1c2536' : '#2a3344' }}>{a.l}</div>
                <div className="grid flex-1 place-items-center pb-0.5"><span className="text-[17px] leading-none">{a.icon}</span></div>
                {enabled && a.badge && <span className="absolute right-1 grid h-[14px] min-w-[14px] place-items-center rounded-full border-[1.5px] border-white bg-[#ff5b5b] px-[3px] text-[8px] font-extrabold text-white" style={{ top: a.hot ? 4 : 5 }}>{a.badge}</span>}
              </button>
            );
          })}
        </div>

        <DockCard title="결재 대기" count={summary.pendingCount ? String(summary.pendingCount) : undefined}>
          {summary.pendingDocs.slice(0, 4).map((d, i, arr) => (
            <button
              key={d.id}
              onClick={() => goDoc(d.id)}
              className={`flex w-full items-center gap-2.5 py-2.5 text-left ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-ink">{d.title}</div>
                <div className="truncate text-[10px] text-ink3">{d.docNo} · {d.drafterDept || d.docType}</div>
              </div>
              <Pill tone="warn">대기</Pill>
            </button>
          ))}
          {summary.pendingDocs.length === 0 && (
            <div className="py-4 text-center text-[11px] text-ink3">결재할 문서가 없습니다.</div>
          )}
        </DockCard>

        <DockCard title="공지사항">
          {notices.map((n, i) => (
            <div
              key={i}
              className={`flex w-full justify-between gap-2 py-[9px] text-left ${i < notices.length - 1 ? 'border-b border-border' : ''} opacity-60`}
            >
              <span className="truncate text-[11.5px] font-medium text-ink2">{n[0]}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-ink3">{n[1]}</span>
            </div>
          ))}
        </DockCard>
      </div>
    </div>
  );
}

/* ---------- Widdy ---------- */
function ChatbotPanel() {
  const chips = ['오늘 생산 실적 알려줘', '설비 알람 현황', '재고 부족 품목', '결재 상신 방법'];
  const msgs: { who: 'bot' | 'me'; t: string }[] = [
    { who: 'bot', t: '안녕하세요,👋\nWiddy입니다. 무엇을 도와드릴까요?' },
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
              <div
                style={m.who === 'me' ? { backgroundColor: '#eecfa2', color: '#1c2536' } : undefined}
                className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${m.who === 'me' ? '' : 'border border-border bg-panel text-ink'}`}
              >
                {m.t}
              </div>
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
  const isAdmin = user?.roleGroup === 'ADMIN';
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const { data: rooms = [] } = useChatRooms(me);
  const { data: users = [] } = useUsers();
  const openRoom = rooms.find((r) => r.id === openRoomId) ?? null;

  // 방 입장 시 자동으로 숨김(삭제) 해제 처리
  useEffect(() => {
    if (openRoomId) {
      try {
        const hiddenKey = `workfit-hidden-rooms-${me}`;
        const hiddenStr = localStorage.getItem(hiddenKey);
        const hidden: string[] = hiddenStr ? JSON.parse(hiddenStr) : [];
        if (hidden.includes(openRoomId)) {
          const next = hidden.filter((id) => id !== openRoomId);
          localStorage.setItem(hiddenKey, JSON.stringify(next));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [openRoomId, me]);

  // 실시간으로 현재 보고 있는 대화방 ID(activeChatRoomId)를 유저 상태에 동기화
  useEffect(() => {
    const syncActiveRoom = async () => {
      try {
        const { userRepo } = await import('@/data/user/user.repo');
        await userRepo.updateActiveChatRoom(me, openRoomId);
      } catch (e) {
        console.error('Active room sync failed:', e);
      }
    };
    syncActiveRoom();

    // 언마운트되거나 openRoomId가 바뀔 때 activeChatRoomId 청소
    return () => {
      const clearActiveRoom = async () => {
        try {
          const { userRepo } = await import('@/data/user/user.repo');
          await userRepo.updateActiveChatRoom(me, null);
        } catch (e) {
          console.error('Active room clear failed:', e);
        }
      };
      clearActiveRoom();
    };
  }, [openRoomId, me]);

  if (composing) {
    return (
      <NewRoomView
        me={me}
        onCancel={() => setComposing(false)}
        onCreated={(id) => { setComposing(false); setOpenRoomId(id); }}
      />
    );
  }
  if (openRoom) {
    return <MessengerThread room={openRoom} me={me} meName={meName} isAdmin={isAdmin} users={users} onBack={() => setOpenRoomId(null)} />;
  }
  return <MessengerList rooms={rooms} me={me} users={users} onOpen={setOpenRoomId} onCompose={() => setComposing(true)} />;
}

function MessengerList({ rooms, me, users, onOpen, onCompose }: { rooms: ChatRoom[]; me: string; users: any[]; onOpen: (id: string) => void; onCompose: () => void }) {
  const { data: unread = {} } = useUnreadCounts(me);
  const [q, setQ] = useState('');
  const kw = q.trim().toLowerCase();

  // 📌 Pinned rooms state
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const val = localStorage.getItem('workfit-pinned-rooms');
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  const togglePin = (roomId: string) => {
    const next = pinnedIds.includes(roomId)
      ? pinnedIds.filter((id) => id !== roomId)
      : [...pinnedIds, roomId];
    setPinnedIds(next);
    localStorage.setItem('workfit-pinned-rooms', JSON.stringify(next));
  };

  // 🗑️ Hidden rooms state
  const [hiddenIds] = useState<string[]>(() => {
    try {
      const val = localStorage.getItem(`workfit-hidden-rooms-${me}`);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  // Context menu state
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; roomId: string } | null>(null);

  const visibleRooms = useMemo(() => {
    return rooms.filter((r) => {
      const isHidden = hiddenIds.includes(r.id);
      const hasUnread = (unread[r.id] ?? 0) > 0;
      return !isHidden || hasUnread;
    });
  }, [rooms, hiddenIds, unread]);

  const roomsWithNames = useMemo(() => {
    return visibleRooms.map((r) => ({
      ...r,
      displayName: getRoomDisplayName(r, me, users)
    }));
  }, [visibleRooms, me, users]);

  const filtered = kw ? roomsWithNames.filter((r) => r.displayName.toLowerCase().includes(kw)) : roomsWithNames;

  const sortedRooms = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const aTime = a.lastMessage?.at ? new Date(a.lastMessage.at).getTime() : 0;
      const bTime = b.lastMessage?.at ? new Date(b.lastMessage.at).getTime() : 0;
      return bTime - aTime;
    });
  }, [filtered, pinnedIds]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border-b border-border bg-panel px-4 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border-hi px-3.5 py-2">
          <span className="text-[12px] text-ink3">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름, 채팅방 검색"
            className="w-full bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink3"
          />
        </div>
        <button onClick={onCompose} title="새 대화" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber text-[19px] leading-none text-white">＋</button>
      </div>
      {sortedRooms.map((r) => {
        const n = unread[r.id] ?? 0;
        const isPinned = pinnedIds.includes(r.id);
        return (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuPos({ x: e.clientX, y: e.clientY, roomId: r.id });
            }}
            className={`flex w-full items-center gap-3 border-b border-border bg-panel px-4 py-3 text-left transition-colors hover:bg-panel-alt ${isPinned ? 'bg-panel-alt/45' : ''}`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[17px] font-bold" style={{ background: r.color + '22', color: r.color }}>
              {r.type === 'direct' ? r.displayName[0] : '👥'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <span className="truncate text-[12.5px] font-bold text-ink">
                  {r.displayName}
                  {isPinned && <span className="ml-1 text-[10px]" title="상단 고정됨">📌</span>}
                </span>
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

      {/* 우클릭 컨텍스트 메뉴 */}
      {menuPos && (
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setMenuPos(null)} onContextMenu={(e) => { e.preventDefault(); setMenuPos(null); }} />
          <div
            className="fixed z-[100] w-28 overflow-hidden rounded-lg border border-border bg-panel py-1 shadow-lg"
            style={{ top: menuPos.y, left: menuPos.x }}
          >
            <button
              onClick={() => { togglePin(menuPos.roomId); setMenuPos(null); }}
              className="block w-full px-3 py-2 text-left text-[11.5px] text-ink hover:bg-panel-alt transition-colors"
            >
              {pinnedIds.includes(menuPos.roomId) ? '📌 고정 해제' : '📌 상단 고정'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MessengerThread({ room, me, meName, isAdmin, users, onBack }: { room: ChatRoom; me: string; meName: string; isAdmin: boolean; users: any[]; onBack: () => void }) {
  const displayName = getRoomDisplayName(room, me, users);
  const { data: messages = [] } = useChatThread(room.id);
  const send = useSendMessage(room.id);
  const sendFile = useSendAttachment(room.id);
  const markRead = useMarkRead();
  const leave = useLeaveRoom();
  const remove = useDeleteRoom();
  const [text, setText] = useState('');
  const [inviting, setInviting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readonly = room.type === 'notice';

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
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
  // 나가기: 그룹 방만(1:1·공지는 제외). 삭제: 관리자만(모든 방).
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

  // 방 진입 시 읽음 처리.
  useEffect(() => {
    markRead.mutate({ roomId: room.id, userId: me });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, me]);

  // 새 메시지 도착 시 하단으로 스크롤.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filteredMessages.length]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    send.mutate({ text: t, senderId: me, senderName: meName });
    setText('');
  };

  if (inviting) {
    return <InviteView room={room} meName={meName} onCancel={() => setInviting(false)} onDone={() => setInviting(false)} />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 대화 서브헤더 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-panel px-2.5 py-2.5">
        <button onClick={onBack} title="목록" className="grid h-7 w-7 place-items-center rounded-lg text-[16px] text-ink2 hover:bg-panel-alt">←</button>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[14px] font-bold" style={{ background: room.color + '22', color: room.color }}>
          {room.type === 'direct' ? displayName[0] : '👥'}
        </span>
        <div className="min-w-0 flex-1 ml-0.5">
          <div className="truncate text-[12.5px] font-bold text-ink">{displayName}</div>
          {room.type !== 'direct' && <div className="text-[10px] text-ink3">{room.members.length}명</div>}
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

      {/* 대화 내 실시간 검색창 */}
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

      {/* 메시지 */}
      <div ref={scrollRef} className="menu-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {filteredMessages.map((m) => (
          <MessageBubble key={m.id} m={m} me={me} group={room.type === 'group'} roomMembers={room.members} onOpenImage={setViewer} />
        ))}
        {filteredMessages.length === 0 && searchQuery && (
          <div className="py-12 text-center text-[11.5px] text-ink3">검색된 메시지가 없습니다</div>
        )}
      </div>

      {viewer && <ImageViewer att={viewer} onClose={() => setViewer(null)} />}

      {/* 입력창 / 공지 안내 */}
      {readonly ? (
        <div className="shrink-0 border-t border-border bg-panel-alt px-4 py-3 text-center text-[11px] text-ink3">공지 전용 방입니다</div>
      ) : (
        <div className="shrink-0 border-t border-border bg-panel p-3">
          <div className="flex items-center gap-1.5 rounded-full border border-border-hi bg-panel py-1.5 pl-2 pr-1.5">
            <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={sendFile.isPending}
              title={`파일 첨부 (최대 ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB)`}
              className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[16px] text-ink3 hover:bg-panel-alt disabled:opacity-40"
            >
              📎
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              // 한글 IME 조합 중(isComposing) Enter 는 조합 확정용이라 무시 — 중복/부분 전송 방지.
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }}
              placeholder={sendFile.isPending ? '파일 전송 중…' : '메시지를 입력하세요…'}
              className="flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink3"
            />
            <button onClick={submit} className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-amber text-[14px] text-white">↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 바이트 → 사람이 읽는 크기(KB/MB). */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MessageBubble({ m, me, group, roomMembers, onOpenImage }: { m: ChatMessage; me: string; group: boolean; roomMembers: string[]; onOpenImage: (att: Attachment) => void }) {
  if (m.type === 'system') {
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-full bg-panel-alt px-3 py-1 text-[10.5px] text-ink3">{m.text}</span>
      </div>
    );
  }
  const mine = m.senderId === me;
  const att = m.attachment;

  // 전송 시각 포맷 (HH:MM)
  const fmtBubbleTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // 안 읽은 인원 수: 방 멤버 중 readBy 에 없는 사람 수 (본인 제외)
  const unreadCount = roomMembers.filter((uid) => uid !== m.senderId && !m.readBy.includes(uid)).length;

  let body: ReactNode;
  if (m.type === 'image' && att) {
    body = (
      <button onClick={() => onOpenImage(att)} title="크게 보기" className="block overflow-hidden rounded-xl border border-border">
        <img src={att.url} alt={att.name} className="max-h-52 w-auto max-w-full object-cover" />
      </button>
    );
  } else if (m.type === 'file' && att) {
    body = (
      <button
        type="button"
        onClick={() => downloadAttachment(att)}
        title="다운로드"
        style={mine ? { backgroundColor: '#eecfa2', color: '#1c2536' } : undefined}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? '' : 'border border-border bg-panel text-ink'}`}
      >
        <span className="text-[18px]">📄</span>
        <span className="min-w-0">
          <span className="block max-w-[180px] truncate text-[12px] font-semibold">{att.name}</span>
          <span className={`block text-[10px] ${mine ? 'opacity-85' : 'text-ink3'}`}>{fmtSize(att.size)} · 다운로드</span>
        </span>
      </button>
    );
  } else {
    body = (
      <div
        style={mine ? { backgroundColor: '#eecfa2', color: '#1c2536' } : undefined}
        className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? '' : 'border border-border bg-panel text-ink'}`}
      >
        {m.text}
      </div>
    );
  }

  // 말풍선 하단 메타 (시각 + 읽음 수)
  const bubbleMeta = (
    <div className={`mt-0.5 flex items-center gap-1 ${mine ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
      {/* 읽음 카운트: 내 메시지이고 안 읽은 사람이 있을 때만 노란색 숫자 표시 (카카오톡 '1' 스타일) */}
      {mine && unreadCount > 0 && (
        <span className="text-[9.5px] font-extrabold leading-none" style={{ color: '#e6960c' }}>
          {unreadCount}
        </span>
      )}
      <span className="text-[9.5px] tabular-nums text-ink3">{fmtBubbleTime(m.at)}</span>
    </div>
  );

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[82%] gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        {!mine && <span className="grid h-[26px] w-[26px] shrink-0 place-items-center self-end rounded-full bg-teal-soft text-[11px] font-bold text-teal">{m.senderName?.[0] ?? '?'}</span>}
        <div className="min-w-0">
          {!mine && group && <div className="mb-0.5 text-[10px] text-ink3">{m.senderName}</div>}
          {body}
          {bubbleMeta}
        </div>
      </div>
    </div>
  );
}

/**
 * 첨부 다운로드 — 원본 파일명 보존.
 * 업로드 시 Storage 객체에 `Content-Disposition: attachment; filename*=…`(원본명)을 심어두므로,
 * 앵커 클릭만으로 원본 파일명 다운로드가 강제된다(cross-origin 이라 `download` 속성 자체는 무시돼도
 * 응답 헤더가 우선). Firebase 미설정 폴백의 base64 data URL 은 same-origin 이라 `download` 속성이
 * 그대로 적용된다. (blob fetch 는 Storage 버킷 CORS 미설정 시 차단되어 쓰지 않음)
 */
function downloadAttachment(att: Attachment) {
  const a = document.createElement('a');
  a.href = att.url;
  a.download = att.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 이미지 라이트박스 — 첨부 이미지를 앱 내 오버레이로 원본 표시. Esc·배경·✕ 로 닫기. */
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

function ImageViewer({ att, onClose }: { att: Attachment; onClose: () => void }) {
  // scale(배율) + tx/ty(픽셀 이동). transform-origin 은 중앙 기준.
  const [z, setZ] = useState({ scale: 1, tx: 0, ty: 0 });
  const [panning, setPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, startY: 0, baseTx: 0, baseTy: 0, moved: false });

  // 이미지가 바뀌면 배율/이동 초기화.
  useEffect(() => { setZ({ scale: 1, tx: 0, ty: 0 }); }, [att.url]);

  const clamp = (n: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));

  /** 배율 변경 — (cx,cy) 화면 좌표를 고정점으로 확대(미지정 시 중앙 기준). */
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

  // 키보드: Esc 닫기, +/- 줌, 0 원본.
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
    if (z.scale <= 1) return; // 원본 크기에선 팬 없음(배경 클릭 닫기 유지)
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

  // 도크(aside)의 stacking context 밖(body)으로 portal — 뷰포트 전체를 덮도록.
  return createPortal(
    <div
      ref={containerRef}
      onClick={onClose}
      onWheel={onWheel}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black/85 p-6"
    >
      {/* 상단 바: 파일명 + 다운로드 + 닫기 */}
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
      {/* 하단 줌 컨트롤: 축소 · 배율(클릭 시 원본) · 확대 */}
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
      {/* 부서명 행 */}
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

      {/* 펼쳐진 하위 및 구성원 */}
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

/** 사용자 다중 선택 리스트(조직도 트리 구조). 방 생성·초대 공용. */
function MemberPicker({ exclude, selected, onToggle }: { exclude: string[]; selected: string[]; onToggle: (id: string) => void }) {
  const { roots, isLoading } = useOrgTree();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const isExpanded = (id: string) => expanded[id] !== false; // 기본값 펼침

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

/** 새 대화 만들기 — 멤버 다중 선택 → 1명은 1:1, 2명↑은 그룹방 생성. */
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

/** 그룹 멤버 초대 — 비참여자 다중 선택 → members 확장 + 시스템 메시지. */
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
