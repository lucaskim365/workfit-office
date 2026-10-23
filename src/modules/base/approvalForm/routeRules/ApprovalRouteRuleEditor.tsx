import { useMemo } from 'react';
import type { ApprovalRouteRule, Resolver, RouteStep } from '@/domain/approvalRoute/schema';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { RoutePreview } from './RoutePreview';
import type { ApprovalStep, StepKind } from '@/domain/approvalDoc/schema';
import { ApprovalLineBuilder } from '@/modules/gw/approval/ApprovalLineBuilder';
import {
  DollarSign,
  FileText,
  Layers,
} from 'lucide-react';

const inp =
  'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal transition-colors';

/**
 * 실무 관리자 친화적 직책 라벨 및 프리셋 정의.
 * 엔지니어링 용어(RESOLVER, arg, rank, dedupeSelf 등)를 배제하고
 * 총무/인사 실무자가 이해하는 자연어 직책으로 매핑합니다.
 */

/** 규칙 단계 ↔ 결재선 편집기 단계 — approverId 에 역할 토큰('role:MANAGER' 등) 또는 사용자 ID */
function stepToken(st: RouteStep): string {
  if (st.resolver === 'SPECIFIC_USER') return String(st.arg ?? '');
  return st.arg != null && st.arg !== '' ? `role:${st.resolver}:${st.arg}` : `role:${st.resolver}`;
}

function tokenToResolver(token: string): Pick<RouteStep, 'resolver' | 'arg'> {
  if (!token.startsWith('role:')) return { resolver: 'SPECIFIC_USER', arg: token };
  const [, resolver, arg] = token.split(':');
  return { resolver: resolver as Resolver, arg: arg ?? null };
}

function toLine(steps: RouteStep[]): ApprovalStep[] {
  return steps.map((st, i) => ({
    seq: i + 1,
    parallelGroup: st.parallelGroup ?? null,
    executionType: st.parallelGroup ? ('parallel' as const) : ('sequential' as const),
    kind: (st.kind === '검토' ? '결재' : st.kind) as StepKind,
    approverId: stepToken(st),
    delegatedFromId: null,
    decision: '대기' as const,
    decidedAt: null,
    comment: '',
  }));
}

function fromLine(next: ApprovalStep[], prev: RouteStep[]): RouteStep[] {
  return [...next]
    .sort((a, b) => a.seq - b.seq)
    .map((st) => {
      const old = prev.find((p) => stepToken(p) === st.approverId);
      const kind: RouteStep['kind'] = st.kind === '대결' || st.kind === '전결' ? '결재' : st.kind;
      return {
        ...tokenToResolver(st.approverId),
        kind,
        parallelGroup: st.parallelGroup ?? null,
        dedupeSelf: old?.dedupeSelf ?? true,
        optional: old?.optional ?? false,
      };
    });
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

  const lineSteps = useMemo(() => toLine(rule.steps), [rule.steps]);

  /** 결재선 편집기에서 고를 역할 — 기본 역할 + 부서별 부서장 + 규칙에 이미 있는 다른 역할 */
  const roles = useMemo(() => {
    const base = [
      { token: 'role:MANAGER', label: '직속 상급자', desc: '기안자의 1차 보고 상사' },
      { token: 'role:DEPT_HEAD', label: '소속 팀장(부서장)', desc: '기안자 부서의 장' },
      { token: 'role:PARENT_DEPT_HEAD:1', label: '상위 부서장(본부장)', desc: '소속 부서의 상위 조직장' },
      { token: 'role:ROLE_CEO', label: '대표이사', desc: '회사 최고경영자' },
      ...((org?.depts ?? []) as Array<{ id: string; name: string }>).map((d) => ({
        token: `role:SPECIFIC_DEPT_HEAD:${d.id}`,
        label: `${d.name} 부서장`,
        desc: '특정 부서의 장',
      })),
    ];
    rule.steps.forEach((st) => {
      const token = stepToken(st);
      if (token.startsWith('role:') && !base.some((r) => r.token === token)) {
        base.push({ token, label: `${st.resolver}${st.arg != null ? ` (${st.arg})` : ''}`, desc: '기존 규칙 단계' });
      }
    });
    return base;
  }, [org, rule.steps]);

  const selectedForm = useMemo(
    () => forms.find((f) => f.code === rule.docType),
    [forms, rule.docType]
  );
  const dropdownFields = useMemo(() => {
    return selectedForm?.fields.filter((f) => f.type === '선택') ?? [];
  }, [selectedForm]);

  // 서식 대상 (전사 공통 vs 특정 서식)
  const isGlobalForm = !rule.docType || rule.docType === '전체';

  // 금액 프리셋 설정 헬퍼
  const setAmountPreset = (from: number | null) => {
    set({ amountFrom: from, amountTo: null });
  };

  return (
    <div className="space-y-4 text-ink">
      {/* 1. 상단 기본정보 (규칙명 + 활성 상태) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel-alt/40 p-3.5">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[11px] font-bold text-ink3 mb-1">결재 규칙명 *</label>
          <input
            value={rule.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="예: 지출 1,000만 원 이상 본부장-대표이사 결재"
            className="w-full rounded-lg border border-border bg-panel px-3 py-1.5 text-[13px] font-bold text-ink outline-none focus:border-teal"
          />
        </div>

        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink cursor-pointer pt-4">
          <input
            type="checkbox"
            checked={rule.active}
            onChange={(e) => set({ active: e.target.checked })}
            className="h-4 w-4 rounded text-teal focus:ring-teal"
          />
          <span>규칙 활성화(운영)</span>
        </label>
      </div>

      {/* 2. 적용 대상 서식 선택 (레고 블록 1) */}
      <div className="rounded-xl border border-border bg-panel p-3.5 space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <FileText className="h-4 w-4 text-teal" />
          <span className="text-[12.5px] font-bold text-ink">1. 어떤 문서에 적용할까요?</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => set({ docType: '전체', formId: null, conditionKey: null, conditionValues: [] })}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
              isGlobalForm
                ? 'border-teal bg-teal-soft/20 text-teal ring-1 ring-teal'
                : 'border-border bg-panel-alt/40 text-ink2 hover:bg-panel-alt'
            }`}
          >
            <span className="text-xl">🌐</span>
            <div>
              <div className="text-[12px] font-bold">전사 공통 규칙</div>
              <div className="text-[10.5px] text-ink3 mt-0.5">모든 결재 서식에 기본 적용됩니다.</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isGlobalForm) {
                const firstForm = forms[0];
                set({
                  docType: firstForm?.code || '기안',
                  formId: firstForm?.id || null,
                  conditionKey: null,
                  conditionValues: [],
                });
              }
            }}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
              !isGlobalForm
                ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500'
                : 'border-border bg-panel-alt/40 text-ink2 hover:bg-panel-alt'
            }`}
          >
            <span className="text-xl">📄</span>
            <div>
              <div className="text-[12px] font-bold">특정 서식 전용 규칙</div>
              <div className="text-[10.5px] text-ink3 mt-0.5">선택한 특정 서식에만 동작합니다.</div>
            </div>
          </button>
        </div>

        {/* 특정 서식 선택 드롭다운 */}
        {!isGlobalForm && (
          <div className="pt-2 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-ink3 mb-1">대상 결재서식 선택</label>
              <select
                value={rule.docType}
                onChange={(e) => {
                  const targetForm = forms.find((f) => f.code === e.target.value);
                  set({
                    docType: e.target.value,
                    formId: targetForm?.id || null,
                    conditionKey: null,
                    conditionValues: [],
                  });
                }}
                className={inp}
              >
                {forms.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.icon || '📄'} {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 서식 내부 구분키 (옵션이 있는 경우) */}
            {dropdownFields.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-ink3 mb-1">
                  서식 세부 구분 조건 (선택)
                </label>
                <select
                  value={rule.conditionKey ?? ''}
                  onChange={(e) => set({ conditionKey: e.target.value || null, conditionValues: [] })}
                  className={inp}
                >
                  <option value="">(전체 구분)</option>
                  {dropdownFields.map((df) => (
                    <option key={df.key} value={df.key}>
                      {df.label} 필드 기준
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 세부 구분 값 체크박스 */}
            {rule.conditionKey && (
              <div className="col-span-full rounded-lg bg-panel-alt p-2.5 border border-border">
                <div className="text-[11px] font-bold text-ink2 mb-1.5">세부 조건 값 선택:</div>
                <div className="flex flex-wrap gap-2">
                  {(dropdownFields.find((df) => df.key === rule.conditionKey)?.options ?? []).map(
                    (opt) => {
                      const checked = rule.conditionValues.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-ink2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextValues = e.target.checked
                                ? [...rule.conditionValues, opt]
                                : rule.conditionValues.filter((v) => v !== opt);
                              set({ conditionValues: nextValues });
                            }}
                            className="h-3.5 w-3.5 rounded text-teal"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 적용 조건 (레고 블록 2 - 비워두면 무조건 적용) */}
      <div className="rounded-xl border border-border bg-panel p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-teal" />
            <span className="text-[12.5px] font-bold text-ink">
              2. 언제 이 규칙이 동작할까요? (발동 조건)
            </span>
          </div>
          <span className="text-[10.5px] text-ink3">조건 미설정 시 모든 임직원에게 적용됩니다</span>
        </div>

        {/* 금액 조건 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-ink3">청구 금액 조건</span>
            {/* 빠른 프리셋 버튼 */}
            <div className="flex gap-1">
              {[
                { label: '전체', val: null },
                { label: '100만↑', val: 1000000 },
                { label: '500만↑', val: 5000000 },
                { label: '1,000만↑', val: 10000000 },
                { label: '5,000만↑', val: 50000000 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setAmountPreset(p.val)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                    rule.amountFrom === p.val
                      ? 'bg-teal text-white'
                      : 'bg-panel-alt text-ink3 hover:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="number"
                value={rule.amountFrom ?? ''}
                onChange={(e) =>
                  set({ amountFrom: e.target.value === '' ? null : Number(e.target.value) })
                }
                placeholder="최소 금액 (0원)"
                className={inp}
              />
              {rule.amountFrom !== null && (
                <div className="text-[10px] text-teal font-semibold mt-0.5">
                  {new Intl.NumberFormat('ko-KR').format(rule.amountFrom)}원 이상
                </div>
              )}
            </div>
            <div>
              <input
                type="number"
                value={rule.amountTo ?? ''}
                onChange={(e) =>
                  set({ amountTo: e.target.value === '' ? null : Number(e.target.value) })
                }
                placeholder="최대 금액 (무제한)"
                className={inp}
              />
              {rule.amountTo !== null && (
                <div className="text-[10px] text-teal font-semibold mt-0.5">
                  {new Intl.NumberFormat('ko-KR').format(rule.amountTo)}원 이하
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 기안자 부서 및 직급 조건 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border/60">
          <div>
            <label className="block text-[11px] font-bold text-ink3 mb-1">기안자 부서</label>
            <select
              value={rule.deptScope.kind === '전체' ? 'ALL' : rule.deptScope.deptId ?? ''}
              onChange={(e) => {
                if (e.target.value === 'ALL') {
                  set({ deptScope: { kind: '전체', deptId: null, deptType: null } });
                } else {
                  set({ deptScope: { kind: '부서', deptId: e.target.value, deptType: null } });
                }
              }}
              className={inp}
            >
              <option value="ALL">전체 부서 (모든 부서원)</option>
              {org.depts.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-ink3 mb-1">기안자 직급 제한</label>
            <select
              value={rule.positionToRank ?? ''}
              onChange={(e) =>
                set({ positionToRank: e.target.value === '' ? null : Number(e.target.value) })
              }
              className={inp}
            >
              <option value="">전체 직급 (모든 직급)</option>
              {org.positions
                .slice()
                .sort((a: any, b: any) => a.rank - b.rank)
                .map((p: any) => (
                  <option key={p.id} value={p.rank}>
                    {p.name} 이상
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. 자동 생성 결재선 (레고 블록 3 - 원클릭 직책 추가 & 타임라인) */}
      <div className="rounded-xl border border-border bg-panel p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal" />
            <span className="text-[12.5px] font-bold text-ink">
              3. 결재선 단계 구성 ({rule.steps.length}단계)
            </span>
          </div>
          <span className="text-[10.5px] text-teal font-bold">
            * 기안자 셀프 결재는 엔진에서 자동 스킵됩니다
          </span>
        </div>

        {/* 기안 작성의 결재선 편집과 같은 편집기 — 사람 대신 역할(직속 상급자·부서장 등)도 고를 수 있음 */}
        <ApprovalLineBuilder
          steps={lineSteps}
          onChange={(next) => set({ steps: fromLine(next, rule.steps) })}
          drafterId=""
          docType={rule.docType}
          amount={null}
          ruleMode={{ roles }}
        />
      </div>

      {/* 5. 실시간 결재선 시뮬레이터 (RoutePreview) */}
      <RoutePreview rule={rule} />

      {/* 메시지 알림 */}
      {msg && (
        <div className="rounded-lg bg-teal-soft/50 border border-teal/30 p-2.5 text-[12px] font-bold text-teal">
          {msg}
        </div>
      )}

      {/* 하단 모달 액션 버튼 */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-500/30 px-3.5 py-1.5 text-[12px] font-bold text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            규칙 삭제
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border bg-panel px-4 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-teal px-5 py-1.5 text-[12px] font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {saving ? '저장 중...' : '규칙 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
