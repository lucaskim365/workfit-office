import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, Bar } from '../_mat';

const ZONES = [
  { z: 'A', name: '원자재 창고', racks: 24, use: 86, c: C.teal },
  { z: 'B', name: '격리 구역', racks: 8, use: 42, c: C.warn },
  { z: 'C', name: '반제품 창고', racks: 16, use: 71, c: C.blue },
  { z: 'D', name: '완제품 창고', racks: 20, use: 64, c: C.navy },
];
const LEVELS: [string, string][] = [['만재', C.teal], ['일부', C.warn], ['공위', '#fff']];

/** 창고 위치 관리 — 와이어프레임 wms-screens.jsx 정본. */
export default function MatLocationScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="창고 위치 관리" sub="창고 위치 관리 (Location/Rack Control)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="창고 레이아웃 (Zone / Rack 맵)" action={<span className="text-[10.5px] text-ink3">A-Zone 상세</span>}>
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 24 }).map((_, i) => {
              const lvl = [0, 0, 1, 2, 0, 1][(i * 5) % 6];
              const map = [['만재', C.teal], ['일부', C.warn], ['공위', C.bgDeep]][lvl];
              const r = String.fromCharCode(65 + Math.floor(i / 6));
              return (
                <div key={i} className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[7px]" style={{ background: lvl === 2 ? '#fff' : map[1] + (lvl === 0 ? '' : '33'), border: `1px solid ${lvl === 2 ? C.borderHi : map[1]}` }}>
                  <span className="font-mono text-[10px] font-extrabold" style={{ color: lvl === 0 ? '#fff' : C.ink2 }}>{r}-{(i % 6) + 1}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3.5 flex gap-4">
            {LEVELS.map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2"><span className="h-3 w-3 rounded-[3px]" style={{ background: c, border: c === '#fff' ? `1px solid ${C.borderHi}` : 'none' }} />{l}</span>
            ))}
          </div>
        </Card>
        <Card title="구역(Zone)별 현황" bodyClassName="p-0">
          {ZONES.map((z, i) => (
            <div key={z.z} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: i < ZONES.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span className="grid h-9 w-9 place-items-center rounded-[9px] text-[15px] font-extrabold" style={{ background: z.c + '1a', color: z.c }}>{z.z}</span>
              <div className="min-w-0 flex-1"><div className="text-[12px] font-bold text-ink">{z.name}</div><div className="text-[10.5px] text-ink3">{z.racks} Racks</div></div>
              <div className="w-[90px]"><Bar v={z.use} color={z.c} /></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
