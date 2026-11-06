import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { memoLines } from '@/domain/workPlan/memo';
import { WorkPlanInlineText } from '../WorkPlanInlineText';

/**
 * 메모 보기 — 줄마다 서식(굵게·기울임·취소선…)과 체크박스를 그린다.
 * `onToggle`이 있으면(내 메모) 체크박스를 눌러 바로 완료/해제한다. 누르기가 메모 고치기로 넘어가지 않게 막는다.
 */
export function WorkPlanMemoView({
  memo,
  onToggle,
  className = '',
  boxSize = 11,
}: {
  memo: string;
  onToggle?: (taskIndex: number) => void;
  className?: string;
  boxSize?: number;
}) {
  const lines = useMemo(() => memoLines(memo), [memo]);

  return (
    <div className={`break-words ${className}`}>
      {lines.map((line) => {
        const body = (
          <>
            {line.tag && <span className="font-semibold">[{line.tag}] </span>}
            <WorkPlanInlineText text={line.text} />
          </>
        );
        if (!line.task) return <div key={line.key}>{body}</div>;
        const { index, checked } = line.task;
        return (
          <div key={line.key} className="flex items-start gap-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={checked ? '완료 해제' : '완료'}
              disabled={!onToggle}
              onClick={(e) => {
                e.stopPropagation();
                onToggle?.(index);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className={`mt-[0.15em] grid shrink-0 place-items-center rounded-[3px] border ${
                checked ? 'border-teal bg-teal text-white' : 'border-ink3/60 bg-panel'
              } ${onToggle ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ width: boxSize, height: boxSize }}
            >
              {checked && <Check size={boxSize - 2} strokeWidth={3.5} />}
            </button>
            <span className={`min-w-0 flex-1 ${checked ? 'line-through opacity-60' : ''}`}>{body}</span>
          </div>
        );
      })}
    </div>
  );
}
