import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CalendarCheck2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useMyPresence } from '@/features/userPresence/useUserPresence';
import { PresenceBadge } from '@/features/userPresence/PresenceIndicator';
import { useLeave } from '@/features/gw/useLeave';
import { useCommuteEmployees, useCommuteMonth } from '@/features/commute/useCommute';
import MobileCommonHeader from './MobileCommonHeader';
import type { UserPresenceStatus } from '@/domain/userPresence/schema';

const pad = (v: number) => String(v).padStart(2, '0');

const timeOf = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

/**
 * 모바일 PWA 개인 출퇴근·휴가 화면 (모든 임직원 공통 기본 화면)
 */
export default function MobileCommuteScreen() {
  const { user } = useAuth();
  const nav = useNavigate();

  const { presence, updatePresence } = useMyPresence();
  const [currentTime, setCurrentTime] = useState(new Date());

  // 1초마다 시계 갱신
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 오늘 날짜 및 현재 월
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }, []);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  // 사원 정보 매핑 (commute empId)
  const { data: employees = [] } = useCommuteEmployees();
  const currentEmp = useMemo(() => {
    return employees.find((e) => e.name === user?.name);
  }, [employees, user?.name]);

  // 이번 달 근태 기록
  const { data: monthRows = [] } = useCommuteMonth(
    currentEmp?.empId ?? null,
    currentMonthStr
  );

  // 휴가 밸런스 조회
  const leaveBalance = useLeave(user?.id);

  // 오늘 근태 기록
  const todayRecord = useMemo(() => {
    return monthRows.find((r) => r.date === todayStr);
  }, [monthRows, todayStr]);

  const checkInTime = todayRecord?.inAt ? timeOf(todayRecord.inAt) : null;
  const checkOutTime = todayRecord?.outAt ? timeOf(todayRecord.outAt) : null;

  // 원클릭 상태 전환 핸들러
  const handleQuickStatus = async (newStatus: UserPresenceStatus, defaultMsg?: string) => {
    await updatePresence(newStatus, defaultMsg);
  };

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader title="근태·휴가" subtitle={user ? `${user.name} (${user.dept})` : ''} />

      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
        {/* 1. 디지털 시계 및 상태 카드 */}
        <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs text-center">
          <span className="text-[11px] font-bold text-ink3">
            {currentTime.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </span>

          <div className="text-[32px] font-black text-ink tracking-tight font-mono my-0.5">
            {pad(currentTime.getHours())}:{pad(currentTime.getMinutes())}:
            <span className="text-teal text-[24px]">{pad(currentTime.getSeconds())}</span>
          </div>

          <div className="flex items-center justify-center gap-1.5 my-2">
            <PresenceBadge status={presence.status} />
            {presence.message && (
              <span className="text-[11px] font-medium text-ink2 truncate max-w-[200px]">
                {presence.message}
              </span>
            )}
          </div>

          {/* 원클릭 근무 상태 변경 퀵 버튼 바 */}
          <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => handleQuickStatus('ONLINE', '')}
              className={`rounded-xl py-2 text-[11px] font-bold transition-all ${
                presence.status === 'ONLINE'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-panel-alt text-ink2 hover:bg-emerald-500/10 hover:text-emerald-600'
              }`}
            >
              🏢 업무 중
            </button>
            <button
              type="button"
              onClick={() => handleQuickStatus('MEETING', '회의 중')}
              className={`rounded-xl py-2 text-[11px] font-bold transition-all ${
                presence.status === 'MEETING'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-panel-alt text-ink2 hover:bg-blue-500/10 hover:text-blue-600'
              }`}
            >
              💼 회의 중
            </button>
            <button
              type="button"
              onClick={() => handleQuickStatus('OUTSIDE', '외근/식사')}
              className={`rounded-xl py-2 text-[11px] font-bold transition-all ${
                presence.status === 'OUTSIDE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-panel-alt text-ink2 hover:bg-amber-500/10 hover:text-amber-600'
              }`}
            >
              ☕ 외근/식사
            </button>
            <button
              type="button"
              onClick={() => handleQuickStatus('OFFLINE', '퇴근')}
              className={`rounded-xl py-2 text-[11px] font-bold transition-all ${
                presence.status === 'OFFLINE'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-panel-alt text-ink2 hover:bg-slate-700/10 hover:text-slate-700'
              }`}
            >
              🏠 퇴근
            </button>
          </div>
        </div>

        {/* 2. 오늘 출퇴근 기록 요약 */}
        <div className="rounded-2xl border border-teal/30 bg-teal-soft/15 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-teal text-white shadow-xs">
                <Clock size={16} />
              </div>
              <div>
                <span className="text-[12px] font-bold text-ink">오늘의 근태 기록</span>
                <p className="text-[10.5px] text-ink3">
                  {todayRecord ? (todayRecord.status === 'normal' ? '정상 근무' : todayRecord.status) : '출근 기록 대기'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-ink3 block">인정 근무시간</span>
              <span className="text-[13px] font-black text-teal">
                {todayRecord?.totalMin ? `${Math.floor(todayRecord.totalMin / 60)}시간 ${todayRecord.totalMin % 60}분` : '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-teal/20 text-center">
            <div className="rounded-xl bg-white/80 p-2 border border-teal/10">
              <span className="text-[10px] text-ink3 block">출근 시각</span>
              <span className="text-[14px] font-black text-ink">{checkInTime || '—'}</span>
            </div>
            <div className="rounded-xl bg-white/80 p-2 border border-teal/10">
              <span className="text-[10px] text-ink3 block">퇴근 시각</span>
              <span className="text-[14px] font-black text-ink">{checkOutTime || (checkInTime ? '근무 중' : '—')}</span>
            </div>
          </div>
        </div>

        {/* 3. 연차 / 휴가 밸런스 카드 */}
        <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CalendarCheck2 size={16} className="text-teal" />
              <h3 className="text-[13px] font-bold text-ink">연차 및 휴가 현황</h3>
            </div>
            <button
              type="button"
              onClick={() => nav('/m/approval')}
              className="flex items-center gap-1 text-[11px] font-bold text-teal hover:underline"
            >
              <span>휴가 신청하기</span>
              <ExternalLink size={12} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-panel-alt/50 p-2.5 border border-border/50">
              <span className="text-[10.5px] text-ink3 block">총 부여 연차</span>
              <span className="text-[14px] font-black text-ink">
                {leaveBalance?.grant ?? 15}일
              </span>
            </div>
            <div className="rounded-xl bg-panel-alt/50 p-2.5 border border-border/50">
              <span className="text-[10.5px] text-ink3 block">사용 연차</span>
              <span className="text-[14px] font-black text-rose-500">
                {leaveBalance?.used ?? 0}일
              </span>
            </div>
            <div className="rounded-xl bg-teal-soft/20 p-2.5 border border-teal/30">
              <span className="text-[10.5px] text-teal block font-bold">잔여 연차</span>
              <span className="text-[14px] font-black text-teal">
                {leaveBalance?.remaining ?? 15}일
              </span>
            </div>
          </div>

          <p className="text-[10.5px] text-ink3 leading-relaxed">
            💡 외근, 출장, 휴가(종일, 반차, 반반차)는 전자결재 기안 승인 시 근태 시스템에 자동으로 반영됩니다.
          </p>
        </div>

        {/* 4. 최근 출퇴근 이력 리스트 */}
        <div className="space-y-2 pb-6">
          <h3 className="text-[12.5px] font-bold text-ink px-1 flex items-center justify-between">
            <span>최근 출퇴근 기록 ({currentMonthStr})</span>
            <span className="text-[11px] text-ink3 font-normal">총 {monthRows.length}일</span>
          </h3>

          <div className="space-y-1.5">
            {monthRows.slice(0, 5).map((row) => (
              <div
                key={row.date}
                className="flex items-center justify-between rounded-xl border border-border bg-white px-3.5 py-2.5 shadow-2xs"
              >
                <div>
                  <div className="text-[12px] font-bold text-ink flex items-center gap-1.5">
                    <span>{row.date}</span>
                    {row.status && (
                      <span className="rounded bg-panel-alt px-1.5 py-0.2 text-[9.5px] font-bold text-ink2">
                        {row.status === 'normal' ? '정상' : row.status}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink3 mt-0.5">
                    출근 {timeOf(row.inAt)} · 퇴근 {timeOf(row.outAt)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11.5px] font-bold text-ink font-mono">
                    {row.totalMin ? `${Math.floor(row.totalMin / 60)}h ${row.totalMin % 60}m` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
