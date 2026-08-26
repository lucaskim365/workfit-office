import React, { useState, useEffect, useMemo } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { amountFieldOf, RESERVED_BODY_KEY, type ApprovalForm, type FormField, type FieldValue } from '@/domain/approvalForm/schema';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { DynamicField } from '@/modules/gw/approval/formFields';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal';

interface FormPreviewProps {
  form: ApprovalForm;
  onChangeField?: (index: number, patch: Partial<FormField>) => void;
}

export function FormPreview({ form, onChangeField }: FormPreviewProps) {
  const org = useOrgTree();
  const [tab, setTab] = useState<'폼' | '인쇄'>('폼');
  const [values, setValues] = useState<Record<string, FieldValue>>({});

  useEffect(() => {
    setValues({});
  }, [form.id, form.code]);
  
  const setVals = (patch: Record<string, FieldValue>) => {
    setValues((prev) => ({ ...prev, ...patch }));
    
    Object.entries(patch).forEach(([key, val]) => {
      const idx = form.fields.findIndex((f) => f.key === key);
      if (idx !== -1 && form.fields[idx].type === '표' && typeof val === 'string' && val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cols)) {
            onChangeField?.(idx, {
              options: parsed.cols,
              placeholder: JSON.stringify({
                cols: parsed.cols,
                colWidths: parsed.colWidths || {},
                tableWidth: parsed.tableWidth || '100%',
                defaultRows: parsed.rows || [],
                merges: parsed.merges || [],
                headerValues: parsed.headerValues || {},
                amountCells: parsed.amountCells || [],
                sumCell: parsed.sumCell || null,
                secretCols: parsed.secretCols || [],
                secretCells: parsed.secretCells || [],
                secretRows: parsed.secretRows || []
              })
            });
          }
        } catch (e) {}
      }
    });
  };

  const amountField = amountFieldOf(form);

  const sampleDoc = useMemo<ApprovalDoc>(() => {
    const u = org.users;
    const dummyDrafter = {
      id: 'dummy_hong',
      name: '홍길동',
      dept: '기획팀',
      position: '대리'
    };

    let leave = null;
    if (form.code === '휴가') {
      leave = {
        leaveType: (values['leaveType'] as string) || '',
        startDate: (values['period'] as string) || '',
        endDate: (values['period__end'] as string) || '',
        days: values['period__days'] ? Number(values['period__days']) : null,
      };
    }

    return {
      id: 'PREVIEW',
      docNo: 'AP-000000-000',
      docType: form.code || '서식',
      title: `${form.name || '서식'} 미리보기`,
      drafterId: dummyDrafter.id,
      drafterName: dummyDrafter.name,
      drafterDept: dummyDrafter.dept,
      drafterDeptId: 'D010',
      drafterPos: dummyDrafter.position,
      status: '진행중',
      steps: u.slice(0, 3).map((x, i) => ({
        seq: i + 1,
        parallelGroup: null,
        executionType: 'sequential',
        kind: i === 2 ? '전결' : '결재',
        approverId: x.id,
        delegatedFromId: null,
        decision: i === 0 ? '승인' : '대기',
        decidedAt: null,
        comment: '',
      })),
      amount: amountField ? 3_000_000 : null,
      body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : '(본문 미리보기)',
      form: leave as any,
      fieldValues: values,
      attachments: [],
      recipients: [],
      relatedDocs: [],
      securityLevel: '일반',
      visibility: '부서',
      isPostApproval: false,
      executionsSnapshot: [],
      executionDepts: [],
      currentSeq: 1,
      createdAt: null,
      submittedAt: '2026-07-07T00:00:00.000Z',
      completedAt: null,
    };
  }, [form, org.users, values, amountField]);

  return (
    <div className="rounded-lg border border-teal/40 bg-teal-soft/20 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-teal">🔎 미리보기</span>
          {(['폼', '인쇄'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                tab === t ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'
              }`}
            >
              {t === '폼' ? '상신 폼' : '인쇄 문서'}
            </button>
          ))}
        </div>
        {tab === '인쇄' && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-teal-soft text-teal border border-teal/20 px-2 py-0.5 text-[10px] font-bold hover:bg-teal hover:text-white transition-colors"
          >
            🖨️ 실제 인쇄 미리보기
          </button>
        )}
      </div>

      {tab === '폼' ? (
        <div className="rounded-lg bg-panel p-3">
          <div className="mb-2 text-[11px] font-bold text-ink2">제목 <span className="font-normal text-ink3">(예시)</span></div>
          <input disabled placeholder="문서 제목" className={`${inp} mb-3 opacity-70`} />
          <div className="grid grid-cols-2 gap-x-4">
            {(() => {
              const nodes: React.ReactNode[] = [];
              let lastSection = '';

              form.fields.forEach((f, i) => {
                if (f.visibleIf) {
                  const parts = f.visibleIf.split(':');
                  if (parts.length === 2) {
                    const [condKey, condVal] = parts;
                    if (String(values[condKey] ?? '') !== condVal) {
                      return;
                    }
                  }
                }

                if (f.section && f.section !== lastSection) {
                  lastSection = f.section;
                  nodes.push(
                    <div key={`sec-${f.section}`} className="col-span-2 mt-2 mb-1.5 text-[11px] font-bold text-teal border-b border-teal/15 pb-0.5">
                      {f.section}
                    </div>
                  );
                }
                const span = f.width === 'half' ? 'col-span-1' : 'col-span-2';
                nodes.push(
                  <div key={f.key || i} className={span}>
                    <div className="mb-1 text-[11px] font-bold text-ink2">{f.label || f.key}{f.required && ' *'}</div>
                    <DynamicField field={f} values={values} set={setVals} org={org} />
                  </div>
                );
              });

              return nodes;
            })()}
          </div>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto rounded-lg bg-panel-alt/50 p-4 flex justify-center">
          <div className="w-[800px] shrink-0 min-h-[297mm] bg-white p-8 shadow-lg border border-border/60 rounded-sm">
            <ApprovalDocumentView doc={sampleDoc} formOverride={form} isPreview={true} />
          </div>
        </div>
      )}
    </div>
  );
}
