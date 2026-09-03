import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { useSystemLogs } from '@/features/systemLog/useSystemLogs';
import type { SystemLog } from '@/domain/systemLog/schema';
import { useQueryClient } from '@tanstack/react-query';

const TONE: Record<SystemLog['type'], Tone> = { 접속: 'ok', 변경: 'warn' };
const TYPE_OPTIONS: Option[] = [
  { value: '', label: '전체 유형' },
  { value: '접속', label: '접속 (로그인)' },
  { value: '변경', label: '변경 (데이터/설정)' },
];

const PERIOD_OPTIONS: Option[] = [
  { value: 'all', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
];

/** 로그 관리 및 실시간 로그인 히스토리 모니터링 화면 */
export default function LogMgmtScreen() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'login' | 'all'>('login');
  const [period, setPeriod] = useState<string>('all');
  const [draft, setDraft] = useState({ type: '', q: '' });
  const [applied, setApplied] = useState(draft);

  const { data: logs = [], isLoading, refetch } = useSystemLogs();

  // 오늘 날짜 문자열 (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  // 1시간 전 타임스탬프 계산
  const oneHourAgo = useMemo(() => {
    return Date.now() - 60 * 60 * 1000;
  }, []);

  // 통계 KPI 계산
  const stats = useMemo(() => {
    const loginLogs = logs.filter((l) => l.type === '접속');
    const todayLogins = loginLogs.filter((l) => l.at.startsWith(todayStr));

    const todayUniqueUsers = new Set(todayLogins.map((l) => l.user));
    const recent1HourLogins = loginLogs.filter((l) => {
      try {
        const time = new Date(l.at.replace(' ', 'T')).getTime();
        return time >= oneHourAgo;
      } catch {
        return false;
      }
    });

    return {
      todayLoginCount: todayLogins.length,
      todayUniqueUserCount: todayUniqueUsers.size,
      recent1HourCount: recent1HourLogins.length,
      totalLogCount: logs.length,
    };
  }, [logs, todayStr, oneHourAgo]);

  // 필터링된 행 목록
  const rows = useMemo(() => {
    let list = logs;

    // 탭 필터 (로그인 전용 탭 vs 전체 로그 탭)
    if (activeTab === 'login') {
      list = list.filter((l) => l.type === '접속');
    }

    // 기간 필터
    if (period === 'today') {
      list = list.filter((l) => l.at.startsWith(todayStr));
    } else if (period === '7d' || period === '30d') {
      const days = period === '7d' ? 7 : 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      list = list.filter((l) => {
        try {
          return new Date(l.at.replace(' ', 'T')) >= cutoff;
        } catch {
          return true;
        }
      });
    }

    // 유형 필터
    if (applied.type) {
      list = list.filter((l) => l.type === applied.type);
    }

    // 검색어 필터 (사용자, 상세내용, 화면, IP)
    const kw = applied.q.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (l) =>
          l.user.toLowerCase().includes(kw) ||
          l.detail.toLowerCase().includes(kw) ||
          l.screen.toLowerCase().includes(kw) ||
          l.ip.toLowerCase().includes(kw),
      );
    }

    return list;
  }, [logs, activeTab, period, applied, todayStr]);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['systemLogs'] });
    refetch();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── 화면 헤더 ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">로그 및 접속 모니터링</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 실시간 로그인 이력 및 감사 로그</p>
        </div>
        <ActionBar actions={[{ preset: 'refresh', onClick: handleRefresh }]} />
      </div>

      {/* ── 상단 실시간 로그인 관제 KPI 카드 ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col rounded-xl border border-border bg-panel p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-ink3">오늘 로그인 총 횟수</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black text-teal">{stats.todayLoginCount}</span>
            <span className="text-[11px] font-semibold text-ink3">회</span>
          </div>
          <span className="mt-1 text-[10px] text-ink3">금일 00:00 이후 접속 집계</span>
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-panel p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-ink3">오늘 접속 임직원 수</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black text-navy">{stats.todayUniqueUserCount}</span>
            <span className="text-[11px] font-semibold text-ink3">명</span>
          </div>
          <span className="mt-1 text-[10px] text-ink3">오늘 로그인한 고유 계정</span>
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-panel p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-ink3">최근 1시간 활성 접속</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black text-amber">{stats.recent1HourCount}</span>
            <span className="text-[11px] font-semibold text-ink3">건</span>
          </div>
          <span className="mt-1 text-[10px] text-ink3">실시간 세션 유입 현황</span>
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-panel p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-ink3">전체 누적 로그</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-black text-ink">{stats.totalLogCount}</span>
            <span className="text-[11px] font-semibold text-ink3">건</span>
          </div>
          <span className="mt-1 text-[10px] text-ink3">접속 및 변경 감사 기록</span>
        </div>
      </div>

      {/* ── 관제 탭 전환 바 ── */}
      <div className="flex border-b border-border bg-panel text-[12.5px] font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('login')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-colors ${
            activeTab === 'login' ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'
          }`}
        >
          <span>🔐</span>
          <span>로그인 접속 이력 모니터링</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition-colors ${
            activeTab === 'all' ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'
          }`}
        >
          <span>⚙️</span>
          <span>전체 시스템 작업 로그</span>
        </button>
      </div>

      {/* ── 검색 및 필터 툴바 ── */}
      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="조회 기간">
          <Select value={period} onChange={(v) => setPeriod(v)} options={PERIOD_OPTIONS} width={110} />
        </FilterField>
        {activeTab === 'all' && (
          <FilterField label="로그 유형">
            <Select
              value={draft.type}
              onChange={(v) => setDraft({ ...draft, type: v })}
              options={TYPE_OPTIONS}
              width={120}
            />
          </FilterField>
        )}
        <FilterField label="검색어">
          <TextInput
            value={draft.q}
            onChange={(v) => setDraft({ ...draft, q: v })}
            placeholder="사번, 이름, 내용, IP"
            width={180}
            onEnter={() => setApplied(draft)}
          />
        </FilterField>
      </FilterBar>

      {/* ── 로그 목록 테이블 ── */}
      <Card
        title={activeTab === 'login' ? '실시간 로그인 접속 로그' : '전체 시스템 감사 로그'}
        action={<span className="text-[10.5px] text-ink3">조회된 이력: 총 {rows.length}건</span>}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b border-border bg-panel-alt text-[10.5px] font-bold text-ink2">
                <th className="px-3.5 py-2.5 text-left w-40 whitespace-nowrap">발생 일시</th>
                <th className="px-3.5 py-2.5 text-left w-36 whitespace-nowrap">사용자 (사번)</th>
                <th className="px-3.5 py-2.5 text-center w-20 whitespace-nowrap">유형</th>
                <th className="px-3.5 py-2.5 text-left w-32 whitespace-nowrap">접속 환경/화면</th>
                <th className="px-3.5 py-2.5 text-left">상세 내용</th>
                <th className="px-3.5 py-2.5 text-right w-36 whitespace-nowrap">접속 IP / 클라이언트</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="border-b border-border px-3 py-12 text-center text-[12px] text-ink3">
                    {isLoading ? '로그 데이터를 실시간으로 불러오는 중…' : '기록된 로그가 없습니다.'}
                  </td>
                </tr>
              )}
              {rows.map((l, i) => (
                <tr key={l.id} className={`transition-colors hover:bg-panel-alt/40 ${i % 2 ? 'bg-panel-alt/10' : 'bg-panel'}`}>
                  <td className="border-b border-border px-3.5 py-2.5 font-mono text-ink3 whitespace-nowrap">{l.at}</td>
                  <td className="border-b border-border px-3.5 py-2.5 font-bold text-ink whitespace-nowrap">{l.user}</td>
                  <td className="border-b border-border px-3.5 py-2.5 text-center whitespace-nowrap">
                    <Pill tone={TONE[l.type] || 'neutral'}>{l.type}</Pill>
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5 font-semibold text-ink2 whitespace-nowrap">{l.screen}</td>
                  <td className="border-b border-border px-3.5 py-2.5 text-ink2">{l.detail}</td>
                  <td className="border-b border-border px-3.5 py-2.5 text-right font-mono text-ink3 whitespace-nowrap">{l.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
