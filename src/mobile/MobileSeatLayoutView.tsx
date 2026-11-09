import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import type { User } from '@/domain/user/schema';
import { seatPersonMatches } from '@/domain/seatLayout/engine';
import { useSeatLayouts } from '@/features/seatLayout/useSeatLayouts';
import { useAllUserPresences } from '@/features/userPresence/useUserPresence';
import { SeatBlockBox, SeatStatusCounts, UNIT_H, UNIT_W, ZOOM_STEPS } from '@/modules/gw/orgchart/SeatLayoutView';

/** 처음 배율 — 휴대폰에서 이름이 읽히는 크기. 배치도가 화면보다 넓으면 손가락으로 밀어서 본다 */
const DEFAULT_ZOOM = 75;
const noop = () => undefined;

/** 조직도 > 좌석배치도(앱) — 보기 전용. 찾기·확대·자리 누르면 프로필, 배치 편집은 웹에서 한다. */
export default function MobileSeatLayoutView({
  users,
  onSelectUserId,
}: {
  users: User[];
  onSelectUserId: (id: string) => void;
}) {
  const { data: layouts = [], isLoading } = useSeatLayouts();
  const presences = useAllUserPresences();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const areaRef = useRef<HTMLDivElement>(null);

  const active = layouts.find((l) => l.id === activeId) ?? layouts[0] ?? null;
  const grid = active?.grid ?? null;
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const kw = keyword.trim().toLowerCase();
  const uw = (UNIT_W * zoom) / 100;
  const uh = (UNIT_H * zoom) / 100;

  // 찾은 사람의 자리가 화면 가운데 오도록 옮긴다 — 배치도가 화면보다 넓어 강조만으로는 안 보일 수 있다
  useEffect(() => {
    const area = areaRef.current;
    if (!area || !kw || !grid) return;
    const hit = grid.blocks.find((b) => {
      const person = b.userId ? userMap.get(b.userId) : undefined;
      return person && seatPersonMatches(person, kw);
    });
    if (!hit) return;
    area.scrollTo({
      left: hit.col * uw - (area.clientWidth - hit.colSpan * uw) / 2,
      top: hit.row * uh - (area.clientHeight - hit.rowSpan * uh) / 2,
      behavior: 'smooth',
    });
  }, [kw, grid, userMap, uw, uh]);

  const stepZoom = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom) : [...ZOOM_STEPS].reverse().find((z) => z < zoom);
    if (next) setZoom(next);
  };

  if (isLoading) {
    return <div className="grid h-60 place-items-center text-[12px] font-semibold text-ink3">좌석배치도를 불러오는 중…</div>;
  }
  if (!active || !grid) {
    return <div className="grid h-60 place-items-center text-[12px] text-ink3">등록된 좌석배치도가 없습니다.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border/70 bg-white px-3 py-2">
        {layouts.length > 1 && (
          <div className="flex gap-1 overflow-x-auto">
            {layouts.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveId(l.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold ${l.id === active.id ? 'bg-teal text-white' : 'bg-slate-100 text-ink3'}`}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="이름·부서 찾기"
              className="h-9 w-full rounded-lg border border-border-hi bg-white pl-8 pr-2 text-[13px] text-ink outline-none focus:border-teal"
            />
          </label>
          <div className="flex shrink-0 items-center rounded-lg border border-border">
            <button type="button" aria-label="축소" onClick={() => stepZoom(-1)} className="grid h-9 w-8 place-items-center text-ink3"><Minus size={14} /></button>
            <span className="min-w-[38px] text-center text-[11px] font-bold text-ink2">{zoom}%</span>
            <button type="button" aria-label="확대" onClick={() => stepZoom(1)} className="grid h-9 w-8 place-items-center text-ink3"><Plus size={14} /></button>
          </div>
        </div>
        <SeatStatusCounts blocks={grid.blocks} userMap={userMap} presences={presences} className="flex flex-wrap items-center gap-2.5 text-[10.5px] font-semibold text-ink3" />
      </div>

      <div ref={areaRef} className="min-h-0 flex-1 overflow-auto bg-white p-3">
        <div className="relative select-none" style={{ width: grid.cols * uw + 1, height: grid.rows * uh + 1 }}>
          {grid.blocks.map((b) => {
            const person = b.userId ? userMap.get(b.userId) : undefined;
            const found = Boolean(kw && person && seatPersonMatches(person, kw));
            return (
              <SeatBlockBox
                key={b.id}
                block={b}
                rect={b}
                uw={uw}
                uh={uh}
                zoom={zoom}
                user={person}
                status={person ? presences[person.id]?.status ?? 'OFFLINE' : null}
                message={person ? presences[person.id]?.message ?? '' : ''}
                editing={false}
                selected={false}
                invalid={false}
                dimmed={Boolean(kw) && !found}
                highlighted={found}
                onPointerDown={noop}
                onResizePointerDown={noop}
                onOpenProfile={() => person && onSelectUserId(person.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
