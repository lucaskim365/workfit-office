/**
 * 값에 따라 바뀌는 것 — 기준 칸(선택·여러 선택·체크 칸) 하나에서 '값마다 보이는 행'과 '값마다 고를 항목(종속 선택)'을 한 번에 설정한다.
 * 행·칸은 시트에서 눌러 고른다(고르기 모드는 부르는 쪽 SheetCellPanel 이 시트 선택을 받아 넣는다).
 * 기준 칸에 칸 이름이 없으면 처음 설정할 때 이름표로 지어 붙는다(valueRules.ensureSourceName).
 */
import { useEffect, useState } from 'react';
import type { Sheet } from '@/lib/sheet';
import { CHECK_MARK, cellAddress } from '@/domain/approvalForm/sheet/approvalSheet';
import {
  clearDependent,
  dependentCells,
  ensureSourceName,
  removeRowsFor,
  rowsShownFor,
  setBranchOptions,
  valueSourceAt,
} from '@/domain/approvalForm/sheet/valueRules';

/** 시트에서 눌러 고르는 중인 것 — 이 값일 때 보일 행, 또는 이 기준 칸에 따라 항목이 바뀔 칸 */
export type ValuePick = { kind: 'rows'; value: string } | { kind: 'dependent' };

const inp = 'w-full rounded-md border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none focus:border-teal';
const valueText = (v: string) => (v === CHECK_MARK ? '체크했을 때' : v);
const rowsText = (g: { r1: number; r2: number }) => (g.r1 === g.r2 ? `${g.r1 + 1}행` : `${g.r1 + 1}~${g.r2 + 1}행`);

export function ValueRulesPanel({
  sheet,
  source,
  pick,
  pickPlan,
  onApplyPick,
  onChange,
  onPick,
}: {
  sheet: Sheet;
  source: { r: number; c: number };
  pick: ValuePick | null;
  /** 고르는 중 지금 시트 선택 — 무엇을(target), 넣을 수 없는 이유(block). 아직 안 골랐으면 null */
  pickPlan: { target: string; block?: string } | null;
  /** 지금 선택을 넣는다 */
  onApplyPick: () => void;
  onChange: (next: Sheet) => void;
  onPick: (pick: ValuePick | null) => void;
}) {
  const src = valueSourceAt(sheet, source.r, source.c);
  const name = src?.name;
  const deps = name ? dependentCells(sheet, name) : [];
  // 갈래 항목 입력 중 글자(쉼표 그대로) — 칸을 벗어날 때 넣고 지운다
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => setDrafts({}), [source.r, source.c, deps.length]);

  if (!src) return null;
  // 체크 칸은 값이 하나라 종속 기준이 되지 않는다(칸 속성의 '항목을 다른 칸 값에 따라'와 같게)
  const canDepend = src.kind !== 'checkbox';
  const branchText = (dep: (typeof deps)[number], when: string) => (dep.input.depends?.branches.find((b) => b.when === when)?.options ?? []).join(', ');
  // 글자가 그대로면 시트를 바꾸지 않는다 — 눌렀다 나가기만 해도 쓰던 항목이 지워지지 않게
  const commitBranch = (dep: (typeof deps)[number], when: string, key: string, text: string) => {
    setDrafts(({ [key]: _done, ...rest }) => rest);
    if (text === branchText(dep, when)) return;
    const list = text.split(/[,\n]/).map((o) => o.trim()).filter(Boolean);
    onChange(setBranchOptions(sheet, dep.r, dep.c, when, list));
  };

  return (
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-2.5">
      <div>
        <div className="text-[12px] font-extrabold text-ink">
          <span className="text-indigo-600">{src.label}</span> 값에 따라 바뀌는 것
        </div>
        <div className="text-[10.5px] leading-snug text-ink3">값마다 보일 행과, 고를 항목이 바뀌는 칸을 정합니다. 행·칸은 시트에서 눌러 고릅니다.</div>
      </div>

      {pick && (
        <div className="space-y-1 rounded-lg bg-amber-100 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
          <div>{pick.kind === 'rows' ? `'${valueText(pick.value)}'일 때 보일 행을 시트에서 고르세요(여러 행은 끌어서)` : '값에 따라 항목이 바뀔 칸을 시트에서 누르세요'}</div>
          {pickPlan?.block && <div className="text-rose-600">{pickPlan.block}</div>}
          <div className="flex items-center justify-end gap-1.5">
            {pickPlan && !pickPlan.block && (
              <button type="button" onClick={onApplyPick} className="rounded bg-amber-500 px-2 py-0.5 text-[10.5px] text-white hover:bg-amber-600">
                {pickPlan.target} 넣기
              </button>
            )}
            <button type="button" onClick={() => onPick(null)} className="rounded border border-amber-400 px-1.5 py-0.5 text-[10.5px] hover:bg-amber-50">
              취소
            </button>
          </div>
        </div>
      )}

      {src.options.length === 0 ? (
        <div className="text-[10.5px] text-amber-700">먼저 이 칸의 '고를 항목'을 적으세요.</div>
      ) : (
        <div className="space-y-1.5">
          {deps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[10.5px] text-ink3">
              항목이 바뀌는 칸:
              {deps.map((d) => (
                <span key={`${d.r}:${d.c}`} className="flex items-center gap-1 rounded bg-white px-1.5 py-0.5 font-semibold text-ink2 ring-1 ring-border">
                  {d.label}({cellAddress(d.r, d.c)})
                  <button type="button" title="종속 풀기 — 모든 항목을 한 목록으로" onClick={() => onChange(clearDependent(sheet, d.r, d.c))} className="text-ink3 hover:text-rose-600">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {src.options.map((v) => {
            const groups = name ? rowsShownFor(sheet, name, v) : [];
            return (
              <div key={v} className="space-y-1 rounded-lg bg-white px-2 py-1.5 ring-1 ring-border">
                <div className="text-[11.5px] font-bold text-ink">{valueText(v)}</div>
                <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
                  <span className="text-ink3">보이는 행:</span>
                  {groups.length === 0 && <span className="text-ink3">(따로 없음)</span>}
                  {groups.map((g) => (
                    <span key={g.r1} className="flex items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 font-semibold text-indigo-700">
                      {rowsText(g)}
                      <button type="button" title="이 값에서 빼기" onClick={() => name && onChange(removeRowsFor(sheet, g.r1, g.r2, name, v))} className="hover:text-rose-600">
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => onPick({ kind: 'rows', value: v })}
                    className={`rounded border px-1.5 py-0.5 font-semibold ${pick?.kind === 'rows' && pick.value === v ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50'}`}
                  >
                    + 행 고르기
                  </button>
                </div>
                {deps.map((d) => {
                  const key = `${d.r}:${d.c}:${v}`;
                  return (
                    <label key={key} className="flex items-center gap-1.5 text-[10.5px]">
                      <span className="w-[64px] shrink-0 truncate text-ink3" title={`${d.label} 고를 항목(쉼표로)`}>
                        {d.label} 항목
                      </span>
                      <input
                        className={inp}
                        value={drafts[key] ?? branchText(d, v)}
                        placeholder="(이 값이면 칸 안 씀)"
                        onChange={(e) => setDrafts((x) => ({ ...x, [key]: e.target.value }))}
                        onBlur={(e) => commitBranch(d, v, key, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            );
          })}
          {canDepend && (
            <button
              type="button"
              onClick={() => onPick({ kind: 'dependent' })}
              className={`w-full rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${pick?.kind === 'dependent' ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50'}`}
            >
              + 값에 따라 고를 항목이 바뀌는 칸 고르기
            </button>
          )}
        </div>
      )}
      {/* 이름이 아직 없으면 처음 고를 때 지어 붙인다 — 안내만 */}
      {!name && <div className="text-[10px] text-ink3">처음 설정하면 이 칸에 칸 이름 '{ensureSourceName(sheet, source.r, source.c).name}'이(가) 붙습니다.</div>}
    </div>
  );
}
