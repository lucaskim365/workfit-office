import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useGwSummary } from '@/features/gw/useGwSummary';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/features/notification/useNotifications';
import { useUnseenCount } from '@/features/mail/useMailbox';
import { isMailBackendReady, isMailSampleData } from '@/data/mail/mail.client';
import { isGwAppReady } from '@/app/shell/gw-screens';
import { NOTIFICATION_TYPE_META } from '@/domain/liveNotification/schema';
import { Pill } from '@/shared/ui/Pill';

/** 도크 패널 공용 카드(흰 배경 + 틸 액센트 바). */
export function DockCard({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
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

export function GroupwarePanel({ onClose }: { onClose: () => void }) {
  const CYAN = '#a2d8a0';
  const nav = useNavigate();
  const { user } = useAuth();
  const summary = useGwSummary(user?.id);
  const notis = useNotifications(user?.id);
  const unreadCount = notis.filter((n) => !n.read).length;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [showNotiPanel, setShowNotiPanel] = useState(false);

  /**
   * 메일 타일 배지 — 전 계정 받은메일함 안 읽은 수.
   *
   * 메일 화면과 같은 캐시 키를 쓰므로 메일함에서 읽으면 도크 배지도 함께 내려간다.
   * 서버가 안 붙었으면 아예 묻지 않는다 — 목업 숫자가 진짜 배지로 보이면 안 된다.
   * 이 패널은 도크를 열었을 때만 그려져서 IMAP 왕복이 상시로 일어나지 않는다.
   */
  const mailUnseenQuery = useUnseenCount(isMailBackendReady || isMailSampleData ? user : null);
  const mailUnseen = useMemo(
    () => Object.values(mailUnseenQuery.data ?? {}).reduce((sum, count) => sum + count, 0),
    [mailUnseenQuery.data],
  );

  // 타일 클릭 → 그룹웨어 앱 라우트로 이동하고 도크를 닫는다.
  const go = (to: string) => { nav(`/gw/${to}`); onClose(); };
  // 결재 문서 딥링크 → 결재함이 해당 문서를 품은 탭으로 이동·선택.
  const goDoc = (id: string) => { nav(`/gw/approval?doc=${id}`); onClose(); };
  const apps = [
    { l: '전자결재', icon: '🖋️', to: 'approval', badge: summary.pendingCount ? String(summary.pendingCount) : undefined, hot: true },
    { l: '일정관리', icon: '📅', to: 'calendar', hot: true },
    { l: '메일', icon: '✉️', to: 'mail', badge: mailUnseen > 0 ? (mailUnseen > 99 ? '99+' : String(mailUnseen)) : undefined, hot: true },
    { l: '자원예약', icon: '📦', to: 'resource' },
    { l: '전자설문', icon: '📋', to: 'survey' },
    { l: '게시판', icon: '📌', to: 'board' },
    { l: '인명관리', icon: '👥', to: 'employee' },
    { l: '업무관리', icon: '📗', to: 'task' },
    { l: '업무계획', icon: '🗓️', to: 'work-plan' },
    { l: '휴가관리', icon: '🏖️', to: 'leave' },
    { l: '근태', icon: '⏱️', to: 'commute' },
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
                    {(n.type === '메신저' ? '👤' : NOTIFICATION_TYPE_META[n.type]?.icon) || '📢'}
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
            const enabled = isGwAppReady(a.to);
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
