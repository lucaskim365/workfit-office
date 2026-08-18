import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, MouseEvent, PointerEvent, ReactNode, WheelEvent } from 'react';
import { Pill } from '@/shared/ui/Pill';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useChatRooms, useUnreadCounts, useCreateRoom, useInviteMembers, useLeaveRoom, useDeleteRoom, useUpdateRoomName } from '@/features/chat/useChatRooms';
import { useChatThread, useSendMessage, useSendAttachment, useMarkRead, useEditMessage } from '@/features/chat/useChatThread';
import { useUsers } from '@/features/user/useUsers';
import { useGwSummary } from '@/features/gw/useGwSummary';
import { useOrgTree, type OrgNode } from '@/features/gw/useOrgTree';
import type { ChatRoom } from '@/domain/chatRoom/schema';
import { MAX_ATTACHMENT_BYTES, type ChatMessage, type Attachment } from '@/domain/chatMessage/schema';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/features/notification/useNotifications';
import { useWiddyChat } from '@/features/widdy/useWiddyChat';
import { fileStorage } from '@/shared/lib/storage';
import type { WiddyAttachment } from '@/domain/widdyChat/schema';

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

            const enabled = a.to === 'approval' || a.to === 'orgchart' || a.to === 'leave' || a.to === 'board' || a.to === 'community';

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
/** Widdy 챗봇 패널 — RAG 게이트웨이(useWiddyChat) 기반 실기능. ([[Widdy_RAG_연계_개발_계획서.md]] §10) */
/** Widdy 첨부 허용 확장자(server3 attach.py 추출 지원과 일치). */
const WIDDY_ACCEPT = '.txt,.pdf,.xlsx,.xls,.hwp,.jpg,.jpeg,.png,.bmp,.tif,.tiff,.gif';
/** 첨부 최대 크기 100MB. */
const WIDDY_MAX_BYTES = 100 * 1024 * 1024;

function ChatbotPanel() {
  const { user } = useAuth();
  const { messages, send, isSending } = useWiddyChat();
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 새 메시지/응답 상태 변화 시 하단으로 스크롤.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isSending]);

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ''; // 같은 파일 재선택 허용
    setAttachError('');
    if (!f) return;
    if (f.size > WIDDY_MAX_BYTES) {
      setAttachError('파일이 너무 큽니다 (최대 100MB).');
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (isSending || uploading) return;
    const text = input.trim();
    if (!text && !file) return;

    let attachment: WiddyAttachment | undefined;
    if (file) {
      try {
        setUploading(true);
        setAttachError('');
        const ext = file.name.split('.').pop() || 'bin';
        const rand = Math.random().toString(36).slice(2, 8);
        const key = `widdy-uploads/${user?.id ?? 'anon'}/${Date.now()}_${rand}.${ext}`;
        const url = await fileStorage.put(key, file, { contentType: file.type, filename: file.name });
        attachment = { key, name: file.name, size: file.size, url };
      } catch {
        setAttachError('첨부 업로드에 실패했습니다. 다시 시도해 주세요.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    send(text, attachment);
    setInput('');
    setFile(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((m) => {
          const me = m.role === 'user';
          const bubbleStyle = me
            ? { backgroundColor: '#eecfa2', color: '#1c2536' }
            : m.status === 'error'
              ? { backgroundColor: '#fdecea', color: '#b23b2e', borderColor: '#f0a89f' }
              : undefined;
          return (
            <div key={m.id} className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[82%] gap-2 ${me ? 'flex-row-reverse' : 'flex-row'}`}>
                {!me && <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-teal-soft text-[14px] text-teal">✦</span>}
                <div>
                  <div
                    style={bubbleStyle}
                    className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${me ? '' : 'border border-border bg-panel text-ink'}`}
                  >
                    {m.status === 'pending' ? <TypingDots /> : m.content}
                  </div>
                  {m.attachmentName && (
                    <div className={`mt-1 flex ${me ? 'justify-end' : 'justify-start'}`}>
                      <span className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full bg-teal-soft px-2 py-[3px] text-[10px] font-medium text-teal">📎 {m.attachmentName}</span>
                    </div>
                  )}
                  {m.citations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.citations.map((c, i) => {
                        const name = c.source.split('/').pop() || c.source || c.docId;
                        // 문서 청크는 위치 표시(#idx), 링크 없는 첨부/전체문서 citation 은 파일명만.
                        const label = c.url ? `${name}#${c.chunkIdx}` : name;
                        return c.url ? (
                          <a key={i} href={c.url} target="_blank" rel="noreferrer" className="rounded-full bg-teal-soft px-2 py-[3px] text-[10px] font-medium text-teal hover:underline">📎 {label}</a>
                        ) : (
                          <span key={i} className="rounded-full bg-teal-soft px-2 py-[3px] text-[10px] font-medium text-teal">📎 {label}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-border bg-panel p-3">
        {/* 선택된 첨부 미리보기 칩 */}
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-teal-soft/40 px-2.5 py-1.5">
            <span className="text-[13px]">📎</span>
            <span className="flex-1 truncate text-[11px] text-ink">{file.name}</span>
            <span className="shrink-0 text-[10px] text-ink3">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
            <button type="button" onClick={() => setFile(null)} disabled={uploading} aria-label="첨부 제거" className="shrink-0 text-ink3 hover:text-ink disabled:opacity-40">✕</button>
          </div>
        )}
        {attachError && <div className="mb-2 px-1 text-[10.5px] text-[#b23b2e]">{attachError}</div>}
        <input ref={fileRef} type="file" accept={WIDDY_ACCEPT} className="hidden" onChange={pickFile} />
        <form
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          className="flex items-center gap-2 rounded-full border border-border-hi bg-panel py-1.5 pl-2 pr-1.5"
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isSending || uploading}
            aria-label="파일 첨부"
            title="파일 첨부 (최대 100MB)"
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[15px] text-ink3 hover:bg-teal-soft hover:text-teal disabled:opacity-50"
          >
            📎
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={file ? '첨부에 대해 질문하거나 바로 전송하세요…' : '메시지를 입력하세요…'}
            className="flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink3"
          />
          <button type="submit" disabled={isSending || uploading || (!input.trim() && !file)} aria-label="전송" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-teal text-[14px] text-white disabled:opacity-50">
            {uploading ? '…' : '↑'}
          </button>
        </form>
      </div>
    </div>
  );
}

/** 응답 대기 중 타이핑 인디케이터(점 3개). */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="응답 작성 중">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal" />
    </span>
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

// SW 알림 클릭(데스크톱) → 메신저 도크에서 열 방 ID 를 전달하는 브릿지.
// AppShell 이 도크를 'msg' 로 연 뒤 requestOpenChatRoom() 을 호출하면,
// (이미 열려 있든 지금 막 열리든) MessengerPanel 이 이 값을 소비해 해당 방을 연다.
let pendingChatRoomId: string | null = null;
export function requestOpenChatRoom(roomId: string): void {
  pendingChatRoomId = roomId || null;
  window.dispatchEvent(new CustomEvent('workfit-open-chat-room'));
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
              const zoom = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--font-scale') || '1.1875') || 1;
              setMenuPos({ x: e.clientX / zoom, y: e.clientY / zoom, roomId: r.id });
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
  const updateRoomName = useUpdateRoomName();
  
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

  // 대화방 이동/마운트 해제 시 생성된 Object URL 정리
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
    e.target.value = ''; // 같은 파일 재선택 허용
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
          replyTo: replyTo
            ? { id: replyTo.id, senderName: replyTo.senderName || '알 수 없음', text: msgPreview(replyTo) }
            : null,
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
        replyTo: replyTo
          ? { id: replyTo.id, senderName: replyTo.senderName || '알 수 없음', text: msgPreview(replyTo) }
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
          className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#faf6f0]/95 backdrop-blur-xs border-2 border-dashed border-amber m-2 rounded-2xl"
        >
          <div className="text-[32px] mb-2">📥</div>
          <div className="text-[13px] font-extrabold text-[#1c2536]">여기에 파일을 놓아 전송</div>
          <div className="text-[10.5px] text-ink3 mt-1">최대 {Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB</div>
        </div>
      )}
      {/* 대화 서브헤더 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-panel px-2.5 py-2.5">
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

      {/* 참여자 목록 레이어 */}
      {showMemberList && room.type !== 'direct' && (
        <div className="shrink-0 border-b border-[#ebdcc5] bg-[#faf6f0] px-4 py-3 max-h-48 overflow-y-auto">
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
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eecfa2] text-[10px] font-bold text-[#1c2536]">
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

      {/* 입력창 / 공지 안내 */}
      {readonly ? (
        <div className="shrink-0 border-t border-border bg-panel-alt px-4 py-3 text-center text-[11px] text-ink3">공지 전용 방입니다</div>
      ) : (
        <div className="shrink-0 border-t border-border bg-panel p-3">
          {replyTo && (
            <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-[3px] border-amber bg-panel-alt px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold text-amber">{(replyTo.senderName || '메시지')}에게 답장</div>
                <div className="truncate text-[11px] text-ink3">{msgPreview(replyTo)}</div>
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
                  {/* 첨부 취소 플로팅 버튼 */}
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
              // Shift+Enter는 줄바꿈, 그냥 Enter는 전송. IME 조합 완료 검사 포함.
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
          className="fixed z-[99999] min-w-[120px] rounded-lg py-1 text-[11.5px] font-medium outline-none"
          onClick={() => setActiveMenu(null)}
        >
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

/** 메시지 미리보기(답글 인용·목록용). 모바일 preview 와 동일 규칙. */
function msgPreview(m: ChatMessage): string {
  if (m.type === 'image') return '📷 사진';
  if (m.type === 'file') return `📎 ${m.attachment?.name ?? '파일'}`;
  return m.text;
}

/** 바이트 → 사람이 읽는 크기(KB/MB). */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  if (isEditing) {
    body = (
      <div className="flex flex-col gap-1 w-full min-w-[180px]">
        <textarea
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          className="w-full bg-[#fcfaf5] text-[11.5px] text-ink border border-[#eecfa2] rounded-lg px-2 py-1.5 outline-none resize-none"
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
            className="px-1.5 py-0.5 bg-[#eecfa2]/30 text-ink2 rounded hover:bg-[#eecfa2]/50"
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
            style={mine ? { backgroundColor: '#eecfa2', color: '#1c2536' } : undefined}
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
          style={mine ? { backgroundColor: '#eecfa2', color: '#1c2536' } : undefined}
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
            style={mine ? { backgroundColor: '#eecfa2', color: '#1c2536' } : undefined}
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
        style={mine ? { backgroundColor: '#eecfa2', color: '#1c2536' } : undefined}
        className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${mine ? '' : 'border border-border bg-panel text-ink'}`}
        onContextMenu={onContextMenu}
      >
        {m.text}
      </div>
    );
  }

  // 말풍선 하단 메타 (시각 + 읽음 수)
  const bubbleMeta = (
    <div className={`mt-0.5 flex items-center gap-1.5 ${mine ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
      {/* 읽음 카운트: 내 메시지이고 안 읽은 사람이 있을 때만 노란색 숫자 표시 (카카오톡 '1' 스타일) */}
      {mine && unreadCount > 0 && (
        <span className="text-[9.5px] font-extrabold leading-none" style={{ color: '#e6960c' }}>
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
