import { useMemo } from 'react';
import type { ApprovalRouteRule, Resolver, RouteStep } from '@/domain/approvalRoute/schema';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { RESOLVERS, ROUTE_STEP_KINDS } from '@/domain/approvalRoute/schema';
import { DEPT_TYPES } from '@/domain/department/schema';
import { RESOLVER_LABEL, ARG_HINT } from '../utils';
import { RoutePreview } from './RoutePreview';

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal';

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold text-ink3">{label}</div>
      {children}
    </div>
  );
}

interface ApprovalRouteRuleEditorProps {
  rule: ApprovalRouteRule;
  onChange: (r: ApprovalRouteRule) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  msg: string;
  forms: ApprovalForm[];
  org: any;
}

export function ApprovalRouteRuleEditor({
  rule,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saving,
  msg,
  forms,
  org,
}: ApprovalRouteRuleEditorProps) {
  const set = (patch: Partial<ApprovalRouteRule>) => onChange({ ...rule, ...patch });
  const setStep = (i: number, patch: Partial<RouteStep>) =>
    set({ steps: rule.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStep = () =>
    set({
      steps: [
        ...rule.steps,
        { resolver: 'DEPT_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: false },
      ],
    });
  const delStep = (i: number) => set({ steps: rule.steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rule.steps.length) return;
    const next = [...rule.steps];
    [next[i], next[j]] = [next[j], next[i]];
    set({ steps: next });
  };

  const selectedForm = useMemo(() => forms.find((f) => f.code === rule.docType), [forms, rule.docType]);
  const dropdownFields = useMemo(() => {
    return selectedForm?.fields.filter((f) => f.type === '선택') ?? [];
  }, [selectedForm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-ink">{rule.id ? `룰 편집 · ${rule.id}` : '새 룰'}</div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink2">
          <input type="checkbox" checked={rule.active} onChange={(e) => set({ active: e.target.checked })} /> 사용
        </label>
      </div>

      <div className="grid grid-cols-1">
        <F label="룰 이름">
          <input value={rule.name} onChange={(e) => set({ name: e.target.value })} className={inp} />
        </F>
      </div>

      <div className="rounded-lg border border-border bg-panel-alt p-2.5">
        <div className="mb-2 text-[11px] font-bold text-ink2">적용 조건</div>
        <div className="grid grid-cols-2 gap-2">
          <F label="문서유형">
            <select
              disabled
              value={rule.docType}
              onChange={(e) => set({ docType: e.target.value, conditionKey: null, conditionValues: [] })}
              className={`${inp} opacity-60`}
            >
              {forms.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.name}
                </option>
              ))}
            </select>
          </F>
          {dropdownFields.length > 0 && (
            <F label="세부 구분 키 (드롭다운 필드)">
              <select
                value={rule.conditionKey ?? ''}
                onChange={(e) => set({ conditionKey: e.target.value || null, conditionValues: [] })}
                className={inp}
              >
                <option value="">(없음)</option>
                {dropdownFields.map((df) => (
                  <option key={df.key} value={df.key}>
                    {df.label}
                  </option>
                ))}
              </select>
            </F>
          )}
          {rule.conditionKey && (
            <div className="col-span-2">
              <F label="세부 구분 값 (다중 선택)">
                <div className="flex flex-wrap gap-1 mt-1 rounded border border-border bg-panel p-2">
                  {(dropdownFields.find((df) => df.key === rule.conditionKey)?.options ?? []).map((opt) => {
                    const checked = rule.conditionValues.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-1 text-[11px] font-medium text-ink2 mr-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextValues = e.target.checked
                              ? [...rule.conditionValues, opt]
                              : rule.conditionValues.filter((v) => v !== opt);
                            set({ conditionValues: nextValues });
                          }}
                          className="rounded border-border"
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </F>
            </div>
          )}
          <F label="부서 범위">
            <select
              value={rule.deptScope.kind}
              onChange={(e) => set({ deptScope: { ...rule.deptScope, kind: e.target.value as any } })}
              className={inp}
            >
              {['전체', '부서', '서브트리', '부서유형'].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </F>
          {rule.deptScope.kind === '부서유형' && (
            <F label="부서 유형">
              <select
                value={rule.deptScope.deptType ?? '본사'}
                onChange={(e) => set({ deptScope: { ...rule.deptScope, deptType: e.target.value as any } })}
                className={inp}
              >
                {DEPT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </F>
          )}
          {(rule.deptScope.kind === '부서' || rule.deptScope.kind === '서브트리') && (
            <F label="부서">
              <select
                value={rule.deptScope.deptId ?? ''}
                onChange={(e) => set({ deptScope: { ...rule.deptScope, deptId: e.target.value || null } })}
                className={inp}
              >
                <option value="">(부서 선택)</option>
                {org.depts.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </F>
          )}
          <F label="기안자 직급 이상">
            <select
              value={rule.positionToRank ?? ''}
              onChange={(e) => set({ positionToRank: e.target.value === '' ? null : Number(e.target.value) })}
              className={inp}
            >
              <option value="">(제한 없음)</option>
              {org.positions.slice().sort((a: any, b: any) => a.rank - b.rank).map((p: any) => (
                <option key={p.id} value={p.rank}>
                  {p.name}
                </option>
              ))}
            </select>
          </F>
          <F label="기안자 직급 이하">
            <select
              value={rule.positionFromRank ?? ''}
              onChange={(e) => set({ positionFromRank: e.target.value === '' ? null : Number(e.target.value) })}
              className={inp}
            >
              <option value="">(제한 없음)</option>
              {org.positions.slice().sort((a: any, b: any) => a.rank - b.rank).map((p: any) => (
                <option key={p.id} value={p.rank}>
                  {p.name}
                </option>
              ))}
            </select>
          </F>
          <F label="금액 이상">
            <input
              type="number"
              value={rule.amountFrom ?? ''}
              onChange={(e) => set({ amountFrom: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="무한"
              className={inp}
            />
          </F>
          <F label="금액 미만">
            <input
              type="number"
              value={rule.amountTo ?? ''}
              onChange={(e) => set({ amountTo: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="무한"
              className={inp}
            />
          </F>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-bold text-ink2">결재 단계(관계형)</div>
        <div className="space-y-1.5">
          {rule.steps.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-2 py-1.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-soft text-[10px] font-bold text-teal">
                {i + 1}
              </span>
              <select
                value={s.resolver}
                onChange={(e) => setStep(i, { resolver: e.target.value as Resolver, arg: null })}
                className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
              >
                {RESOLVERS.map((res) => (
                  <option key={res} value={res}>
                    {RESOLVER_LABEL[res]}
                  </option>
                ))}
              </select>
              {s.resolver === 'SPECIFIC_USER' ? (
                <select
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value || null })}
                  className="w-48 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                >
                  <option value="">(사용자 선택)</option>
                  {org.users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.dept}, {u.position})
                    </option>
                  ))}
                </select>
              ) : s.resolver === 'SPECIFIC_DEPT_HEAD' ? (
                <select
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value || null })}
                  className="w-40 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                >
                  <option value="">(부서 선택)</option>
                  {org.depts.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : s.resolver === 'POSITION_AT_LEAST' ? (
                <select
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value || null })}
                  className="w-32 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                >
                  <option value="">(직급 선택)</option>
                  {org.positions.slice().sort((a: any, b: any) => a.rank - b.rank).map((p: any) => (
                    <option key={p.id} value={String(p.rank)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : ARG_HINT[s.resolver] ? (
                <input
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value })}
                  placeholder={ARG_HINT[s.resolver]}
                  className="w-20 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                />
              ) : null}
              <select
                value={s.kind}
                onChange={(e) => setStep(i, { kind: e.target.value as RouteStep['kind'] })}
                className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] font-semibold text-ink outline-none"
              >
                {ROUTE_STEP_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-0.5 text-[10px] text-ink3">
                <input
                  type="checkbox"
                  checked={s.dedupeSelf}
                  onChange={(e) => setStep(i, { dedupeSelf: e.target.checked })}
                  className="h-3 w-3"
                />
                셀프제외
              </label>
              <label className="flex items-center gap-0.5 text-[10px] text-ink3">
                <input
                  type="checkbox"
                  checked={s.optional}
                  onChange={(e) => setStep(i, { optional: e.target.checked })}
                  className="h-3 w-3"
                />
                선택
              </label>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => moveStep(i, -1)} className="text-[9px] text-ink3 hover:text-ink">
                  ▲
                </button>
                <button type="button" onClick={() => moveStep(i, 1)} className="text-[9px] text-ink3 hover:text-ink">
                  ▼
                </button>
                <button type="button" onClick={() => delStep(i)} className="text-[12px] text-ink3 hover:text-red-500">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addStep}
          className="mt-1.5 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal"
        >
          + 단계 추가
        </button>
      </div>

      <RoutePreview rule={rule} />

      {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
      <div className="flex items-center justify-between pt-1">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-500/5"
          >
            룰 삭제
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
