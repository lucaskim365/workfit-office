import { useMemo } from 'react';
import type { ApprovalRouteRule, Resolver, RouteStep } from '@/domain/approvalRoute/schema';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { RoutePreview } from './RoutePreview';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
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
interface RolePreset {
  label: string;
  desc: string;
  icon: string;
  resolver: Resolver;
  defaultArg: string | null;
  defaultKind: RouteStep['kind'];
}

const ROLE_PRESETS: RolePreset[] = [
  {
    label: '직속 상급자',
    desc: '기안자의 1차 보고 상사',
    icon: '👔',
    resolver: 'MANAGER',
    defaultArg: null,
    defaultKind: '결재',
  },
  {
    label: '소속 팀장(부서장)',
    desc: '기안자 부서의 장',
    icon: '🏢',
    resolver: 'DEPT_HEAD',
    defaultArg: null,
    defaultKind: '결재',
  },
  {
    label: '본부장 (상위 부서장)',
    desc: '소속 부서의 상위 조직장',
    icon: '🏛️',
    resolver: 'PARENT_DEPT_HEAD',
    defaultArg: '1',
    defaultKind: '전결',
  },
  {
    label: '대표이사 (CEO)',
    desc: '회사 최고경영자',
    icon: '👑',
    resolver: 'ROLE_CEO',
    defaultArg: null,
    defaultKind: '전결',
  },
  {
    label: '특정 부서장',
    desc: '재경팀장, 인사팀장 등',
    icon: '👥',
    resolver: 'SPECIFIC_DEPT_HEAD',
    defaultArg: '',
    defaultKind: '검토',
  },
  {
    label: '특정 사용자',
    desc: '지정 임직원 결재',
    icon: '👤',
    resolver: 'SPECIFIC_USER',
    defaultArg: '',
    defaultKind: '결재',
  },
];

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
    set({
      steps: rule.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });

  /** 원클릭 프리셋으로 결재 단계 추가 (셀프제외는 항상 true로 엔진 자동 보장) */
  const addPresetStep = (preset: RolePreset) => {
    const isFirstStep = rule.steps.length === 0;
    const newStep: RouteStep = {
      resolver: preset.resolver,
      arg: preset.defaultArg,
      kind: isFirstStep ? '결재' : preset.defaultKind,
      dedupeSelf: true, // 내부 엔진에서 항상 자동 스킵
      optional: false,
    };
    set({ steps: [...rule.steps, newStep] });
  };

  const delStep = (i: number) => set({ steps: rule.steps.filter((_, idx) => idx !== i) });

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rule.steps.length) return;
    const next = [...rule.steps];
    [next[i], next[j]] = [next[j], next[i]];
    set({ steps: next });
  };

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

        {/* 원클릭 직책 빠른 추가 버튼 툴바 */}
        <div>
          <div className="text-[11px] font-bold text-ink3 mb-1.5">클릭하여 결재 단계 추가:</div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addPresetStep(preset)}
                className="flex items-center gap-1 rounded-lg border border-border bg-panel-alt px-2.5 py-1 text-[11.5px] font-bold text-ink hover:border-teal hover:bg-teal-soft/30 hover:text-teal transition-all cursor-pointer shadow-xs"
                title={preset.desc}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
                <Plus size={11} className="text-ink3" />
              </button>
            ))}
          </div>
        </div>

        {/* 생성된 결재 단계 리스트 (시각적 타임라인) */}
        {rule.steps.length === 0 ? (
          <div className="py-8 text-center text-[12px] border border-dashed border-border rounded-xl text-ink3">
            추가된 결재 단계가 없습니다. 위의 버튼을 눌러 결재자를 추가하세요.
          </div>
        ) : (
          <div className="space-y-1.5 pt-1">
            {rule.steps.map((s, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === rule.steps.length - 1;

              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-panel-alt/70 p-2.5 hover:border-teal/30 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* 순번 배지 */}
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-teal text-[11px] font-mono font-bold text-white shrink-0 shadow-2xs">
                      {idx + 1}
                    </span>

                    {/* 결재 대상 설명 및 상세 선택 */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {s.resolver === 'MANAGER' && (
                        <span className="font-bold text-[12.5px] text-ink flex items-center gap-1">
                          <span>👔</span> <span>직속 상급자</span>
                        </span>
                      )}
                      {s.resolver === 'DEPT_HEAD' && (
                        <span className="font-bold text-[12.5px] text-ink flex items-center gap-1">
                          <span>🏢</span> <span>소속 팀장 (부서장)</span>
                        </span>
                      )}
                      {s.resolver === 'PARENT_DEPT_HEAD' && (
                        <span className="font-bold text-[12.5px] text-ink flex items-center gap-1">
                          <span>🏛️</span> <span>상위 부서장 (본부장)</span>
                        </span>
                      )}
                      {s.resolver === 'ROLE_CEO' && (
                        <span className="font-bold text-[12.5px] text-ink flex items-center gap-1">
                          <span>👑</span> <span>대표이사 (최고경영자)</span>
                        </span>
                      )}

                      {/* 특정 사용자 선택 */}
                      {s.resolver === 'SPECIFIC_USER' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-bold text-ink">👤 특정인:</span>
                          <select
                            value={s.arg ?? ''}
                            onChange={(e) => setStep(idx, { arg: e.target.value || null })}
                            className="rounded border border-border bg-panel px-2 py-0.5 text-[11.5px] font-medium text-ink outline-none focus:border-teal"
                          >
                            <option value="">(임직원 선택)</option>
                            {org.users.map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.dept} · {u.position})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* 특정 부서장 선택 */}
                      {s.resolver === 'SPECIFIC_DEPT_HEAD' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-bold text-ink">👥 부서장:</span>
                          <select
                            value={s.arg ?? ''}
                            onChange={(e) => setStep(idx, { arg: e.target.value || null })}
                            className="rounded border border-border bg-panel px-2 py-0.5 text-[11.5px] font-medium text-ink outline-none focus:border-teal"
                          >
                            <option value="">(부서 선택)</option>
                            {org.depts.map((d: any) => (
                              <option key={d.id} value={d.id}>
                                {d.name} 팀장
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 결재 구분 (결재 vs 합의 vs 전결 vs 참조) + 순서 이동/삭제 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={s.kind}
                      onChange={(e) =>
                        setStep(idx, { kind: e.target.value as RouteStep['kind'] })
                      }
                      className={`rounded-lg border px-2 py-1 text-[11px] font-bold outline-none cursor-pointer ${
                        s.kind === '전결'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : s.kind === '검토'
                          ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400'
                          : s.kind === '참조'
                          ? 'border-border bg-panel text-ink3'
                          : 'border-teal/40 bg-teal-soft/40 text-teal'
                      }`}
                    >
                      <option value="결재">결재</option>
                      <option value="전결">전결</option>
                      <option value="검토">검토</option>
                      <option value="참조">참조</option>
                    </select>

                    {/* 위/아래 이동 */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveStep(idx, -1)}
                      className="rounded p-1 text-ink3 hover:text-ink disabled:opacity-30 cursor-pointer"
                      title="위로 이동"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => moveStep(idx, 1)}
                      className="rounded p-1 text-ink3 hover:text-ink disabled:opacity-30 cursor-pointer"
                      title="아래로 이동"
                    >
                      <ChevronDown size={14} />
                    </button>

                    {/* 삭제 */}
                    <button
                      type="button"
                      onClick={() => delStep(idx)}
                      className="rounded p-1 text-ink3 hover:text-red-500 transition-colors cursor-pointer"
                      title="단계 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
