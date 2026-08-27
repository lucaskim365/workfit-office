import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ClipboardCheck, Bell, Settings } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useApprovalBoxes } from '@/features/gw/useApprovals';
import { enablePushForUser, isPushConfigured, notificationPermission } from '@/shared/lib/messaging';
import { currentApproverIds, getPredecessorsOf } from '@/domain/approvalDoc/engine';
import type { ApprovalBox, ApprovalDoc } from '@/domain/approvalDoc/schema';

/**
 * 모바일 PWA 전자결재 결재함 — 열람·결재 중심(Flutter 모바일과 동일 스코프).
 * 웹 데스크톱과 동일한 useApprovalBoxes 훅/엔진을 재사용하므로 데이터가 실시간 공유된다.
 */
const FIXED_BOXES: { key: ApprovalBox; label: string }[] = [
  { key: '대기', label: '결재함' },
  { key: '상신', label: '상신함' },
  { key: '완료', label: '완료함' },
  { key: '반려', label: '반려함' },
];

const EXTRA_BOX_OPTIONS: { key: ApprovalBox; label: string }[] = [
  { key: '수신', label: '수신함' },
  { key: '참조', label: '참조함' },
  { key: '시행', label: '시행함' },
  { key: '후열', label: '후열함' },
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
      return '#2563eb';
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
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'progress'>('all');

  // 로컬스토리지 키 설정
  const STORAGE_KEY = 'workfit-approval-extra-tabs';

  // 로컬스토리지에서 추가 활성화 탭 읽기
  const [extraTabs, setExtraTabs] = useState<ApprovalBox[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 현재 활성화된 모든 결재함 탭들
  const activeBoxes = useMemo(() => {
    const extra = EXTRA_BOX_OPTIONS.filter((b) => extraTabs.includes(b.key));
    return [...FIXED_BOXES, ...extra];
  }, [extraTabs]);

  // 설정 변경 모달 열림 여부
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 모달 안에서 편집할 임시 설정 값
  const [tempExtraTabs, setTempExtraTabs] = useState<ApprovalBox[]>(extraTabs);

  const openSettings = () => {
    setTempExtraTabs(extraTabs);
    setIsSettingsOpen(true);
  };

  const handleToggleExtraTab = (key: ApprovalBox) => {
    setTempExtraTabs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempExtraTabs));
    setExtraTabs(tempExtraTabs);
    setIsSettingsOpen(false);

    // 만약 현재 선택된 탭(box)이 새 설정에서 제외되었다면, 첫 번째 고정 탭인 '대기'로 이동
    const isStillActive = [...FIXED_BOXES.map((b) => b.key), ...tempExtraTabs].includes(box);
    if (!isStillActive) {
      setBox('대기');
    }
  };

  // 결재 푸시 opt-in — 권한이 아직 'default'일 때만 노출(최초 허용은 사용자 제스처 필요).
  const [pushPerm, setPushPerm] = useState<NotificationPermission | 'unsupported'>(() => notificationPermission());
  const [notice, setNotice] = useState('');
  const showPushOptIn = isPushConfigured() && pushPerm === 'default';
  const enablePush = async () => {
    setNotice('알림 설정 중…');
    const res = await enablePushForUser(me);
    setPushPerm(notificationPermission());
    setNotice(res.ok ? '✅ 결재 알림이 켜졌습니다.' : `⚠️ 알림 실패 — ${res.error}`);
    setTimeout(() => setNotice(''), 8000);
  };

  const docs = useMemo(() => {
    const rawDocs = byBox[box] ?? [];
    if (box !== '대기') return rawDocs;

    const preds = getPredecessorsOf(me);
    if (todoFilter === 'pending') {
      return rawDocs.filter((d: ApprovalDoc) => {
        const approvers = currentApproverIds(d);
        return approvers.includes(me) || approvers.some((id) => preds.includes(id));
      });
    }
    if (todoFilter === 'progress') {
      return rawDocs.filter((d: ApprovalDoc) => {
        const approvers = currentApproverIds(d);
        return !approvers.includes(me) && !approvers.some((id) => preds.includes(id));
      });
    }
    return rawDocs;
  }, [byBox, box, todoFilter, me]);

  return (
    <div className="flex h-full flex-col" style={{ background: '#f0f4f8' }}>
      <header className="flex shrink-0 items-center gap-2 px-2 py-3 text-white" style={{ background: '#101830' }}>
        <button onClick={() => nav('/m')} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[18px] hover:bg-white/10">←</button>
        <span className="flex items-center gap-1.5 text-[15px] font-bold"><ClipboardCheck size={17} /> 전자결재</span>
        <div className="ml-auto flex items-center gap-1">
          {showPushOptIn && (
            <button onClick={enablePush} title="결재 알림 켜기" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/10">
              <Bell size={18} strokeWidth={2} />
            </button>
          )}
          <button onClick={openSettings} title="결재함 설정" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/10">
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {notice && <div className="px-4 py-2 text-[11.5px] text-navy" style={{ background: '#c7ecc5' }}>{notice}</div>}

      {/* 결재함 탭 */}
      <div 
        className="flex shrink-0 border-b border-[#e2e8f0] bg-white overflow-x-auto whitespace-nowrap scrollbar-none flex-row flex-nowrap"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {activeBoxes.map((b) => {
          const active = b.key === box;
          const cnt = counts[b.key] ?? 0;
          return (
            <button
              key={b.key}
              onClick={() => {
                setBox(b.key);
                setTodoFilter('all');
              }}
              className={`relative flex-1 shrink-0 px-4 py-2.5 text-[12.5px] font-bold transition-colors ${active ? 'text-ink' : 'text-ink3'}`}
            >
              <span className="inline-flex items-center gap-1">
                {b.label}
                {cnt > 0 && (
                  <span
                    className="grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 text-[9.5px] font-extrabold text-white"
                    style={{ background: b.key === '대기' ? '#3b82f6' : '#94a3b8' }}
                  >
                    {cnt}
                  </span>
                )}
              </span>
              {active && <span className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full" style={{ background: '#3b82f6' }} />}
            </button>
          );
        })}
      </div>

      {box === '대기' && (
        <div className="flex shrink-0 border-b border-black/5 bg-white p-2.5 gap-2 select-none">
          {(['all', 'pending', 'progress'] as const).map((f) => {
            const label = f === 'all' ? '전체' : f === 'pending' ? '결재대기중' : '진행중';
            const active = todoFilter === f;
            return (
              <button
                key={f}
                onClick={() => setTodoFilter(f)}
                className={`flex-1 rounded-xl py-2 text-[12px] font-bold transition-all ${
                  active
                    ? 'bg-[#3b82f6] text-white shadow-sm shadow-blue-500/20'
                    : 'bg-black/5 text-ink3 hover:bg-black/10'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}


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

      {isSettingsOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4" onClick={() => setIsSettingsOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <span className="text-[15px] font-bold text-ink">결재함 설정</span>
              <button onClick={() => setIsSettingsOpen(false)} className="text-[13px] text-ink3">✕</button>
            </div>
            
            <div className="py-4 space-y-3.5">
              <div className="text-[11.5px] text-ink3 font-medium">기본 노출 (고정)</div>
              <div className="grid grid-cols-2 gap-2">
                {FIXED_BOXES.map((b) => (
                  <div key={b.key} className="flex items-center gap-2 rounded-lg bg-black/[0.02] p-3 border border-black/5 opacity-60">
                    <input type="checkbox" checked disabled className="h-4 w-4 rounded accent-[#e6960c]" />
                    <span className="text-[12.5px] font-semibold text-ink3">{b.label}</span>
                  </div>
                ))}
              </div>

              <div className="h-px bg-black/5 my-2" />

              <div className="text-[11.5px] text-ink3 font-medium">추가 노출 선택</div>
              <div className="grid grid-cols-2 gap-2">
                {EXTRA_BOX_OPTIONS.map((b) => {
                  const active = tempExtraTabs.includes(b.key);
                  return (
                    <button
                      key={b.key}
                      onClick={() => handleToggleExtraTab(b.key)}
                      className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${active ? 'border-[#e6960c] bg-amber-50/10' : 'border-black/5 bg-white'}`}
                      style={active ? { background: '#e6960c15' } : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        readOnly
                        className="h-4 w-4 rounded accent-[#e6960c]"
                      />
                      <span className={`text-[12.5px] font-bold ${active ? 'text-[#e6960c]' : 'text-ink2'}`}>{b.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 rounded-lg border py-2.5 text-[13.5px] font-bold text-ink2 border-black/10 bg-white active:bg-black/5"
              >
                취소
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 rounded-lg py-2.5 text-[13.5px] font-bold text-white active:opacity-90"
                style={{ background: '#e6960c' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ApprovalRow({ doc, onOpen }: { doc: ApprovalDoc; onOpen: () => void }) {
  const drafter = doc.drafterName || doc.drafterId;
  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-col gap-1 border-b border-slate-100 bg-white px-4 py-3 text-left active:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#dbeafe', color: '#1e40af' }}>
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
