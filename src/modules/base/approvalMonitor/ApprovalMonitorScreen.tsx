import { useMemo, useState } from 'react';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { currentApproverIds } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { useAuth } from '@/app/auth/AuthProvider';

type MonitorTab = 'ALL' | '진행중' | '완료' | '반려' | '임시저장' | '회수';

const TAB_LABELS: Record<MonitorTab, string> = {
  ALL: '전체 문서',
  진행중: '진행중',
  완료: '완료',
  반려: '반려',
  임시저장: '임시저장',
  회수: '회수',
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  진행중: { bg: 'bg-[#eaf2ff]', text: 'text-[#1243b5]' },
  완료: { bg: 'bg-[#f2faf3]', text: 'text-[#17a89a]' },
  반려: { bg: 'bg-[#fff5f5]', text: 'text-[#e53e3e]' },
  임시저장: { bg: 'bg-panel-alt', text: 'text-ink3' },
  회수: { bg: 'bg-[#faf6f0]', text: 'text-[#e6960c]' },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${mm}.${dd} ${hh}:${min}`;
}

export default function ApprovalMonitorScreen() {
  const { user } = useAuth();
  if (user?.id !== 'U012') {
    return (
      <div className="flex h-[calc(100vh-130px)] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-panel p-8 text-center max-w-md shadow-sm">
          <span className="text-4xl">🔒</span>
          <h2 className="text-lg font-bold text-ink">접근 권한 제한</h2>
          <p className="text-xs leading-relaxed text-ink2">
            죄송합니다. 이 화면은 <b>홍채원</b> 사원 전용 모니터링 관리 화면입니다. 다른 사용자는 접근할 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  const { data: allDocs = [], isLoading } = useAllApprovals();
  const org = useOrgTree();
  const [tab, setTab] = useState<MonitorTab>('ALL');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  const nameOf = (id: string) => org.userById(id)?.name ?? id;

  // 1. 검색 및 필터링
  const filtered = useMemo(() => {
    let list = [...allDocs];
    if (tab !== 'ALL') {
      list = list.filter((d) => d.status === tab);
    }
    const kw = q.trim().toLowerCase();
    if (kw) {
      list = list.filter((d) => {
        const titleMatch = d.title.toLowerCase().includes(kw);
        const docNoMatch = d.docNo?.toLowerCase().includes(kw) ?? false;
        const drafterMatch = nameOf(d.drafterId).toLowerCase().includes(kw);
        const typeMatch = d.docType.toLowerCase().includes(kw);
        return titleMatch || docNoMatch || drafterMatch || typeMatch;
      });
    }
    // 최신 기안일 정렬
    return list.sort((a, b) => (b.submittedAt ?? b.createdAt ?? '').localeCompare(a.submittedAt ?? a.createdAt ?? ''));
  }, [allDocs, tab, q, org.users]);

  // 2. 현재 선택 문서
  const selDoc = useMemo(() => filtered.find((d) => d.id === selId) ?? filtered[0] ?? null, [filtered, selId]);

  // 3. 현재 결재 대기자 구하기
  const getWaitingApprovers = (d: ApprovalDoc) => {
    if (d.status !== '진행중') return '—';
    const ids = currentApproverIds(d);
    if (ids.length === 0) return '—';
    return ids.map(nameOf).join(', ');
  };

  return (
    <div className="flex flex-col gap-3.5 h-[calc(100vh-130px)]">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">결재문서 모니터링</h1>
        <p className="mt-0.5 text-xs text-ink3">기준 정보 / 조직·결재 기준정보 / 전사 결재 문서 진행 상황 실시간 모니터링</p>
      </div>

      <div className="grid grid-cols-[1fr_420px] gap-4 min-h-0 flex-1">
        {/* 좌: 문서 그리드 목록 및 검색/필터 */}
        <div className="flex flex-col rounded-xl border border-border bg-panel overflow-hidden min-w-0">
          {/* 필터 탭 */}
          <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1 shrink-0 overflow-x-auto">
            {(Object.keys(TAB_LABELS) as MonitorTab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelId(null); }}
                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-all ${
                  tab === t ? 'bg-teal text-white shadow-sm' : 'text-ink2 hover:bg-panel-alt'
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* 검색어 입력바 */}
          <div className="border-b border-border p-3 shrink-0">
            <div className="flex items-center gap-2 rounded-full border border-border-hi bg-panel px-3.5 py-1.5">
              <span className="text-[12px] text-ink3">🔍</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="기안자, 문서제목, 문서유형, 문서번호 검색..."
                className="w-full bg-transparent text-[11.5px] text-ink outline-none placeholder:text-ink3"
              />
              {q && (
                <button onClick={() => setQ('')} className="text-[11px] text-ink3 hover:text-ink">✕</button>
              )}
            </div>
          </div>

          {/* 테이블 리스트 */}
          <div className="flex-1 overflow-y-auto content-scroll">
            {isLoading ? (
              <div className="py-12 text-center text-[12px] text-ink3">로딩 중…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-ink3">조건에 일치하는 결재 문서가 없습니다.</div>
            ) : (
              <table className="w-full border-collapse text-left text-[11.5px]">
                <thead className="sticky top-0 bg-panel-alt/80 backdrop-blur-sm border-b border-border font-bold text-ink2 z-10">
                  <tr>
                    <th className="px-4 py-2.5">문서번호</th>
                    <th className="px-4 py-2.5">문서유형</th>
                    <th className="px-4 py-2.5">제목</th>
                    <th className="px-4 py-2.5">기안자</th>
                    <th className="px-4 py-2.5">기안일</th>
                    <th className="px-4 py-2.5">대기 결재자</th>
                    <th className="px-4 py-2.5 text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((d) => {
                    const isSelected = selDoc?.id === d.id;
                    const st = STATUS_STYLE[d.status] || { bg: 'bg-panel-alt', text: 'text-ink3' };
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelId(d.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-teal-soft/40 hover:bg-teal-soft/50' : 'hover:bg-panel-alt/40'
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold tabular-nums text-ink">{d.docNo || '—'}</td>
                        <td className="px-4 py-3 text-ink2">{d.docType}</td>
                        <td className="px-4 py-3 font-semibold text-ink truncate max-w-[200px]" title={d.title}>
                          {d.title}
                        </td>
                        <td className="px-4 py-3 text-ink2 font-medium">
                          {nameOf(d.drafterId)}
                          <span className="text-[10px] text-ink3 ml-1">({d.drafterDept || '—'})</span>
                        </td>
                        <td className="px-4 py-3 text-ink3 tabular-nums">
                          {formatDateTime(d.submittedAt ?? d.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-teal font-semibold">
                          {getWaitingApprovers(d)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold ${st.bg} ${st.text}`}>
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 우: 결재 상세 뷰 및 결재 흐름 상세 */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {selDoc ? (
            <>
              {/* 결재 진행 상황 타임라인 패널 */}
              <div className="rounded-xl border border-border bg-panel p-4 flex-1 flex flex-col gap-2.5 overflow-hidden">
                <div className="flex items-center justify-between border-b border-border pb-1.5 shrink-0">
                  <span className="text-[12px] font-bold text-ink flex items-center gap-1.5">
                    <span className="h-3 w-1 rounded-sm bg-teal" />
                    결재선 진행 상태
                  </span>
                  <span className="text-[10.5px] font-extrabold text-ink3">
                    총 {selDoc.steps.length}단계
                  </span>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto content-scroll pr-1">
                  {selDoc.steps.map((s) => {
                    const isCurrent = selDoc.status === '진행중' && currentApproverIds(selDoc).includes(s.approverId);
                    return (
                      <div
                        key={s.seq}
                        className={`flex items-center justify-between p-2 rounded-lg border text-[11px] ${
                          isCurrent
                            ? 'border-teal/30 bg-teal-soft/30 font-bold'
                            : s.decision === '승인'
                            ? 'border-border/60 bg-panel-alt/40'
                            : 'border-border bg-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`grid h-4.5 w-4.5 place-items-center rounded-full text-[9px] font-bold ${
                            s.decision === '승인' ? 'bg-teal text-white' : 'bg-ink3/15 text-ink2'
                          }`}>
                            {s.seq}
                          </span>
                          <span className="text-ink">{nameOf(s.approverId)}</span>
                          <span className="text-[9.5px] text-ink3">({s.kind})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isCurrent && (
                            <span className="animate-pulse rounded bg-amber/20 px-1 py-0.5 text-[9.5px] font-extrabold text-amber">
                              ⏳ 대기 중
                            </span>
                          )}
                          <span className={`text-[9.5px] font-extrabold ${
                            s.decision === '승인'
                              ? 'text-teal'
                              : s.decision === '반려'
                              ? 'text-danger'
                              : 'text-ink3'
                          }`}>
                            {s.decision}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center rounded-xl border border-dashed border-border bg-panel p-8 text-center text-ink3 text-[12px]">
              목록에서 문서를 선택하면 결재선 진행 흐름을 확인할 수 있습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
