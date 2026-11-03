import { useEffect, useState } from 'react';
import { Settings, X, Check } from 'lucide-react';

export interface CompletedFormOption {
  code: string;
  name: string;
  /** 내 완료함에 있는 이 서식 문서 수 */
  count: number;
}

/** 완료함 아래에 둘 서식 고르기 — 체크한 순서대로 사이드바에 보인다. */
export function CompletedFormsSettingsModal({
  open,
  options,
  selected,
  onSave,
  onClose,
}: {
  open: boolean;
  options: CompletedFormOption[];
  selected: string[];
  onSave: (codes: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  useEffect(() => {
    if (open) setPicked(selected);
  }, [open, selected]);

  if (!open) return null;

  const toggle = (code: string) =>
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 animate-fadeIn" onClick={onClose}>
      <div
        className="flex max-h-[calc(80vh/var(--font-scale,1))] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2 text-[14px] font-extrabold text-ink">
            <Settings size={16} className="text-teal" />
            <span>완료함 서식 바로가기</span>
          </div>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-ink3 hover:bg-panel-alt transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="px-5 pt-3 text-[11.5px] text-ink3">완료함 아래에 둘 서식을 고르세요. 고른 순서대로 보입니다.</p>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {options.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-ink3">고를 수 있는 서식이 없습니다.</div>
          ) : (
            options.map((o) => {
              const on = picked.includes(o.code);
              return (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => toggle(o.code)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors ${on ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-teal bg-teal text-white' : 'border-border-hi'}`}>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {on && <span className="shrink-0 text-[10.5px] font-bold">{picked.indexOf(o.code) + 1}번째</span>}
                  <span className="shrink-0 text-[10.5px] text-ink3">{o.count}건</span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-panel-alt/20 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onSave(picked)}
            className="rounded-lg bg-teal px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 transition-colors cursor-pointer"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
