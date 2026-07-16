import { useMemo, useState } from 'react';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { currentApproverIds } from '@/domain/approvalDoc/engine';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';
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

export default function ApprovalMonitorScreen() {
  const { user } = useAuth();
  const isAdmin = user?.roleGroup === 'ADMIN';
  const isExec = user?.roleGroup === 'OPERATOR';
  const hasAccess = isAdmin || isExec;

  if (!hasAccess) {
    return (
      <div className="flex h-[calc(100vh-130px)] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-panel p-8 text-center max-w-md shadow-sm">
          <span className="text-4xl">🔒</span>
          <h2 className="text-lg font-bold text-ink">접근 권한 제한</h2>
          <p className="text-xs leading-relaxed text-ink2">
            죄송합니다. 이 화면은 <b>관리자 및 임원</b> 전용 결재문서 조회 화면입니다. 다른 사용자는 접근할 수 없습니다.
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

  // 2차 패스워드 인증 관련 상태
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const nameOf = (id: string) => org.userById(id)?.name ?? id;

  // 권한별 허용 탭 목록 계산
  const tabs = useMemo<MonitorTab[]>(() => {
    if (isAdmin) {
      return ['ALL', '진행중', '완료', '반려', '임시저장', '회수'];
    }
    // 임원은 진행중, 완료 상태만 모아보기 가능
    return ['ALL', '진행중', '완료'];
  }, [isAdmin]);

  // 1. 검색 및 필터링
  const filtered = useMemo(() => {
    let list = [...allDocs];

    // 임원은 임시저장, 회수, 반려 문서를 조회 범위에서 원천 차단
    if (!isAdmin) {
      list = list.filter((d) => d.status === '진행중' || d.status === '완료');
    }

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
  }, [allDocs, tab, q, org.users, isAdmin]);

  // 2. 현재 선택 문서
  const selDoc = useMemo(() => filtered.find((d) => d.id === selId) ?? filtered[0] ?? null, [filtered, selId]);

  // 3. 현재 결재 대기자 구하기
  const getWaitingApprovers = (d: ApprovalDoc) => {
    if (d.status !== '진행중') return '—';
    const ids = currentApproverIds(d);
    if (ids.length === 0) return '—';
    return ids.map(nameOf).join(', ');
  };

  // 문서 선택 핸들러 (선택 시 잠금 해제 상태 초기화)
  const handleSelectDoc = (id: string) => {
    setSelId(id);
    setIsUnlocked(false);
  };

  // 2차 패스워드 인증 승인 처리
  const handleUnlockSubmit = () => {
    const correctPw = import.meta.env.VITE_MONITOR_UNLOCK_PW || 'admin1234';
    if (pwInput === correctPw) {
      setIsUnlocked(true);
      setShowPwModal(false);
      setPwInput('');
      setPwError('');
    } else {
      setPwError('비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <div className="flex flex-col gap-3.5 h-[calc(100vh-130px)]">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">결재문서 모니터링</h1>
        <p className="mt-0.5 text-xs text-ink3">
          기준 정보 / 조직·결재 기준정보 / 전사 결재 문서 진행 상황 실시간 모니터링
        </p>
      </div>

      <div className="grid grid-cols-[1fr_420px] gap-4 min-h-0 flex-1">
        {/* 좌: 문서 그리드 목록 및 검색/필터 */}
        <div className="flex flex-col rounded-xl border border-border bg-panel overflow-hidden min-w-0">
          {/* 필터 탭 */}
          <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1 shrink-0 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelId(null); setIsUnlocked(false); }}
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
                        onClick={() => handleSelectDoc(d.id)}
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
                          {(d.submittedAt ?? d.createdAt ?? '').slice(2, 16).replace('T', ' ')}
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
              <div className="rounded-xl border border-border bg-panel p-4 shrink-0 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-border pb-1.5 shrink-0">
                  <span className="text-[12px] font-bold text-ink flex items-center gap-1.5">
                    <span className="h-3 w-1 rounded-sm bg-teal" />
                    결재선 진행 상태
                  </span>
                  <span className="text-[10.5px] font-extrabold text-ink3">
                    총 {selDoc.steps.length}단계
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto content-scroll pr-1">
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

              {/* 결재 문서 양식 미리보기 패널 (2차 보안 잠금 해제 적용) */}
              <div className="flex-1 rounded-xl border border-border bg-panel overflow-hidden flex flex-col min-h-0">
                <div className="border-b border-border bg-panel-alt px-3.5 py-2 shrink-0 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-ink2">기안 문서 원본 내용</span>
                </div>
                
                {isUnlocked ? (
                  <div className="flex-1 overflow-y-auto bg-[#888]/5 p-2 content-scroll">
                    <div className="rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.08)] bg-white overflow-hidden">
                      <ApprovalDocumentView doc={selDoc} />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-panel-alt/20">
                    <div className="flex flex-col items-center gap-3 text-center max-w-[260px]">
                      <span className="text-3xl">🔒</span>
                      <h4 className="text-[11.5px] font-bold text-ink">보안 잠금 상태</h4>
                      <p className="text-[10px] leading-relaxed text-ink3">
                        기안 본문 및 첨부파일을 확인하려면 2차 비밀번호 검증이 필요합니다.
                      </p>
                      <button
                        onClick={() => setShowPwModal(true)}
                        className="mt-2 h-7.5 px-4 rounded-lg bg-teal text-white text-[11px] font-bold shadow-sm hover:bg-teal-dark active:scale-[0.98] transition-all"
                      >
                        본문 잠금해제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center rounded-xl border border-dashed border-border bg-panel p-8 text-center text-ink3 text-[12px]">
              목록에서 문서를 선택하면 결재 상세 내역과 진행 흐름을 확인할 수 있습니다.
            </div>
          )}
        </div>
      </div>

      {/* 2차 비밀번호 입력 모달 */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[320px] rounded-xl border border-border bg-panel p-5 shadow-lg">
            <h3 className="text-[13px] font-bold text-ink mb-1.5 flex items-center gap-1.5">
              <span>🔒</span> 2차 보안 인증
            </h3>
            <p className="text-[10.5px] text-ink3 mb-4 leading-normal">
              문서 본문 열람을 위해 2차 비밀번호를 입력해주세요.
            </p>
            <input
              type="password"
              value={pwInput}
              onChange={(e) => {
                setPwInput(e.target.value);
                setPwError('');
              }}
              placeholder="비밀번호 입력"
              className="w-full h-8 px-2.5 rounded-lg border border-border-hi bg-panel-alt text-[12px] text-ink outline-none focus:border-teal mb-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlockSubmit();
              }}
              autoFocus
            />
            {pwError && <p className="text-[10px] text-danger mb-2.5">{pwError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowPwModal(false);
                  setPwInput('');
                  setPwError('');
                }}
                className="h-7 px-3 rounded-md text-[11px] font-semibold text-ink2 bg-panel-alt hover:bg-bg-deep transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleUnlockSubmit}
                className="h-7 px-3 rounded-md text-[11px] font-semibold text-white bg-teal hover:bg-teal-dark transition-colors"
              >
                인증
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
