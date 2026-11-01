import { useMemo, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, ChevronRight, GripVertical, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  loadGroupwareOrder,
  mergeOrder,
  moveItem,
  saveGroupwareOrder,
  type GroupwareViewMode,
} from './groupwarePrefs';

export interface GroupwareMenuItem {
  id: string;
  name: string;
  desc: string;
  path: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** 격자에서 강조하는 핵심 메뉴 */
  accent?: boolean;
  /** 준비 중 — 눌러도 열리지 않는다 */
  disabled?: boolean;
  badge?: string;
}

/** 끌고 있는 손가락이 목록 위아래 끝에 이만큼 가까워지면 자동으로 스크롤한다 */
const AUTO_SCROLL_EDGE = 56;
const AUTO_SCROLL_STEP = 12;

/** 그룹웨어 메뉴 — 리스트/격자 보기, 배치 편집(손잡이를 끌어 순서 변경). 순서는 [완료]를 누를 때 저장한다. */
export default function GroupwareMenu({
  userId,
  items,
  mode,
  onOpen,
}: {
  userId: string;
  items: GroupwareMenuItem[];
  mode: GroupwareViewMode;
  onOpen: (item: GroupwareMenuItem) => void;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const [savedOrder, setSavedOrder] = useState<string[] | null>(() => loadGroupwareOrder(userId));
  const order = useMemo(() => mergeOrder(savedOrder, ids), [savedOrder, ids]);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const finishEditing = () => {
    saveGroupwareOrder(userId, order);
    setEditing(false);
  };

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(id);
    setOverId(id);
  };

  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragId) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-gw-item]');
    if (over?.dataset.gwItem) setOverId(over.dataset.gwItem);
    const box = scrollRef.current?.getBoundingClientRect();
    if (!box) return;
    if (e.clientY < box.top + AUTO_SCROLL_EDGE) scrollRef.current?.scrollBy(0, -AUTO_SCROLL_STEP);
    else if (e.clientY > box.bottom - AUTO_SCROLL_EDGE) scrollRef.current?.scrollBy(0, AUTO_SCROLL_STEP);
  };

  const endDrag = () => {
    if (dragId && overId) setSavedOrder(moveItem(order, dragId, overId));
    setDragId(null);
    setOverId(null);
  };

  const handle = (id: string, placement: string) => (
    <button
      type="button"
      aria-label="끌어서 순서 변경"
      title="끌어서 순서 변경"
      onPointerDown={(e) => startDrag(e, id)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ touchAction: 'none' }}
      className={`absolute z-[1] grid h-9 w-8 cursor-grab place-items-center rounded-lg text-[#8ca0ba] active:bg-[#edf3ff] active:text-[#2563bd] ${placement}`}
    >
      <GripVertical size={18} strokeWidth={2} />
    </button>
  );

  const editLook = (id: string) => {
    if (dragId === id) return 'opacity-50';
    if (dragId && overId === id) return 'border-[#6498e6] bg-[#ecf5ff]';
    return '';
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain px-3 pb-6 pt-4 select-none">
      <div className="mb-3 flex min-h-[38px] items-center justify-between px-0.5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">그룹웨어</h1>
        <button
          type="button"
          onClick={() => (editing ? finishEditing() : setEditing(true))}
          aria-pressed={editing}
          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold ${editing ? 'bg-[#e7f0ff] text-[#2757aa]' : 'text-[#576b8d] active:bg-[#e3edf9]'}`}
        >
          <SlidersHorizontal size={15} strokeWidth={1.9} />
          배치 편집
        </button>
      </div>

      {editing && (
        <div className="mb-3.5 flex items-center gap-1.5 rounded-xl border border-[#e4edeb] bg-[#f3fbf6] px-2.5 py-2">
          <span className="mr-auto text-[10.5px] text-[#71839e]">손잡이를 끌어 순서 변경</span>
          <button
            type="button"
            onClick={() => setSavedOrder(null)}
            className="inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#dae4f3] bg-white px-2.5 text-[12px] font-bold text-[#52637f]"
          >
            <RotateCcw size={14} strokeWidth={1.9} />
            초기화
          </button>
          <button
            type="button"
            onClick={finishEditing}
            className="inline-flex min-h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#93b9ff] bg-[#93b9ff] px-2.5 text-[12px] font-bold text-[#0c367d]"
          >
            <Check size={14} strokeWidth={2.2} />
            완료
          </button>
        </div>
      )}

      <div className={mode === 'grid' ? 'grid grid-cols-3 gap-3' : 'flex flex-col gap-2'}>
        {order.map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          const Icon = item.icon;
          const dimmed = item.disabled ? 'opacity-45' : '';
          const blocked = editing || item.disabled;

          if (mode === 'grid') {
            return (
              <div key={id} data-gw-item={id} className={`relative ${editing ? editLook(id) : ''}`}>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => onOpen(item)}
                  className={`flex h-[120px] w-full flex-col overflow-hidden rounded-[20px] border text-left shadow-[0_3px_14px_#2439550c] active:scale-[0.97] disabled:active:scale-100 ${dimmed} ${
                    item.accent ? 'border-[#c7eadb] bg-gradient-to-br from-[#d7f7e8] to-[#f3fff9]' : 'border-[#edf0f2] bg-white'
                  } ${editing ? 'border-dashed border-[#acc5e6]' : ''}`}
                >
                  <span className={`flex min-h-[33px] items-start justify-between gap-1 px-2.5 pb-1 pt-2.5 text-[12px] font-extrabold tracking-tight text-ink ${item.accent ? 'bg-[#b8f0d7]' : ''}`}>
                    <span className="truncate">{item.name}</span>
                    {item.disabled && <span className="shrink-0 rounded-full bg-[#e7eaf0] px-1.5 py-0.5 text-[9px] font-semibold text-[#798390]">준비중</span>}
                  </span>
                  <span className="relative grid flex-1 place-items-center text-[#1b2840]">
                    {item.badge && <span className="absolute right-2 top-1 rounded-full bg-[#fb7488] px-1.5 py-0.5 text-[9px] font-bold text-white">{item.badge}</span>}
                    <Icon size={29} strokeWidth={1.9} />
                  </span>
                </button>
                {editing && handle(id, 'bottom-1 right-1')}
              </div>
            );
          }

          return (
            <div key={id} data-gw-item={id} className={`relative ${editing ? editLook(id) : ''}`}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => onOpen(item)}
                className={`flex min-h-[73px] w-full items-center gap-3.5 rounded-[18px] border bg-white px-3 py-2.5 text-left shadow-[0_4px_15px_#283c4c0b] active:scale-[0.98] disabled:active:scale-100 ${dimmed} ${
                  editing ? 'border-dashed border-[#acc5e6]' : 'border-transparent'
                }`}
              >
                <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[17px] bg-[#e9f9f2] text-[#18b678]">
                  <Icon size={27} strokeWidth={2} />
                </span>
                <span className={`min-w-0 flex-1 ${editing ? 'pr-7' : ''}`}>
                  <span className="flex items-center gap-1.5">
                    <b className="truncate text-[15px] text-[#10192e]">{item.name}{item.disabled ? ' · 준비중' : ''}</b>
                    {item.badge && <span className="shrink-0 rounded-full bg-[#fb7488] px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-[#79879c]">{item.desc}</span>
                </span>
                {!editing && !item.disabled && <ChevronRight size={20} className="shrink-0 text-[#8190a6]" />}
              </button>
              {editing && handle(id, 'right-1.5 top-1/2 -translate-y-1/2')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
