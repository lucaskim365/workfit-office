import { useState } from 'react';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useUsers } from '@/features/user/useUsers';
import { useJobTitles } from '@/features/jobTitle/useJobTitles';
import { useRouteRules } from '@/features/gw/useRouteRules';
import { FormPermissionSettings } from '../components/FormPermissionSettings';
import { FormTargetSelector } from '../components/FormTargetSelector';
import { ApprovalRouteRuleModal } from '../routeRules/ApprovalRouteRuleModal';
import { PRESERVATION_OPTIONS } from '@/modules/gw/approval/sheetForm/approvalSheet';

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2 py-1.5 text-[12px] text-ink outline-none focus:border-teal';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-bold text-ink2">{label}</div>
      {children}
      {hint && <div className="text-[10.5px] leading-snug text-ink3">{hint}</div>}
    </div>
  );
}

/**
 * 시트 서식 편집기의 [서식 설정] — 기존 서식 편집기와 같은 설정(정렬·보존연한·맺음말·작성/열람 권한·보안·기본 수신·참조·결재선 규칙).
 * 바꾸면 서식 저장 때 서식 기록(approvalForms)에 저장한다. 결재선 규칙은 규칙 저장소에 바로 저장(기존 편집기와 같음).
 */
export function SheetFormSettings({ form, onChange }: { form: ApprovalForm; onChange: (patch: Partial<ApprovalForm>) => void }) {
  const org = useOrgTree();
  const { data: users = [] } = useUsers();
  const { data: jobTitles = [] } = useJobTitles();
  const { data: rules = [] } = useRouteRules();
  const [ruleOpen, setRuleOpen] = useState(false);
  const ruleCount = rules.filter((r) => r.formId === form.id || (r.formId === null && r.docType === form.code)).length;

  return (
    <div className="space-y-3.5 text-[12px]">
      <div className="text-[12.5px] font-extrabold text-ink">서식 설정</div>
      <div className="grid grid-cols-2 gap-2">
        <Row label="정렬 순서">
          <input type="number" className={inp} value={form.order} onChange={(e) => onChange({ order: Number(e.target.value) })} />
        </Row>
        <Row label="보존연한(기본)">
          <select className={inp} value={form.preservationPeriod || '5년'} onChange={(e) => onChange({ preservationPeriod: e.target.value })}>
            {PRESERVATION_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Row>
      </div>
      <Row label="맺음말" hint="문서 머리 넣기·기존 서식 변환 때 맺음말 칸에 들어가는 문구(이미 넣은 칸은 시트에서 고치세요)">
        <input className={inp} value={form.closing ?? ''} onChange={(e) => onChange({ closing: e.target.value })} placeholder="위와 같이 상신하오니 재가하여 주시기 바랍니다." />
      </Row>

      <FormPermissionSettings form={form} org={org} users={users} jobTitles={jobTitles} onChange={onChange} />

      <FormTargetSelector
        title="기본 수신 대상"
        desc="결재 완료 후 본 문서가 기본 수신되는 부서/사용자"
        deptId={form.recipientDeptId}
        userId={form.recipientUserId}
        depts={org.depts ?? []}
        users={users}
        org={org}
        onChange={(patch) => onChange({ recipientDeptId: patch.deptId ?? null, recipientUserId: patch.userId ?? null })}
      />
      <FormTargetSelector
        title="기본 참조 대상"
        desc="기안 상신 즉시 참조 열람할 부서/사용자"
        deptId={form.referenceDeptId}
        userId={form.referenceUserId}
        depts={org.depts ?? []}
        users={users}
        org={org}
        onChange={(patch) => onChange({ referenceDeptId: patch.deptId ?? null, referenceUserId: patch.userId ?? null })}
      />

      <div className="space-y-1.5 rounded-lg border border-border p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-bold text-ink">결재선 규칙</span>
          <span className="text-[10.5px] text-ink3">이 서식 규칙 {ruleCount}개</span>
        </div>
        {form.id ? (
          <button type="button" onClick={() => setRuleOpen(true)} className="w-full rounded-lg border border-teal/40 bg-teal-soft/40 py-1.5 text-[11.5px] font-bold text-teal hover:bg-teal-soft">
            결재선 규칙 설정
          </button>
        ) : (
          <div className="text-[10.5px] text-ink3">서식을 처음 저장한 뒤 설정할 수 있습니다.</div>
        )}
      </div>
      <ApprovalRouteRuleModal isOpen={ruleOpen} onClose={() => setRuleOpen(false)} form={form} org={org} />
    </div>
  );
}
