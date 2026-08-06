import { useState } from 'react';
import type { ApprovalRecipient } from '@/domain/approvalDoc/schema';

interface OrgUser {
  id: string;
  name: string;
  position: string;
  dept: string;
}

interface OrgDept {
  id: string;
  name: string;
}

/* ────────────── ⓘ 툴팁 컴포넌트 ────────────── */
function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink3/40 bg-panel text-[9px] font-extrabold text-ink3 hover:border-teal hover:text-teal transition-colors select-none cursor-pointer"
        aria-label="도움말"
      >
        ⓘ
      </button>

      {visible && (
        <div className="absolute right-0 top-full mt-1 z-[9999] w-[190px] rounded-lg border border-border bg-panel shadow-2xl p-2.5 text-[10.5px] text-ink2 leading-relaxed pointer-events-none break-keep">
          {text}
        </div>
      )}
    </div>
  );
}

function SelectorDialog({
  title, org, excludeIds, singleSelect, onConfirm, onClose,
}: {
  title: string;
  org: { users: OrgUser[]; depts: OrgDept[] };
  excludeIds?: Set<string>;
  singleSelect?: boolean;
  onConfirm: (items: { id: string; name: string; type: 'user' | 'dept' }[]) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'dept' | 'user'>('dept');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string; type: 'user' | 'dept' }[]>([]);

  const depts = org.depts.filter((d) => d.name.includes(search) && !excludeIds?.has(d.id));
  const users = org.users.filter(
    (u) => (u.name.includes(search) || u.dept.includes(search) || u.position.includes(search)) && !excludeIds?.has(u.id),
  );

  const toggle = (item: { id: string; name: string; type: 'user' | 'dept' }) => {
    if (singleSelect) { setSelected([item]); return; }
    setSelected((prev) =>
      prev.some((s) => s.id === item.id) ? prev.filter((s) => s.id !== item.id) : [...prev, item],
    );
  };

  const isSelected = (id: string) => selected.some((s) => s.id === id);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-panel shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-bold text-ink">{title}</span>
          <button type="button" onClick={onClose} className="text-[15px] text-ink3 hover:text-ink">✕</button>
        </div>

        <div className="flex gap-0 border-b border-border px-4 pt-2">
          {(['dept', 'user'] as const).map((t) => (
            <button
              key={t} type="button"
              onClick={() => { setTab(t); setSearch(''); }}
              className={`pb-1.5 px-3 text-[11.5px] font-bold border-b-2 transition-colors ${tab === t ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'}`}
            >
              {t === 'dept' ? '📁 부서' : '👤 사원'}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-2">
          <input
            autoFocus type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'dept' ? '부서명 검색...' : '이름·부서·직책 검색...'}
            className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-1.5 text-[11.5px] text-ink outline-none focus:border-teal"
          />
        </div>

        <div className="max-h-[220px] overflow-y-auto px-4 pb-2 space-y-0.5">
          {tab === 'dept'
            ? depts.length === 0
              ? <p className="text-center text-[11px] text-ink3 py-4">검색 결과 없음</p>
              : depts.map((d) => (
                <button key={d.id} type="button" onClick={() => toggle({ id: d.id, name: d.name, type: 'dept' })}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors ${isSelected(d.id) ? 'bg-teal-soft text-teal font-bold' : 'hover:bg-panel-alt text-ink'}`}>
                  <span>📁</span><span className="flex-1">{d.name}</span>
                  {isSelected(d.id) && <span className="text-teal text-[10px]">✓</span>}
                </button>
              ))
            : users.length === 0
              ? <p className="text-center text-[11px] text-ink3 py-4">검색 결과 없음</p>
              : users.map((u) => (
                <button key={u.id} type="button" onClick={() => toggle({ id: u.id, name: `${u.name} · ${u.dept}`, type: 'user' })}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors ${isSelected(u.id) ? 'bg-teal-soft text-teal font-bold' : 'hover:bg-panel-alt text-ink'}`}>
                  <span>👤</span>
                  <span className="flex-1">
                    <span className="font-semibold">{u.name}</span>
                    <span className="ml-1.5 text-ink3 text-[10.5px]">{u.position} · {u.dept}</span>
                  </span>
                  {isSelected(u.id) && <span className="text-teal text-[10px]">✓</span>}
                </button>
              ))}
        </div>

        {selected.length > 0 && (
          <div className="border-t border-border px-4 py-2 flex flex-wrap gap-1">
            {selected.map((s) => (
              <span key={s.id} className="flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[10.5px] font-semibold text-teal">
                {s.name}
                <button type="button" onClick={() => setSelected((p) => p.filter((x) => x.id !== s.id))} className="text-teal/60 hover:text-red-500 font-bold">✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-1.5 text-[12px] font-semibold text-ink2 hover:bg-panel-alt transition-colors">취소</button>
          <button type="button" disabled={selected.length === 0} onClick={() => { onConfirm(selected); onClose(); }}
            className="flex-1 rounded-lg bg-teal py-1.5 text-[12px] font-bold text-white hover:bg-teal-dark transition-colors disabled:opacity-40">확인</button>
        </div>
      </div>
    </div>
  );
}

export function DraftRecipientSection({
  recipients, setRecipients, executionTarget, setExecutionTarget, org,
}: {
  recipients: ApprovalRecipient[];
  setRecipients: React.Dispatch<React.SetStateAction<ApprovalRecipient[]>>;
  executionTarget: { type: 'USER' | 'DEPT'; id: string; name: string } | null;
  setExecutionTarget: (target: { type: 'USER' | 'DEPT'; id: string; name: string } | null) => void;
  org: { users: OrgUser[]; depts: OrgDept[] };
}) {
  const [recipientDialog, setRecipientDialog] = useState(false);
  const [execDialog, setExecDialog] = useState(false);
  const excludeRecipientIds = new Set(recipients.map((r) => r.id));

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ─── 수신처 설정 카드 (z-20으로 지정하여 우측 시행자 카드 및 부모 레이어보다 위로 올림) ─── */}
      <div className="relative z-20 rounded-xl border border-teal/20 bg-teal-soft/10 p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] font-bold text-teal">📨 수신처 설정</div>
          </div>
          <InfoTooltip text="문서가 최종 완료되면 지정한 수신처(부서 또는 사원)에 자동으로 전송됩니다." />
        </div>

        {recipients.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {recipients.map((r) => (
              <span key={r.id} className="flex items-center gap-1 rounded-md border border-teal/25 bg-panel px-2 py-0.5 text-[10.5px] font-semibold text-teal shadow-xs">
                {r.type === 'dept' ? '📁' : '👤'} {r.name}
                <button type="button" onClick={() => setRecipients((p) => p.filter((x) => x.id !== r.id))} className="ml-0.5 font-bold text-teal/50 hover:text-red-500 transition-colors">✕</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10.5px] text-ink3">지정된 수신처가 없습니다.</p>
        )}

        <button type="button" onClick={() => setRecipientDialog(true)}
          className="mt-auto w-full rounded-lg border border-dashed border-teal/40 py-1.5 text-[11px] font-bold text-teal hover:bg-teal-soft/40 transition-colors">
          + 수신처 추가
        </button>
      </div>

      {/* ─── 시행자 설정 카드 ─── */}
      <div className="relative z-10 rounded-xl border border-teal/20 bg-teal-soft/10 p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] font-bold text-teal">📦 시행자 설정</div>
          </div>
          <InfoTooltip text="문서 완료 후 실무 집행을 담당할 시행자(부서 또는 사원)를 1명 지정합니다." />
        </div>

        {executionTarget ? (
          <span className="flex items-center gap-1 rounded-md border border-teal/25 bg-panel px-2 py-0.5 text-[10.5px] font-semibold text-teal shadow-xs w-fit">
            {executionTarget.type === 'DEPT' ? '📁' : '👤'} {executionTarget.name}
            <button type="button" onClick={() => setExecutionTarget(null)} className="ml-0.5 font-bold text-teal/50 hover:text-red-500 transition-colors">✕</button>
          </span>
        ) : (
          <p className="text-[10.5px] text-ink3">지정된 시행자가 없습니다.</p>
        )}

        <button type="button" onClick={() => setExecDialog(true)}
          className="mt-auto w-full rounded-lg border border-dashed border-teal/40 py-1.5 text-[11px] font-bold text-teal hover:bg-teal-soft/40 transition-colors">
          {executionTarget ? '+ 시행자 변경' : '+ 시행자 지정'}
        </button>
      </div>

      {recipientDialog && (
        <SelectorDialog title="수신처 추가" org={org} excludeIds={excludeRecipientIds} singleSelect={false}
          onConfirm={(items) => {
            setRecipients((prev) => [
              ...prev,
              ...items.filter((item) => !prev.some((r) => r.id === item.id))
                .map((item) => ({ id: item.id, name: item.name, type: item.type as 'user' | 'dept' })),
            ]);
          }}
          onClose={() => setRecipientDialog(false)}
        />
      )}

      {execDialog && (
        <SelectorDialog title="시행자 지정" org={org} singleSelect={true}
          onConfirm={(items) => {
            const item = items[0];
            if (!item) return;
            setExecutionTarget({ type: item.type === 'dept' ? 'DEPT' : 'USER', id: item.id, name: item.name });
          }}
          onClose={() => setExecDialog(false)}
        />
      )}
    </div>
  );
}