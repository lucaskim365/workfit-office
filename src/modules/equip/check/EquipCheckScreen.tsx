import { Fragment, useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '@/modules/prod/_bits';
import { useEquipCheckItems } from '@/features/equipCheckItem/useEquipCheckItems';
import type { CheckItemRow } from '@/domain/equipCheckItem/schema';
import { EQ_LIST } from '../_data';

const kindTone = (k: string): Tone => (k === '일상' ? 'info' : 'ok');
const cycleTone = (c: string): Tone => (c === '1일' ? 'info' : c === '1주' ? 'ok' : c === '1개월' ? 'mute' : 'warn');

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-[10px] border border-border bg-panel px-3.5 py-3">
      <span className="text-[10.5px] font-semibold text-ink3">{label}</span>
      <span className={`text-[22px] font-extrabold leading-none tabular-nums ${color}`}>{value}<span className="ml-0.5 text-[11px] font-semibold text-ink3">건</span></span>
    </div>
  );
}

/** 설비별 점검 항목 — 와이어프레임 equip-check.jsx 정본. */
export default function EquipCheckScreen() {
  const { data: docs = [], isLoading } = useEquipCheckItems();
  const [sel, setSel] = useState('EQ-CMP02');
  const [pick, setPick] = useState(0);

  // 설비 유형(type) 도큐먼트 배열 → 유형별 점검항목 맵으로 파생(인라인 CHECK_ITEMS 대체).
  const byType = useMemo(() => {
    const m: Record<string, CheckItemRow[]> = {};
    docs.forEach((d) => { m[d.type] = d.items; });
    return m;
  }, [docs]);

  const eq = EQ_LIST.find((e) => e.code === sel) ?? EQ_LIST[0];
  const items = byType[eq.type] ?? [];
  const item = items[pick] ?? items[0];

  const groups = useMemo(() => {
    const g: Array<{ area: string; rows: Array<{ item: CheckItemRow; idx: number }> }> = [];
    items.forEach((x, idx) => {
      let grp = g.find((y) => y.area === x.area);
      if (!grp) { grp = { area: x.area, rows: [] }; g.push(grp); }
      grp.rows.push({ item: x, idx });
    });
    return g;
  }, [items]);

  const daily = items.filter((i) => i.kind === '일상').length;
  const weekly = items.filter((i) => i.cycle === '1주').length;
  const monthly = items.filter((i) => i.cycle === '1개월').length;

  if (!docs.length) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '점검 항목이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비별 점검 항목</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 기준정보 관리 / 설비별 점검 항목</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '항목 추가' }, 'save', { preset: 'delete' }, 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="라인"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="설비 유형"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="점검 유형"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="점검 항목 / 부위" width={170} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[260px_1fr]">
        <Card title="설비 목록" action={<span className="text-[10.5px] text-ink3">{EQ_LIST.length}대</span>} bodyClassName="p-0">
          <div className="flex max-h-[600px] flex-col gap-px overflow-y-auto p-1.5">
            {EQ_LIST.map((e) => {
              const on = e.code === sel;
              const n = (byType[e.type] ?? []).length;
              return (
                <button key={e.code} onClick={() => { setSel(e.code); setPick(0); }} className={`flex w-full items-center gap-2.5 rounded-r-[7px] px-2.5 py-2 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${e.state === '가동' ? 'bg-ok' : e.state === '대기' ? 'bg-blue' : e.state === '정지' ? 'bg-amber' : 'bg-danger'}`} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{e.name}</span>
                    <span className="text-[9.5px] text-ink3">{e.line} · {e.type}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold ${on ? 'bg-panel text-teal' : 'bg-panel-alt text-ink3'}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <div className="flex gap-2.5">
            <Stat label="총 점검 항목" value={items.length} color="text-ink" />
            <Stat label="일상 점검" value={daily} color="text-blue" />
            <Stat label="주간 점검" value={weekly} color="text-teal" />
            <Stat label="월간 점검" value={monthly} color="text-amber" />
          </div>

          <Card title={`${eq.name} · 점검 항목`} action={<span className="text-[10.5px] text-ink3">점검부위 {groups.length} · 항목 {items.length}</span>} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {['No', '점검 항목', '유형', '주기', '방법', '합격 기준', '사용'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 || (i >= 2 && i <= 4) || i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.area}>
                      <tr>
                        <td colSpan={7} className="bg-navy px-3 py-1.5 text-[11px] font-bold text-white"><span className="text-[#8fb3ff]">▣ </span>{g.area} <span className="font-medium opacity-60">· {g.rows.length}개 항목</span></td>
                      </tr>
                      {g.rows.map(({ item: x, idx }) => {
                        const on = idx === pick;
                        return (
                          <tr key={idx} onClick={() => setPick(idx)} className={`cursor-pointer ${on ? 'bg-teal-soft' : idx % 2 ? 'bg-panel-alt' : 'bg-panel'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                            <td className="border-b border-border px-3 py-2.5 text-center text-ink3">{idx + 1}</td>
                            <td className={`border-b border-border px-3 py-2.5 font-bold ${on ? 'text-teal' : 'text-ink'}`}>{x.name}</td>
                            <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={kindTone(x.kind)}>{x.kind}</Pill></td>
                            <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={cycleTone(x.cycle)}>{x.cycle}</Pill></td>
                            <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{x.method}</td>
                            <td className="border-b border-border px-3 py-2.5 text-ink">{x.pass}</td>
                            <td className="border-b border-border px-3 py-2.5 text-center"><span className="inline-block h-2 w-2 rounded-full bg-ok" /></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {item && (
            <Card title="판정 기준 상세" action={<ActionButton icon="save" label="기준 저장" variant="primary" />}>
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <span className="text-[14px] font-extrabold text-ink">{item.name}</span>
                  <Pill tone={kindTone(item.kind)}>{item.kind}</Pill>
                  <Pill tone={cycleTone(item.cycle)}>{item.cycle} 주기</Pill>
                  <span className="ml-auto text-[11px] text-ink3">점검 부위 · {item.area}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {([['기준값', item.std || '—', item.unit !== '-' ? item.unit : ''], ['하한(LSL)', item.lo || '—', item.lo && item.unit !== '-' ? item.unit : ''], ['상한(USL)', item.hi || '—', item.hi && item.unit !== '-' ? item.unit : ''], ['점검 방법', item.method, '']] as const).map(([k, v, u]) => (
                    <div key={k} className="flex flex-col gap-1.5 rounded-[9px] border border-border bg-panel-alt px-3.5 py-3">
                      <span className="text-[10.5px] font-semibold text-ink3">{k}</span>
                      <span className="text-base font-extrabold tabular-nums text-ink">{v}{u && <span className="ml-0.5 text-[10.5px] font-semibold text-ink3">{u}</span>}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5 rounded-[9px] border border-ok/30 bg-[#eafaf5] px-4 py-3.5">
                    <span className="text-[11px] font-bold text-ok">✓ 합격(OK) 조건</span>
                    <span className="text-[13px] font-bold text-ink">{item.pass}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-[9px] border border-border bg-[#fdf1f0] px-4 py-3.5">
                    <span className="text-[11px] font-bold text-danger">✕ 불합격(NG) 시 조치</span>
                    <span className="text-[13px] font-bold text-ink">{item.action}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
