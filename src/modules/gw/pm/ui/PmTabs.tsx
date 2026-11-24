/**
 * 화면 탭 · 보기 전환 — 데모의 "하위 탭 카드"와 "보기 버튼"을 그룹웨어 토큰으로.
 * 공용 부품에 같은 모양이 없어 PM 전용으로 둔다 (`shared/ui` 는 고치지 않음).
 */

export interface PmTabItem {
  id: string;
  label: string;
}

/** 화면 탭 — 밑줄형. 선택된 탭은 teal 글자 + 밑줄. */
export function PmScreenTabs({ items, activeId, onSelect }: {
  items: PmTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-border px-2">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.id)}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-[12.5px] font-bold transition-colors ${
              active ? 'border-teal text-navy' : 'border-transparent text-ink3 hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** 보기 전환 — 붙어 있는 버튼 묶음(세그먼트). 업무계획의 주간/월간 전환과 같은 모양. */
export function PmViewSwitch({ items, activeId, onSelect }: {
  items: PmTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border-hi bg-panel">
      {items.map((item, i) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(item.id)}
            className={`px-3 py-1.5 text-[11.5px] font-bold transition-colors ${i > 0 ? 'border-l border-border-hi' : ''} ${
              active ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
