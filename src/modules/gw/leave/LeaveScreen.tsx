import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useLeave } from '@/features/gw/useLeave';
import { activeSteps } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { fmtDateTime, GwHead, StatusBadge } from '@/modules/gw/_gw';
import { ApprovalDraftModal } from '@/modules/gw/approval/ApprovalDraftModal';

/**
 * 휴가관리(§7.4) — 상단 잔여 요약(연차/대체휴무/일정) + 상세 내역 탭(연차/대체휴무/이력) +
 * 휴가 신청 연동.
 */
export default function LeaveScreen() {
  const { user } = useAuth();
  const nav = useNavigate();
  const bal = useLeave(user?.id);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'annual' | 'substitute' | 'requests'>('annual');
  const [statusFilter, setStatusFilter] = useState<'전체' | '진행중' | '완료' | '반려'>('전체');

  if (!user) return <div className="p-10 text-center text-[13px] text-ink3">로그인이 필요합니다.</div>;

  const goDoc = (d: ApprovalDoc) => nav(`/gw/approval?doc=${d.id}`);

  // 다가오는 일정 계산
  const upcomingDoc = useMemo(() => {
    const todayStr = '2026-07-16';
    const activeLeaves = bal.myDocs.filter(
      (d) => (d.status === '완료' || d.status === '진행중') && d.form && d.form.startDate >= todayStr
    );
    // 가장 빠른 날짜 순 정렬
    return [...activeLeaves].sort((a, b) => a.form!.startDate.localeCompare(b.form!.startDate))[0] ?? null;
  }, [bal.myDocs]);

  // 디데이 계산 텍스트 생성
  const upcomingDDayText = useMemo(() => {
    if (!upcomingDoc || !upcomingDoc.form) return '';
    const today = new Date('2026-07-16');
    const start = new Date(upcomingDoc.form.startDate);
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '내일';
    return `D-${diffDays}`;
  }, [upcomingDoc]);

  // 휴가 신청 이력 필터링
  const filteredDocs = useMemo(() => {
    if (statusFilter === '전체') return bal.myDocs;
    return bal.myDocs.filter((d) => d.status === statusFilter);
  }, [bal.myDocs, statusFilter]);

  // 연차 소진 내역 문서 추출
  const annualLeaveHistoryDocs = useMemo(() => {
    return bal.myDocs.filter(
      (d) => d.status === '완료' && (d.form?.leaveType === '연차' || d.form?.leaveType === '반차')
    );
  }, [bal.myDocs]);

  // 대체휴무 소진 내역 문서 추출
  const substituteLeaveHistoryDocs = useMemo(() => {
    return bal.myDocs.filter(
      (d) => d.status === '완료' && d.form?.leaveType === '대체휴무'
    );
  }, [bal.myDocs]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <GwHead
        icon="🏖️"
        name="휴가관리"
        right={
          <button onClick={() => setOpen(true)} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90">
            + 휴가 신청
          </button>
        }
      />

      {/* 요약 대시보드 */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 연차 현황 카드 */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-ink2">연차 현황</span>
            <span className="rounded bg-teal-soft/40 px-2 py-0.5 text-[10px] font-bold text-teal">정기 휴가</span>
          </div>
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-[28px] font-extrabold tabular-nums text-teal">{bal.remaining}</span>
            <span className="text-[13px] font-bold text-ink3">/ {bal.grant} 일 잔여</span>
          </div>
          {/* 비주얼 프로그레스 바 */}
          <div className="w-full bg-border rounded-full h-2 overflow-hidden mb-3">
            <div 
              className="bg-teal h-2 rounded-full transition-all duration-500" 
              style={{ width: `${(bal.remaining / bal.grant) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-ink3 font-medium">
            <span>사용 완료: {bal.used}일</span>
            {bal.pending > 0 && <span className="text-amber">결재 대기: {bal.pending}일</span>}
          </div>
        </div>

        {/* 대체휴무 현황 카드 */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-ink2">대체휴무 현황</span>
            <span className="rounded bg-blue-soft/40 px-2 py-0.5 text-[10px] font-bold text-blue">보상 휴가</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[28px] font-extrabold tabular-nums text-blue">{bal.substituteHoliday.remaining}</span>
            <span className="text-[13px] font-bold text-ink3">/ {bal.substituteHoliday.total} 일 잔여</span>
          </div>
          <div className="min-h-[20px] mb-2">
            {bal.substituteHoliday.expiringSoonCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft/50 px-2 py-0.5 text-[10.5px] font-semibold text-amber border border-amber/10 animate-pulse">
                ⚠️ 30일 내 만료 예정 {bal.substituteHoliday.expiringSoonCount}건
              </span>
            ) : (
              <span className="text-[11px] text-ink3">유효기간 내 사용 가능</span>
            )}
          </div>
          <div className="flex justify-between text-[11px] text-ink3 font-medium pt-1 border-t border-border/50">
            <span>사용 완료: {bal.substituteHoliday.used}일</span>
            {bal.substituteHoliday.pending > 0 && <span className="text-amber">결재 대기: {bal.substituteHoliday.pending}일</span>}
          </div>
        </div>

        {/* 다가오는 일정 카드 */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-ink2">가장 가까운 예정 일정</span>
            <span className="rounded bg-purple-soft/40 px-2 py-0.5 text-[10px] font-bold text-purple">D-Day</span>
          </div>
          {upcomingDoc ? (
            <div className="mt-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[24px] font-extrabold text-purple">{upcomingDDayText}</span>
                <span className="text-[12px] font-bold text-ink2">({upcomingDoc.form?.startDate})</span>
              </div>
              <div className="text-[12px] font-semibold text-ink truncate">
                [{upcomingDoc.form?.leaveType}] {upcomingDoc.form?.days}일 신청
              </div>
              <div className="mt-1 text-[11px] text-ink3 truncate">
                사유: {upcomingDoc.body || upcomingDoc.title}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <span className="text-[20px] font-bold text-ink3">일정 없음</span>
              <span className="mt-1 text-[11px] text-ink3">확정되거나 진행 중인 휴가가 없습니다.</span>
            </div>
          )}
        </div>
      </div>

      {bal.otherUsed > 0 && (
        <p className="mt-2 text-[11px] text-ink3">※ 병가·경조·공가 등 기타 완료 휴가 {bal.otherUsed}일은 연차 잔여와 별개로 차감되지 않습니다.</p>
      )}

      {/* 탭 네비게이션 */}
      <div className="mt-8 flex border-b border-border">
        <button 
          onClick={() => setActiveTab('annual')}
          className={`px-5 py-3 text-[13px] font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === 'annual' ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'
          }`}
        >
          연차 사용 내역
        </button>
        <button 
          onClick={() => setActiveTab('substitute')}
          className={`px-5 py-3 text-[13px] font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === 'substitute' ? 'border-blue text-blue' : 'border-transparent text-ink3 hover:text-ink'
          }`}
        >
          대체휴무 적립/소진 내역
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={`px-5 py-3 text-[13px] font-bold transition-all border-b-2 -mb-[2px] ${
            activeTab === 'requests' ? 'border-ink text-ink' : 'border-transparent text-ink3 hover:text-ink'
          }`}
        >
          휴가 신청 이력
        </button>
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="mt-4 rounded-xl border border-border bg-panel overflow-hidden shadow-sm">
        
        {/* 1. 연차 사용 내역 탭 */}
        {activeTab === 'annual' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[13px] font-bold text-ink">연차 변동 상세 내역</span>
              <span className="text-[11px] text-ink3">올해 연차 총 부여: {bal.grant}일</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-panel-alt text-ink3 font-semibold">
                    <th className="p-2.5">일자/기간</th>
                    <th className="p-2.5">종류</th>
                    <th className="p-2.5">사용 일수</th>
                    <th className="p-2.5">적요/사유</th>
                    <th className="p-2.5">문서번호</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-panel-alt/30">
                    <td className="p-2.5 text-ink3">2026-01-01</td>
                    <td className="p-2.5"><span className="rounded bg-teal-soft/30 px-1.5 py-0.5 font-semibold text-teal">정기부여</span></td>
                    <td className="p-2.5 text-teal font-bold">+{bal.grant}일</td>
                    <td className="p-2.5 text-ink2">신년도 기본 연차 일수 자동 부여</td>
                    <td className="p-2.5 text-ink3">-</td>
                  </tr>
                  {annualLeaveHistoryDocs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-ink3">사용 완료된 연차가 없습니다.</td>
                    </tr>
                  ) : (
                    annualLeaveHistoryDocs.map((d) => (
                      <tr key={d.id} className="hover:bg-panel-alt/30 cursor-pointer" onClick={() => goDoc(d)}>
                        <td className="p-2.5 text-ink2">{d.form?.startDate} ~ {d.form?.endDate}</td>
                        <td className="p-2.5"><span className="rounded bg-slate-soft px-1.5 py-0.5 font-semibold text-slate">{d.form?.leaveType}</span></td>
                        <td className="p-2.5 text-red-500 font-bold">-{d.form?.days}일</td>
                        <td className="p-2.5 text-ink truncate max-w-[200px]">{d.body || d.title}</td>
                        <td className="p-2.5 text-ink3 underline">{d.docNo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. 대체휴무 적립/소진 내역 탭 */}
        {activeTab === 'substitute' && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[13px] font-bold text-ink">대체휴무 발생 및 만료 상세</span>
              <span className="text-[11px] text-ink3">잔여 대체휴무: {bal.substituteHoliday.remaining}일</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-panel-alt text-ink3 font-semibold">
                    <th className="p-2.5">발생일</th>
                    <th className="p-2.5">근무 사유</th>
                    <th className="p-2.5">부여 일수</th>
                    <th className="p-2.5">소진/대기</th>
                    <th className="p-2.5">만료/소멸 예정일</th>
                    <th className="p-2.5">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bal.substituteHoliday.detailList.map((item) => (
                    <tr key={item.id} className="hover:bg-panel-alt/30">
                      <td className="p-2.5 text-ink2">{item.occurrenceDate}</td>
                      <td className="p-2.5 text-ink truncate max-w-[250px]">{item.reason}</td>
                      <td className="p-2.5 font-bold text-ink">{item.days}일</td>
                      <td className="p-2.5 text-ink3">
                        {item.used > 0 && <span className="text-red-500 font-semibold">소진 {item.used}일 </span>}
                        {item.pending > 0 && <span className="text-amber font-semibold">결재대기 {item.pending}일</span>}
                        {item.used === 0 && item.pending === 0 && '-'}
                      </td>
                      <td className="p-2.5 text-ink3">{item.expirationDate}</td>
                      <td className="p-2.5">
                        {item.status === 'AVAILABLE' && (
                          item.used + item.pending >= item.days ? (
                            <span className="rounded bg-slate-soft px-1.5 py-0.5 font-semibold text-slate-600">소진완료</span>
                          ) : (
                            <span className="rounded bg-emerald-soft px-1.5 py-0.5 font-semibold text-emerald">사용가능</span>
                          )
                        )}
                        {item.status === 'USED' && (
                          <span className="rounded bg-slate-soft px-1.5 py-0.5 font-semibold text-slate-600">소진완료</span>
                        )}
                        {item.status === 'EXPIRED' && (
                          <span className="rounded bg-red-soft px-1.5 py-0.5 font-semibold text-red-500">기간만료</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* 소진 연동 상세 문서 매핑 */}
            {substituteLeaveHistoryDocs.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <h4 className="text-[12.5px] font-bold text-ink mb-2">대체휴무 휴가 사용 결재 이력</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {substituteLeaveHistoryDocs.map((d) => (
                    <div 
                      key={d.id} 
                      onClick={() => goDoc(d)}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-panel hover:bg-panel-alt cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-bold text-ink truncate">{d.form?.startDate} ~ {d.form?.endDate} ({d.form?.days}일)</div>
                        <div className="text-[10px] text-ink3 truncate">사유: {d.body || d.title}</div>
                      </div>
                      <span className="text-[11px] text-blue underline font-medium whitespace-nowrap shrink-0 ml-2">{d.docNo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. 휴가 신청 이력 탭 */}
        {activeTab === 'requests' && (
          <div>
            {/* 상단 필터 바 */}
            <div className="flex items-center gap-1.5 border-b border-border bg-panel-alt/50 px-4 py-2 text-[11.5px]">
              <span className="text-ink3 font-bold mr-2">결재 상태 필터:</span>
              {(['전체', '진행중', '완료', '반려'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded px-2.5 py-1 font-semibold transition-all ${
                    statusFilter === f ? 'bg-ink text-white' : 'bg-panel border border-border text-ink2 hover:bg-panel-alt'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* 신청 목록 */}
            <div className="divide-y divide-border">
              {bal.isLoading && <div className="py-10 text-center text-[12px] text-ink3">불러오는 중…</div>}
              {!bal.isLoading && filteredDocs.length === 0 && (
                <div className="py-14 text-center text-[12px] text-ink3">조건에 부합하는 휴가 내역이 없습니다.</div>
              )}
              {filteredDocs.map((d) => (
                <button key={d.id} onClick={() => goDoc(d)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-panel-alt/50 transition-colors">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-soft text-[16px] border border-teal/10">🏖️</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-bold text-ink">{d.form?.leaveType ?? '휴가'} · {d.form?.days ?? 0}일</span>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink3">
                      {d.form ? `${d.form.startDate} ~ ${d.form.endDate}` : d.title} · {d.docNo}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[10.5px] text-ink3">
                    <div>{fmtDateTime(d.submittedAt ?? d.createdAt)}</div>
                    {d.status === '진행중' && <div className="mt-0.5 text-amber font-semibold">현재: {currentApproverLabel(d)}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {open && <ApprovalDraftModal me={user} fixedType="휴가" onClose={() => setOpen(false)} />}
    </div>
  );
}

/** 진행중 문서의 현재 결재자 이름(표기용). org 미조회 — id 폴백. */
function currentApproverLabel(d: ApprovalDoc): string {
  const act = activeSteps(d);
  return act.length ? `${act.length}명 대기` : '진행';
}
