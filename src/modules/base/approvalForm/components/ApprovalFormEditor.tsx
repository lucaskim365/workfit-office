import React, { useState, useEffect, useMemo } from 'react';
import type { ApprovalForm, FormField, FieldType, ApprovalFolder } from '@/domain/approvalForm/schema';
import { FIELD_TYPES } from '@/domain/approvalForm/schema';
import { useJobTitles } from '@/features/jobTitle/useJobTitles';
import { useUsers } from '@/features/user/useUsers';
import { useRouteRules } from '@/features/gw/useRouteRules';
import { blankField } from '../utils';
import { FormPreview } from './FormPreview';
import { OptionsInput } from './OptionsInput';
import { FormPermissionSettings } from './FormPermissionSettings';
import { FormTargetSelector } from './FormTargetSelector';
import { ApprovalRouteRuleSettings } from '../routeRules/ApprovalRouteRuleSettings';

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal';

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10.5px] font-semibold text-ink3">{label}</span>
      {children}
    </label>
  );
}

interface ApprovalFormEditorProps {
  form: ApprovalForm;
  folders: ApprovalFolder[];
  org: any;
  onChange: (f: ApprovalForm) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  saving: boolean;
  msg: string;
}

export function ApprovalFormEditor({
  form,
  folders,
  org,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  saving,
  msg,
}: ApprovalFormEditorProps) {
  const { depts = [] } = org;
  const { data: jobTitles = [] } = useJobTitles();
  const { data: users = [] } = useUsers();
  const { data: rules = [] } = useRouteRules();

  const [selTab, setSelTab] = useState('공통');
  const [activeMenuTab, setActiveMenuTab] = useState<'edit' | 'settings' | 'rules'>('edit');

  const formRulesCount = useMemo(() => {
    return rules.filter(
      (r) => r.formId === form.id || (r.formId === null && r.docType === form.code)
    ).length;
  }, [rules, form.id, form.code]);

  const tabSelectorField = form.fields.find((f) => f.type === '선택' && f.isTabSelector);

  useEffect(() => {
    if (!tabSelectorField) {
      setSelTab('공통');
    } else if (!tabSelectorField.options.includes(selTab) && selTab !== '공통') {
      setSelTab('공통');
    }
  }, [tabSelectorField, selTab]);

  const set = (patch: Partial<ApprovalForm>) => onChange({ ...form, ...patch });
  const setField = (i: number, patch: Partial<FormField>) => {
    let nextFields = form.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    if (patch.isTabSelector) {
      nextFields = nextFields.map((f, idx) => (idx === i ? f : { ...f, isTabSelector: false }));
    }
    set({ fields: nextFields });
  };
  const addField = () => {
    const visibleIf = selTab === '공통' ? null : `${tabSelectorField?.key}:${selTab}`;
    set({ fields: [...form.fields, { ...blankField(), key: `field${form.fields.length + 1}`, visibleIf }] });
  };
  const delField = (i: number) => set({ fields: form.fields.filter((_, idx) => idx !== i) });
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.fields.length) return;
    const next = [...form.fields];
    [next[i], next[j]] = [next[j], next[i]];
    set({ fields: next });
  };

  return (
    <div className="space-y-4">
      {/* 서식 편집 헤더 */}
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-ink">{form.id ? `서식 편집 · ${form.code}` : '새 서식'}</div>
        <div className="flex items-center gap-3">
          {onDuplicate && form.id && (
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[11.5px] font-semibold text-ink2 hover:bg-border/30 transition-colors cursor-pointer"
            >
              서식 복사
            </button>
          )}
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set({ active: e.target.checked })}
              className="text-teal focus:ring-teal h-3.5 w-3.5"
            />{' '}
            사용
          </label>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-border mb-2">
        <button
          type="button"
          onClick={() => setActiveMenuTab('edit')}
          className={`px-4 py-2 text-[12.5px] font-bold border-b-2 transition-all ${
            activeMenuTab === 'edit'
              ? 'border-teal text-teal font-extrabold'
              : 'border-transparent text-ink3 hover:text-ink hover:border-border'
          }`}
        >
          서식 편집
        </button>
        <button
          type="button"
          onClick={() => setActiveMenuTab('settings')}
          className={`px-4 py-2 text-[12.5px] font-bold border-b-2 transition-all ${
            activeMenuTab === 'settings'
              ? 'border-teal text-teal font-extrabold'
              : 'border-transparent text-ink3 hover:text-ink hover:border-border'
          }`}
        >
          서식 설정 (보안·수신·참조)
        </button>
        {form.id && (
          <button
            type="button"
            onClick={() => setActiveMenuTab('rules')}
            className={`px-4 py-2 text-[12.5px] font-bold border-b-2 transition-all ${
              activeMenuTab === 'rules'
                ? 'border-teal text-teal font-extrabold'
                : 'border-transparent text-ink3 hover:text-ink hover:border-border'
            }`}
          >
            결재규칙 설정 ({formRulesCount})
          </button>
        )}
      </div>

      {/* 탭 내용 분기 */}
      {activeMenuTab === 'edit' && (
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-4 gap-2">
            <F label="서식 아이콘">
              <input value={form.icon} onChange={(e) => set({ icon: e.target.value })} className={inp} />
            </F>
            <F label="서식명">
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="출장신청서"
                className={inp}
              />
            </F>
            <F label="코드(문서유형)">
              <input
                value={form.code}
                onChange={(e) => set({ code: e.target.value })}
                placeholder="출장"
                className={inp}
              />
            </F>
            <F label="소속 폴더">
              <select
                value={form.folderId || ''}
                onChange={(e) => set({ folderId: e.target.value || null })}
                className={inp}
              >
                <option value="">루트 (미지정)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </F>
            <F label="정렬">
              <input
                type="number"
                value={form.order}
                onChange={(e) => set({ order: Number(e.target.value) })}
                className={inp}
              />
            </F>
            <div className="col-span-3">
              <F label="격식 문서명(인쇄)">
                <input
                  value={form.docTitle}
                  onChange={(e) => set({ docTitle: e.target.value })}
                  placeholder="출 장 신 청 서"
                  className={inp}
                />
              </F>
            </div>
            <div className="col-span-4">
              <F label="맺음말(인쇄)">
                <input
                  value={form.closing}
                  onChange={(e) => set({ closing: e.target.value })}
                  placeholder="위와 같이 신청하오니 재가하여 주시기 바랍니다."
                  className={inp}
                />
              </F>
            </div>
          </div>

          {/* 입력 필드 설정 */}
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 text-[12px] font-bold text-ink select-none">
              입력 필드 설정 ({form.fields.length}개)
            </div>

            <div className="mt-3 space-y-3">
              {tabSelectorField && (
                <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-1">
                  {['공통', ...tabSelectorField.options].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSelTab(tab)}
                      className={`rounded-t-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        selTab === tab ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {form.fields
                  .map((f, i) => ({ f, i }))
                  .filter(({ f }) => {
                    if (selTab === '공통') return !f.visibleIf;
                    return f.visibleIf === `${tabSelectorField?.key}:${selTab}`;
                  })
                  .map(({ f, i }) => {
                    const isCommonInTab = f.type === '선택' && f.isTabSelector;
                    return (
                      <div key={i} className="rounded-lg border border-border bg-panel px-3 py-2.5 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={f.key}
                            onChange={(e) => setField(i, { key: e.target.value })}
                            placeholder="필드 key (영문)"
                            className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                          <input
                            value={f.label}
                            onChange={(e) => setField(i, { label: e.target.value })}
                            placeholder="라벨 (한글)"
                            className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                          <select
                            value={f.type}
                            onChange={(e) => setField(i, { type: e.target.value as FieldType })}
                            className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            value={f.placeholder}
                            onChange={(e) => setField(i, { placeholder: e.target.value })}
                            placeholder="placeholder / 테이블 스키마 JSON"
                            className="w-32 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                          <select
                            value={f.width}
                            onChange={(e) => setField(i, { width: e.target.value as FormField['width'] })}
                            className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                          >
                            <option value="full">100%</option>
                            <option value="half">50%</option>
                          </select>
                          <input
                            value={f.section ?? ''}
                            onChange={(e) => setField(i, { section: e.target.value || '' })}
                            placeholder="섹션명 (선택)"
                            className="w-24 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />

                          <label
                            className="flex items-center gap-0.5 text-[10px] text-ink3 cursor-pointer"
                            title="금액결재 규칙 대조 시 사용됩니다."
                          >
                            <input
                              type="checkbox"
                              checked={f.isAmountKey ?? false}
                              onChange={(e) => setField(i, { isAmountKey: e.target.checked })}
                              className="h-3 w-3"
                            />
                            금액키
                          </label>

                          {!isCommonInTab && (
                            <select
                              value={f.visibleIf ?? ''}
                              onChange={(e) => setField(i, { visibleIf: e.target.value || null })}
                              className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                            >
                              <option value="">언제나 노출</option>
                              {form.fields
                                .filter((other) => other.type === '선택' && other.key && other.label)
                                .flatMap((other) =>
                                  other.options.map((opt) => (
                                    <option key={`${other.key}:${opt}`} value={`${other.key}:${opt}`}>
                                      [{other.label}] "{opt}" 일 때
                                    </option>
                                  ))
                                )}
                            </select>
                          )}
                          <label className="flex items-center gap-0.5 text-[10px] text-ink3">
                            <input
                              type="checkbox"
                              checked={f.required}
                              onChange={(e) => setField(i, { required: e.target.checked })}
                              className="h-3 w-3"
                            />
                            필수
                          </label>
                          <label
                            className="flex items-center gap-0.5 text-[10px] text-ink3 cursor-pointer"
                            title="열람 권한에 따라 텍스트 마스킹 및 블러 처리됩니다."
                          >
                            <input
                              type="checkbox"
                              checked={f.isSecret ?? false}
                              onChange={(e) => setField(i, { isSecret: e.target.checked })}
                              className="h-3 w-3"
                            />
                            보안필드
                          </label>
                          {f.type === '선택' && (
                            <label className="flex items-center gap-0.5 text-[10px] text-ink3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={f.isTabSelector ?? false}
                                onChange={(e) => setField(i, { isTabSelector: e.target.checked })}
                                className="h-3 w-3"
                              />
                              탭분할
                            </label>
                          )}
                          <div className="ml-auto flex items-center gap-1">
                            {!isCommonInTab && (
                              <button
                                type="button"
                                onClick={() => moveField(i, -1)}
                                className="text-[9px] text-ink3 hover:text-ink"
                              >
                                ▲
                              </button>
                            )}
                            {!isCommonInTab && (
                              <button
                                type="button"
                                onClick={() => moveField(i, 1)}
                                className="text-[9px] text-ink3 hover:text-ink"
                              >
                                ▼
                              </button>
                            )}
                            {!isCommonInTab && (
                              <button
                                type="button"
                                onClick={() => delField(i)}
                                className="text-[12px] text-ink3 hover:text-red-500"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        {(f.type === '선택' || f.type === '다중선택') && (
                          <div className="mt-1 w-full">
                            <span className="text-[9.5px] text-ink3">옵션 목록 (쉼표 구분)</span>
                            <OptionsInput value={f.options} onChange={(parsed) => setField(i, { options: parsed })} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <button
                type="button"
                onClick={addField}
                className="mt-1.5 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal"
              >
                + 필드 추가
              </button>
              <p className="mt-1 text-[10.5px] text-ink3">
                예약 key <b>body</b>(장문)=문서 본문 · 금액 필드에 <b>금액키</b> 지정 시 결재선 금액매칭에 사용.
              </p>
            </div>
          </div>

          {/* 폼 미리보기 */}
          <FormPreview form={form} onChangeField={setField} />
        </div>
      )}

      {/* 탭 2: 서식 설정 */}
      {activeMenuTab === 'settings' && (
        <div className="space-y-6">
          {/* 1. 기본 보안 및 보존 설정 */}
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="text-[13px] font-bold text-ink flex items-center gap-1.5 border-b border-border pb-2.5">
              <span>1. 기본 보안 및 보존 설정</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <F label="기본 보안 등급">
                <select
                  value={form.securityLevel || '일반'}
                  onChange={(e) => set({ securityLevel: e.target.value as any })}
                  className={`${inp} font-semibold text-ink`}
                >
                  <option value="일반">일반 문서</option>
                  <option value="대외비">대외비</option>
                  <option value="극비">극비</option>
                </select>
              </F>
              <F label="기본 공개 범위">
                <select
                  value={form.visibility || '부서'}
                  onChange={(e) => set({ visibility: e.target.value as any })}
                  className={`${inp} font-semibold text-ink`}
                >
                  <option value="전사">전사 공개</option>
                  <option value="부서">부서 공개</option>
                  <option value="비공개">비공개</option>
                </select>
              </F>
              <F label="보존연한">
                <select
                  value={form.preservationPeriod || '5년'}
                  onChange={(e) => set({ preservationPeriod: e.target.value })}
                  className={inp}
                >
                  <option value="1년">1년</option>
                  <option value="3년">3년</option>
                  <option value="5년">5년</option>
                  <option value="10년">10년</option>
                  <option value="영구">영구</option>
                </select>
              </F>
            </div>
            <div className="text-[10.5px] text-ink3 mt-1">
              서식을 기안할 때 적용될 기본 보안 등급, 부서/전사 공개 범위, 그리고 문서의 법적 보존연한을 설정합니다.
            </div>
          </div>

          {/* 2. 기안 권한 설정 */}
          <FormPermissionSettings form={form} org={org} users={users} jobTitles={jobTitles} onChange={set} />

          {/* 3. 기본 수신처 설정 */}
          <FormTargetSelector
            title="3. 기본 수신 대상 설정"
            desc="문서 결재가 완료된 후 본 문서가 기본적으로 수신 공유되는 대상을 정합니다."
            deptId={form.recipientDeptId}
            userId={form.recipientUserId}
            depts={depts}
            users={users}
            org={org}
            onChange={(patch) => set({ recipientDeptId: patch.deptId ?? null, recipientUserId: patch.userId ?? null })}
          />

          {/* 👀 4. 기본 참조 대상 설정 */}
          <FormTargetSelector
            title="👀 4. 기본 참조 대상 설정"
            desc="문서 기안 상신 즉시 실시간으로 본 문서를 참조 열람할 기본 대상(부서 또는 사용자)을 정합니다."
            deptId={form.referenceDeptId}
            userId={form.referenceUserId}
            depts={depts}
            users={users}
            org={org}
            onChange={(patch) => set({ referenceDeptId: patch.deptId ?? null, referenceUserId: patch.userId ?? null })}
          />
        </div>
      )}

      {/* 탭 3: 결재규칙 설정 */}
      {activeMenuTab === 'rules' && form.id && <ApprovalRouteRuleSettings form={form} org={org} />}

      {/* 공통 에디터 제어 하단 버튼 */}
      {msg && <p className="text-[12px] font-semibold text-teal">{msg}</p>}
      <div className="flex justify-end gap-2.5 border-t border-border pt-4">
        {onDelete && form.id && !form.system && (
          <button
            type="button"
            onClick={onDelete}
            className="mr-auto rounded-lg px-4 py-2 text-[12.5px] font-semibold text-red-500 hover:bg-red-500/5 cursor-pointer"
          >
            서식 삭제
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-panel px-4 py-2 text-[12.5px] font-semibold text-ink2 hover:bg-panel-alt cursor-pointer"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-teal px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {saving ? '저장 중...' : '서식 저장'}
        </button>
      </div>
    </div>
  );
}
