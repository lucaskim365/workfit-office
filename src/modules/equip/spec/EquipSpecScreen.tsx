import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '@/modules/prod/_bits';
import { useEquipmentSpecs } from '@/features/equipmentSpec/useEquipmentSpecs';

const measTone = (s: string): Tone => (s === '표준' ? 'ok' : s === '주의' ? 'warn' : 'err');
const dtypeTone = (t: string): Tone => (t === '수치' ? 'info' : 'mute');

/** 설비 스펙·제원 관리 — 와이어프레임 equip-spec.jsx 정본. */
export default function EquipSpecScreen() {
  const { data: specs = [], isLoading } = useEquipmentSpecs();
  const [sel, setSel] = useState('CMP');

  // 데이터 계층(type별 도큐먼트)에서 화면 파생값 계산.
  const TYPES = specs;
  const cur = specs.find((s) => s.type === sel) ?? specs[0];
  const def = cur?.defs ?? [];
  const meas = cur?.meas ?? [];
  const matrixItems = def.slice(0, 4);
  const outCnt = meas.filter((m) => m.state === '이탈').length;
  const warnCnt = meas.filter((m) => m.state === '주의').length;

  if (isLoading) return <div className="p-6 text-sm text-ink3">불러오는 중…</div>;
  if (!cur) return <div className="p-6 text-sm text-ink3">설비 제원 데이터가 없습니다.</div>;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비 스펙·제원 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 기준정보 관리 / 설비 스펙·제원 관리</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '항목 추가' }, 'save', 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="설비 유형"><ReadSelect value={cur.name} w={110} /></FilterField>
        <FilterField label="데이터 타입"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="필수여부"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="스펙 항목명" width={180} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[260px_1fr]">
        <Card title="설비 유형" action={<span className="text-[10.5px] text-ink3">{TYPES.length}종</span>} bodyClassName="p-0">
          {TYPES.map((t) => {
            const on = t.type === sel;
            return (
              <button key={t.type} onClick={() => setSel(t.type)} className={`flex w-full items-center gap-2.5 border-b border-border px-3.5 py-3 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg text-[13px] font-extrabold ${on ? 'bg-teal text-white' : 'bg-panel-alt text-ink2'}`}>{t.name[0]}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[12.5px] font-extrabold ${on ? 'text-teal' : 'text-ink'}`}>{t.name} <span className="text-[10.5px] font-medium text-ink3">· {t.desc}</span></span>
                  <span className="text-[10px] text-ink3">스펙 {t.items}항목 · 설비 {t.eq}대</span>
                </span>
              </button>
            );
          })}
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title={`스펙 항목 정의 — ${cur.name}`} action={<span className="flex items-center gap-2"><span className="text-[10.5px] text-ink3">{def.length}개 항목</span><ActionButton icon="plus" label="항목 추가" /></span>} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {['No', '스펙 항목', '데이터', '단위', '표준값', '허용 범위', '필수', '사용'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 4 ? 'text-right' : i === 1 ? 'text-left' : 'text-center'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {def.map((r, i) => (
                    <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5 text-center text-ink3">{i + 1}</td>
                      <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{r[0]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={dtypeTone(r[1])}>{r[1]}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-center font-mono text-ink2">{r[2]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-extrabold tabular-nums text-ink">{r[3]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center text-[11px] tabular-nums text-ink2">{r[4]} ~ {r[5]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center">{r[6] ? <span className="font-extrabold text-danger">●</span> : <span className="text-ink3">○</span>}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone="ok">사용</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="설비별 제원 현황" action={<span className="flex items-center gap-2">{outCnt > 0 && <Pill tone="err">이탈 {outCnt}</Pill>}{warnCnt > 0 && <Pill tone="warn">주의 {warnCnt}</Pill>}<span className="text-[10.5px] text-ink3">표준값 대비 비교</span></span>} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="w-[200px] border-b border-border bg-panel-alt px-3 py-2.5 text-left text-[10.5px] font-bold text-ink2">설비</th>
                    {matrixItems.map((it, i) => (
                      <th key={i} className="border-b border-border bg-panel-alt px-3 py-2.5 text-right text-[10.5px] font-bold text-ink2">
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{it[0]}</span>
                          <span className="text-[9.5px] font-medium text-ink3">표준 {it[3]} {it[2]}</span>
                        </div>
                      </th>
                    ))}
                    <th className="w-[76px] border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold text-ink2">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {meas.map((m, i) => (
                    <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-ink">{m.name}</span>
                          <span className="font-mono text-[9.5px] text-ink3">{m.eq}</span>
                        </div>
                      </td>
                      {m.vals.map((v, vi) => {
                        const bad = m.flag.includes(vi);
                        return (
                          <td key={vi} className={`border-b border-border px-3 py-2.5 text-right tabular-nums ${bad ? 'bg-danger/[0.06] font-extrabold text-danger' : 'font-bold text-ink'}`}>
                            {v}{bad && <span className="ml-0.5 text-[9px]">▲</span>}
                          </td>
                        );
                      })}
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={measTone(m.state)}>{m.state}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3.5 border-t border-border px-3.5 py-2.5 text-[10.5px] text-ink3">
              <span className="flex items-center gap-1.5"><span className="text-danger">▲</span> 허용 범위 이탈 항목</span>
              <span>· 표준값은 좌측 스펙 정의 기준 · 측정값은 최근 정기점검 기준</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
