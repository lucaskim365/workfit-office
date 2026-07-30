import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useApprovalBoxes } from '@/features/gw/useApprovals';
import type { ApprovalBox, ApprovalDoc } from '@/domain/approvalDoc/schema';

/**
 * 모바일 PWA 전자결재 결재함 — 열람·결재 중심(Flutter 모바일과 동일 스코프).
 * 웹 데스크톱과 동일한 useApprovalBoxes 훅/엔진을 재사용하므로 데이터가 실시간 공유된다.
 */
const BOXES: { key: ApprovalBox; label: string }[] = [
  { key: '대기', label: '결재 대기' },
  { key: '상신', label: '상신함' },
  { key: '완료', label: '완료함' },
  { key: '반려', label: '반려함' },
];

/** 문서 일시(상신/생성) 포맷 — YYYY.MM.DD HH:mm. */
export function fmtDocDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 상태 배지 색상(문서 상태별). */
export function statusColor(status: string): string {
  switch (status) {
    case '완료':
      return '#16a34a';
    case '반려':
      return '#e0483b';
    case '진행중':
      return '#101830';
    default:
      return '#8a8f98';
  }
}

export default function MobileApprovalList() {
  const { user } = useAuth();
  const nav = useNavigate();
  const me = user!.id;
  const { byBox, counts, isLoading } = useApprovalBoxes(me);
  const [box, setBox] = useState<ApprovalBox>('대기');

  const docs = byBox[box] ?? [];

  return (
    <div className="flex h-full flex-col" style={{ background: '#faf6f0' }}>
      <header className="flex shrink-0 items-center gap-2 px-2 py-3 text-white" style={{ background: '#101830' }}>
        <button onClick={() => nav('/m')} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[18px] hover:bg-white/10">←</button>
        <span className="text-[15px] font-bold">📋 전자결재</span>
      </header>

      {/* 결재함 탭 */}
      <div className="flex shrink-0 border-b border-black/10 bg-white">
        {BOXES.map((b) => {
          const active = b.key === box;
          const cnt = counts[b.key] ?? 0;
          return (
            <button
              key={b.key}
              onClick={() => setBox(b.key)}
              className={`relative flex-1 py-2.5 text-[12.5px] font-bold transition-colors ${active ? 'text-ink' : 'text-ink3'}`}
            >
              <span className="inline-flex items-center gap-1">
                {b.label}
                {cnt > 0 && (
                  <span
                    className="grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 text-[9.5px] font-extrabold text-white"
                    style={{ background: b.key === '대기' ? '#e6960c' : '#a3a7ad' }}
                  >
                    {cnt}
                  </span>
                )}
              </span>
              {active && <span className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full" style={{ background: '#e6960c' }} />}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {isLoading ? (
          <div className="py-16 text-center text-[12px] text-ink3">불러오는 중…</div>
        ) : docs.length === 0 ? (
          <div className="py-16 text-center text-[12px] text-ink3">
            {box === '대기' ? '결재할 문서가 없습니다.' : '문서가 없습니다.'}
          </div>
        ) : (
          docs.map((d) => <ApprovalRow key={d.id} doc={d} onOpen={() => nav(`/m/approval/${d.id}`)} />)
        )}
      </div>
    </div>
  );
}

function ApprovalRow({ doc, onOpen }: { doc: ApprovalDoc; onOpen: () => void }) {
  const drafter = doc.drafterName || doc.drafterId;
  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-col gap-1 border-b border-black/5 bg-white px-4 py-3 text-left active:bg-black/5"
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: '#101830' }}>
          {doc.docType}
        </span>
        <span
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: `${statusColor(doc.status)}1f`, color: statusColor(doc.status) }}
        >
          {doc.status}
        </span>
        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-ink3">{doc.docNo}</span>
      </div>
      <div className="truncate text-[14px] font-bold text-ink">{doc.title}</div>
      <div className="flex items-center gap-2 text-[11px] text-ink3">
        <span className="truncate">
          {drafter}
          {doc.drafterDept ? ` · ${doc.drafterDept}` : ''}
        </span>
        <span className="ml-auto shrink-0 tabular-nums">{fmtDocDate(doc.submittedAt ?? doc.createdAt)}</span>
      </div>
    </button>
  );
}
