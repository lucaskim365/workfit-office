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

export function DraftRecipientSection({
  recipients,
  setRecipients,
  executionTarget,
  setExecutionTarget,
  org,
}: {
  recipients: ApprovalRecipient[];
  setRecipients: React.Dispatch<React.SetStateAction<ApprovalRecipient[]>>;
  executionTarget: { type: 'USER' | 'DEPT'; id: string; name: string } | null;
  setExecutionTarget: (target: { type: 'USER' | 'DEPT'; id: string; name: string } | null) => void;
  org: { users: OrgUser[]; depts: OrgDept[] };
}) {
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [pickerType, setPickerType] = useState<'user' | 'dept'>('dept');
  const [pickerTargetId, setPickerTargetId] = useState('');
  const [execPickerType, setExecPickerType] = useState<'USER' | 'DEPT'>('DEPT');

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 수신처 지정 카드 */}
      <div className="rounded-xl border border-teal/20 bg-teal-soft/10 p-3.5 flex flex-col justify-between min-h-[130px]">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[12px] font-bold text-teal">📨 수신처 설정</div>
              <div className="text-[9.5px] text-ink3">문서 완료 시 자동 전송받을 수신처</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowRecipientPicker(!showRecipientPicker);
                  setPickerTargetId('');
                }}
                className="rounded-lg bg-teal-soft px-2 py-1 text-[10px] font-bold text-teal hover:bg-teal/20 transition-colors"
              >
                + 추가
              </button>
            </div>
          </div>

          {/* 수신처 추가 폼 */}
          {showRecipientPicker && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-panel p-2 border border-border">
              <select
                value={pickerType}
                onChange={(e) => {
                  setPickerType(e.target.value as 'user' | 'dept');
                  setPickerTargetId('');
                }}
                className="rounded border border-border-hi bg-panel px-2 py-1 text-[11px] text-ink outline-none"
              >
                <option value="dept">부서</option>
                <option value="user">사원</option>
              </select>

              <select
                value={pickerTargetId}
                onChange={(e) => setPickerTargetId(e.target.value)}
                className="flex-1 rounded border border-border-hi bg-panel px-2 py-1 text-[11px] text-ink outline-none"
              >
                <option value="">선택하세요</option>
                {pickerType === 'dept'
                  ? org.depts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))
                  : org.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.position} ({u.dept})
                      </option>
                    ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (!pickerTargetId) return;
                  if (pickerType === 'dept') {
                    const dept = org.depts.find((d) => d.id === pickerTargetId);
                    if (dept && !recipients.some((r) => r.id === dept.id)) {
                      setRecipients((prev) => [...prev, { id: dept.id, name: dept.name, type: 'dept' }]);
                    }
                  } else {
                    const user = org.users.find((u) => u.id === pickerTargetId);
                    if (user && !recipients.some((r) => r.id === user.id)) {
                      setRecipients((prev) => [
                        ...prev,
                        { id: user.id, name: `${user.name} ${user.position}`, type: 'user' },
                      ]);
                    }
                  }
                  setShowRecipientPicker(false);
                }}
                className="rounded bg-teal px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90"
              >
                추가
              </button>
            </div>
          )}
        </div>

        {/* 수신처 목록 태그 */}
        <div className="mt-2 flex-1">
          {recipients.length === 0 ? (
            <p className="text-[10.5px] text-ink3 pl-1">지정된 수신처가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 pl-1 max-h-[100px] overflow-y-auto">
              {recipients.map((r) => (
                <span
                  key={r.id}
                  className="flex items-center gap-1 rounded-md bg-panel border border-teal/20 px-2 py-0.5 text-[10.5px] font-semibold text-teal shadow-sm"
                >
                  {r.type === 'dept' ? '📁' : r.type === 'drafter' ? '👤 기안자:' : '👤'} {r.name}
                  <button
                    type="button"
                    onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))}
                    className="ml-1 font-bold text-teal/60 hover:text-red-500"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 시행자 지정 카드 */}
      <div className="rounded-xl border border-teal/20 bg-teal-soft/10 p-3.5 flex flex-col justify-between min-h-[130px]">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[12px] font-bold text-teal">📦 시행자 설정</div>
              <div className="text-[9.5px] text-ink3">완료 후 후속 실무를 처리할 시행자 지정</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-1.5">
            <select
              value={execPickerType}
              onChange={(e) => {
                const newType = e.target.value as 'USER' | 'DEPT';
                setExecPickerType(newType);
                setExecutionTarget(null);
              }}
              className="rounded border border-border bg-panel px-2 py-1 text-[11px] text-ink outline-none"
            >
              <option value="DEPT">부서</option>
              <option value="USER">사원</option>
            </select>

            <select
              value={executionTarget?.id ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setExecutionTarget(null);
                  return;
                }
                if (execPickerType === 'DEPT') {
                  const dept = org.depts.find((d) => d.id === val);
                  if (dept) {
                    setExecutionTarget({ type: 'DEPT', id: dept.id, name: dept.name });
                  }
                } else {
                  const user = org.users.find((u) => u.id === val);
                  if (user) {
                    setExecutionTarget({ type: 'USER', id: user.id, name: `${user.name} ${user.position}` });
                  }
                }
              }}
              className="flex-1 min-w-0 rounded border border-border bg-panel px-2 py-1 text-[11px] text-ink outline-none"
            >
              <option value="">시행자 지정 안함</option>
              {execPickerType === 'DEPT'
                ? org.depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))
                : org.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.position} ({u.dept})
                    </option>
                  ))}
            </select>
          </div>
        </div>

        <div className="mt-2 flex-1">
          {executionTarget ? (
            <div className="flex items-center justify-between rounded-md bg-panel border border-teal/20 px-2.5 py-1 text-[10.5px] font-semibold text-teal shadow-sm">
              <span>{executionTarget.type === 'DEPT' ? '📁' : '👤'} {executionTarget.name}</span>
              <button
                type="button"
                onClick={() => setExecutionTarget(null)}
                className="font-bold text-teal/60 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="text-[10.5px] text-ink3 pl-1">지정된 시행자가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
