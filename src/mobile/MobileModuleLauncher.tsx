import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  ClipboardCheck,
  Clock,
  Calendar,
  CheckSquare,
  Users,
  Megaphone,
  Building2,
  Mail,
  BarChart3,
  Camera,
  FolderGit2,
  Network,
  ChevronRight,
  Bell,
  ShieldCheck,
  ListTodo,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useApprovalBoxes } from '@/features/gw/useApprovals';
import { currentApproverIds, getPredecessorsOf } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { useMyPresence } from '@/features/userPresence/useUserPresence';
import { PresenceBadge } from '@/features/userPresence/PresenceIndicator';
import { enablePushForUser } from '@/shared/lib/messaging';
import { useSecurityContext } from '@/features/auth/useSecurityContext';
import { commutePolicy } from '@/domain/security/policy/commutePolicy';
import { workPlanPolicy } from '@/domain/security/policy/workPlanPolicy';
import MobileUserMenuSheet from './MobileUserMenuSheet';

interface ModuleItem {
  id: string;
  name: string;
  desc: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  color: string;
  badge?: number | string;
  badgeColor?: string;
  isReady: boolean;
}

interface ModuleCategory {
  title: string;
  items: ModuleItem[];
}

export default function MobileModuleLauncher() {
  const { user } = useAuth();
  const nav = useNavigate();
  const me = user?.id || '';

  const securityContext = useSecurityContext();
  const canAccessCommuteAdmin = useMemo(() => {
    return commutePolicy.canAccessCommuteAdmin(securityContext);
  }, [securityContext]);
  const canAccessWorkPlanAdmin = useMemo(() => {
    return workPlanPolicy.canAccessWorkPlanAdmin(securityContext);
  }, [securityContext]);

  const { presence: myPresence } = useMyPresence();
  const { byBox } = useApprovalBoxes(me);
  const preds = useMemo(() => (me ? getPredecessorsOf(me) : []), [me]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');

  // 미결재 건수 계산
  const pendingApprovals = useMemo(() => {
    if (!me) return 0;
    const list = byBox['대기'] ?? [];
    return list.filter((d: ApprovalDoc) => {
      const approvers = currentApproverIds(d);
      return approvers.includes(me) || approvers.some((id) => preds.includes(id));
    }).length;
  }, [byBox, me, preds]);

  // 오늘 날짜 텍스트
  const todayText = useMemo(() => {
    const now = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const day = days[now.getDay()];
    return `${y}. ${m}. ${d} (${day})`;
  }, []);

  const enablePush = async () => {
    setNotice('알림 설정 중…');
    const res = await enablePushForUser(me);
    setNotice(res.ok ? '✅ 알림이 켜졌습니다.' : `⚠️ 알림 실패 — ${res.error}`);
    setTimeout(() => setNotice(''), 5000);
  };

  const categories: ModuleCategory[] = useMemo(
    () => [
      {
        title: '결재 & 근태',
        items: [
          {
            id: 'approval',
            name: '전자결재',
            desc: '기안·품의·지출결의 등 온라인 문서 승인',
            path: '/m/approval',
            icon: ClipboardCheck,
            color: 'from-amber-500 to-orange-500',
            badge: pendingApprovals > 0 ? `${pendingApprovals}건 대기` : undefined,
            badgeColor: 'bg-rose-500 text-white',
            isReady: true,
          },
          {
            id: 'commute',
            name: '내 출퇴근·휴가',
            desc: '출퇴근 기록 및 개인 연차·휴가 잔여 조회',
            path: '/m/commute',
            icon: Clock,
            color: 'from-teal to-emerald-500',
            badge: '출퇴근',
            badgeColor: 'bg-teal/20 text-teal dark:text-teal-300',
            isReady: true,
          },
          ...(canAccessCommuteAdmin
            ? [
                {
                  id: 'commute-admin',
                  name: '근태·휴가 관제 센터',
                  desc: '전사/부서 임직원 실시간 출퇴근 및 이상근태 관제',
                  path: '/m/commute-admin',
                  icon: ShieldCheck,
                  color: 'from-blue-600 to-indigo-600',
                  badge: '관제센터',
                  badgeColor: 'bg-indigo-600 text-white shadow-2xs',
                  isReady: true,
                },
              ]
            : []),
        ],
      },
      {
        title: '업무 & 협업',
        items: [
          {
            id: 'task',
            name: '내 업무계획 (To-Do)',
            desc: '직원별 일일 업무 계획(To-Do) 및 실무 공유',
            path: '/m/task',
            icon: CheckSquare,
            color: 'from-emerald-500 to-teal',
            isReady: true,
          },
          ...(canAccessWorkPlanAdmin
            ? [
                {
                  id: 'work-plan-admin',
                  name: '팀·전사 업무 종합 현황',
                  desc: '팀원/전사원 주간 To-Do 매트릭스 및 진척률 모니터링',
                  path: '/m/work-plan-admin',
                  icon: ListTodo,
                  color: 'from-teal-600 to-emerald-700',
                  badge: '업무종합',
                  badgeColor: 'bg-emerald-600 text-white shadow-2xs',
                  isReady: true,
                },
              ]
            : []),
          {
            id: 'calendar',
            name: '일정관리',
            desc: '전사·개인 일정 캘린더 및 외근·출장·휴가 일정',
            path: '/m/calendar',
            icon: Calendar,
            color: 'from-blue-500 to-indigo-600',
            isReady: true,
          },
          {
            id: 'project',
            name: '프로젝트',
            desc: '회사 단위 프로젝트 협업 및 진행 현황 관리',
            path: '/m/project',
            icon: FolderGit2,
            color: 'from-indigo-600 to-purple-600',
            isReady: true,
          },
          {
            id: 'resource',
            name: '자원예약',
            desc: '회의실·차량·공용 장비의 사용 시간 예약',
            path: '/m/resource',
            icon: Building2,
            color: 'from-violet-500 to-purple-600',
            isReady: true,
          },
        ],
      },
      {
        title: '소통 & 편의',
        items: [
          {
            id: 'chat',
            name: '메신저',
            desc: '실시간 1:1 및 부서 대화방',
            path: '/m',
            icon: MessageSquare,
            color: 'from-teal-600 to-cyan-600',
            isReady: true,
          },
          {
            id: 'mail',
            name: '메일',
            desc: '사내·외부 비즈니스 소통 메일 시스템',
            path: '/m/mail',
            icon: Mail,
            color: 'from-sky-500 to-blue-600',
            isReady: true,
          },
          {
            id: 'board',
            name: '게시판',
            desc: '전사 공지·경조사·사내 규정 게시 및 확인',
            path: '/m/board',
            icon: Megaphone,
            color: 'from-rose-500 to-pink-600',
            isReady: true,
          },
          {
            id: 'contacts',
            name: '인명관리',
            desc: '임직원 연락처 검색, 전화·문자 및 메신저 소통',
            path: '/m/contacts',
            icon: Users,
            color: 'from-cyan-500 to-blue-500',
            isReady: true,
          },
          {
            id: 'orgchart',
            name: '조직도',
            desc: '부서 계층과 사원 배치·상급자 관계 조회',
            path: '/m/orgchart',
            icon: Network,
            color: 'from-blue-600 to-indigo-700',
            isReady: true,
          },
          {
            id: 'survey',
            name: '전자설문',
            desc: '임직원 대상 의견 수렴·만족도 조사',
            path: '/m/survey',
            icon: BarChart3,
            color: 'from-indigo-500 to-purple-500',
            isReady: true,
          },
          {
            id: 'gallery',
            name: '회사 갤러리',
            desc: '사내 행사, 전사 이벤트 및 활동 기록 공유',
            path: '/m/gallery',
            icon: Camera,
            color: 'from-fuchsia-500 to-pink-500',
            isReady: true,
          },
        ],
      },
    ],
    [pendingApprovals]
  );

  const initials = user?.name ? user.name.slice(-2) : 'WF';

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      {/* 1. 상단 네이비 헤더 */}
      <header
        className="flex items-center justify-between px-3.5 py-3 text-white shrink-0 shadow-xs"
        style={{ background: '#101830' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav('/m')}
            className="grid h-8.5 w-8.5 place-items-center rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/90 hover:text-white"
            title="메신저로 돌아가기"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-extrabold text-white tracking-tight">그룹웨어 메뉴</span>
            <span className="rounded-md bg-teal/20 px-1.5 py-0.2 text-[10px] font-bold text-teal">
              PWA
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 푸시 알림 버튼 */}
          <button
            type="button"
            onClick={enablePush}
            className="grid h-8.5 w-8.5 place-items-center rounded-xl hover:bg-white/10 active:scale-95 transition-all text-white/80 hover:text-white"
            title="푸시 알림 켜기"
          >
            <Bell size={18} strokeWidth={2} />
          </button>

          {/* 프로필 아바타 */}
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(true)}
            className="relative flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-white/30 transition-all active:scale-95"
            title="내 프로필 및 근무 상태"
          >
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.name}
                className="h-7.5 w-7.5 rounded-full object-cover border border-white/30"
              />
            ) : (
              <div
                className="grid h-7.5 w-7.5 place-items-center rounded-full text-[11px] font-bold text-white shadow-xs"
                style={{ background: '#17a89a' }}
              >
                {initials}
              </div>
            )}
          </button>
        </div>
      </header>

      {/* 알림 토스트 배너 */}
      {notice && (
        <div className="bg-teal px-3 py-1.5 text-center text-[11.5px] font-bold text-white animate-in fade-in">
          {notice}
        </div>
      )}

      {/* 2. 스크롤 가능한 본문 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
        {/* 상단 웰컴 & 퀵 서머리 카드 */}
        <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-ink3">{todayText}</span>
              <h2 className="text-[16px] font-extrabold text-ink tracking-tight mt-0.5">
                {user?.name || '사용자'} 님, 반갑습니다!
              </h2>
              <p className="text-[11px] text-ink2 mt-0.5">
                {user?.dept || '소속부서'} · {user?.position || '직급'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(true)}
              className="flex items-center gap-1 rounded-full border border-border bg-panel-alt px-2.5 py-1 text-[11px] font-bold hover:bg-panel transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <PresenceBadge status={myPresence.status} />
            </button>
          </div>

          {/* 퀵 바로가기 칩 2개 (대기 결재 & 메신저) */}
          <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => nav('/m/approval')}
              className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-left hover:bg-amber-500/15 transition-all active:scale-98"
            >
              <div>
                <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-400 block">미결재 문서</span>
                <span className="text-[13px] font-extrabold text-ink">
                  {pendingApprovals > 0 ? `${pendingApprovals}건 대기` : '대기 없음'}
                </span>
              </div>
              <ChevronRight size={14} className="text-amber-600" />
            </button>

            <button
              type="button"
              onClick={() => nav('/m')}
              className="flex items-center justify-between rounded-xl bg-teal/10 border border-teal/20 px-3 py-2 text-left hover:bg-teal/15 transition-all active:scale-98"
            >
              <div>
                <span className="text-[10.5px] font-bold text-teal block">메신저</span>
                <span className="text-[13px] font-extrabold text-ink">대화방 목록</span>
              </div>
              <ChevronRight size={14} className="text-teal" />
            </button>
          </div>
        </div>

        {/* 카테고리별 모듈 리스트 */}
        {categories.map((category) => (
          <div key={category.title} className="space-y-2">
            <h3 className="text-[12px] font-bold text-ink3 px-1 tracking-wider uppercase">
              {category.title}
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              {category.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => nav(item.path)}
                    className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-white p-3.5 text-left shadow-2xs hover:border-teal/50 hover:shadow-xs transition-all active:scale-97 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-xs`}
                      >
                        <IconComponent size={20} strokeWidth={2.2} />
                      </div>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9.5px] font-extrabold shadow-2xs ${item.badgeColor || 'bg-panel-alt text-ink2'}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <h4 className="text-[13px] font-bold text-ink group-hover:text-teal transition-colors tracking-tight">
                        {item.name}
                      </h4>
                      <p className="text-[10.5px] text-ink3 line-clamp-1 mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* 하단 여백 및 메신저 바로가기 퀵 바 */}
        <div className="pt-2 pb-6">
          <button
            type="button"
            onClick={() => nav('/m')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#101830] py-3 text-[13px] font-bold text-white shadow-md hover:bg-[#162344] active:scale-98 transition-all"
          >
            <MessageSquare size={16} />
            <span>메신저로 돌아가기</span>
          </button>
        </div>
      </div>

      {/* 내 프로필 및 상태 관리 시트 */}
      <MobileUserMenuSheet
        isOpen={isUserMenuOpen}
        onClose={() => setIsUserMenuOpen(false)}
      />
    </div>
  );
}
