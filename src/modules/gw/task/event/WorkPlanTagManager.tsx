import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/form/TextField';
import { TAG_COLOR_PRESETS } from '@/features/workPlan/useWorkPlanConfig';
import { GENERAL_TAG_COLOR_IDS } from '@/shared/theme/statusColors';
import { useSaveWorkPlanTag, useWorkPlanTags } from '@/features/workPlan/useWorkPlanItems';
import {
  FIXED_WORK_PLAN_TAGS,
  sortGeneralTags,
  reorderGeneralTags,
  type WorkPlanTag,
} from '@/domain/workPlan/tag';

/** 일반 태그가 고를 수 있는 색 — 사람 상태 색(초록·노랑·파랑·남색·보라)은 뺀다 */
const GENERAL_TAG_PRESETS = TAG_COLOR_PRESETS.filter((preset) =>
  (GENERAL_TAG_COLOR_IDS as readonly string[]).includes(preset.id),
);

const dotClass = (colorId: string) =>
  TAG_COLOR_PRESETS.find((preset) => preset.id === colorId)?.dotColor ?? 'bg-slate-500';

function ColorSwatches({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (colorId: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {GENERAL_TAG_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={disabled}
          aria-label={preset.label}
          aria-pressed={value === preset.id}
          onClick={() => onChange(preset.id)}
          className={`h-4 w-4 rounded-full ${preset.dotColor} disabled:opacity-50 ${
            value === preset.id ? 'ring-2 ring-ink ring-offset-1 ring-offset-panel' : ''
          }`}
        />
      ))}
    </div>
  );
}

interface GeneralRowProps {
  tag: WorkPlanTag;
  index: number;
  count: number;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
  onRename: (tag: WorkPlanTag, name: string) => void;
  onColor: (tag: WorkPlanTag, colorId: string) => void;
  onHidden: (tag: WorkPlanTag) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

function GeneralRow({ tag, index, count, busy, error, onEdit, onRename, onColor, onHidden, onMove }: GeneralRowProps) {
  const [name, setName] = useState(tag.name);
  useEffect(() => setName(tag.name), [tag.name]);

  const commitName = () => {
    if (name.trim() === tag.name) {
      setName(tag.name);
      return;
    }
    onRename(tag, name);
  };

  return (
    <li className={`flex flex-col gap-1 py-2 ${tag.hidden ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(tag.colorId)}`} />
        <TextField
          value={name}
          maxLength={10}
          disabled={busy}
          invalid={!!error}
          aria-label="태그 이름"
          className="w-32"
          onChange={(e) => {
            setName(e.target.value);
            onEdit();
          }}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <ColorSwatches value={tag.colorId} disabled={busy} onChange={(colorId) => {
            onEdit();
            onColor(tag, colorId);
          }} />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="위로" disabled={busy || index === 0} onClick={() => onMove(index, 'up')}>
            <ChevronUp size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="아래로"
            disabled={busy || index === count - 1}
            onClick={() => onMove(index, 'down')}
          >
            <ChevronDown size={14} />
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => onHidden(tag)}>
            {tag.hidden ? '다시 보이기' : '숨기기'}
          </Button>
        </div>
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </li>
  );
}

/** 업무계획 태그 관리 — 고정 태그는 읽기 전용, 일반 태그는 이름·색·순서·숨김만 바꾼다(새 태그 추가 없음). 바꾸는 즉시 공용 목록에 저장한다. */
export function WorkPlanTagManager({ canEdit }: { canEdit: boolean }) {
  const { data: tags = [] } = useWorkPlanTags();
  const queryClient = useQueryClient();
  const save = useSaveWorkPlanTag();
  const busy = save.isPending;
  const sorted = sortGeneralTags(tags);

  const [rowError, setRowError] = useState<{ key: string; message: string } | null>(null);

  const run = async (key: string, task: () => Promise<unknown>): Promise<boolean> => {
    setRowError(null);
    try {
      await task();
      return true;
    } catch (error) {
      setRowError({ key, message: error instanceof Error ? error.message : '저장하지 못했습니다.' });
      return false;
    }
  };

  const draftOf = (tag: WorkPlanTag, over: Partial<WorkPlanTag> = {}) => ({
    name: tag.name,
    colorId: tag.colorId,
    order: tag.order,
    hidden: tag.hidden,
    ...over,
  });

  const rename = (tag: WorkPlanTag, name: string) =>
    void run(tag.id, () => save.mutateAsync({ id: tag.id, draft: draftOf(tag, { name: name.trim() }) }));
  const recolor = (tag: WorkPlanTag, colorId: string) =>
    void run(tag.id, () => save.mutateAsync({ id: tag.id, draft: draftOf(tag, { colorId }) }));
  const toggleHidden = (tag: WorkPlanTag) =>
    void run(tag.id, () => save.mutateAsync({ id: tag.id, draft: draftOf(tag, { hidden: !tag.hidden }) }));

  const move = (index: number, direction: 'up' | 'down') => {
    const changes = reorderGeneralTags(sorted, sorted[index].id, direction);
    if (!changes) return;
    void (async () => {
      const ok = await run(sorted[index].id, async () => {
        for (const { id, order } of changes) {
          const target = sorted.find((tag) => tag.id === id);
          if (target) await save.mutateAsync({ id, draft: draftOf(target, { order }) });
        }
      });
      // 일부만 저장됐을 수 있으니 서버 상태로 다시 맞춘다.
      if (!ok) await queryClient.invalidateQueries({ queryKey: ['workPlanTags'] });
    })();
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border">
        {FIXED_WORK_PLAN_TAGS.map((tag) => (
          <li key={tag.id} className="flex items-center gap-2 py-2">
            <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(tag.colorId)}`} />
            <span className="text-[13px] font-medium text-ink">{tag.name}</span>
            <span role="img" aria-label="고정" className="inline-flex">
              <Lock size={12} className="text-ink3" />
            </span>
          </li>
        ))}
      </ul>

      <ul className="flex flex-col divide-y divide-border">
        {sorted.map((tag, index) =>
          canEdit ? (
            <GeneralRow
              key={tag.id}
              tag={tag}
              index={index}
              count={sorted.length}
              busy={busy}
              error={rowError?.key === tag.id ? rowError.message : null}
              onEdit={() => setRowError(null)}
              onRename={rename}
              onColor={recolor}
              onHidden={toggleHidden}
              onMove={move}
            />
          ) : (
            <li key={tag.id} className={`flex items-center gap-2 py-2 ${tag.hidden ? 'opacity-50' : ''}`}>
              <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(tag.colorId)}`} />
              <span className="text-[13px] text-ink">{tag.name}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
