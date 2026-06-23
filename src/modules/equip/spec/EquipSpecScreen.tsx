import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '@/modules/prod/_bits';

interface TypeItem { type: string; name: string; desc: string; items: number; eq: number }
const TYPES: TypeItem[] = [
  { type: 'CMP', name: 'CMP', desc: '연마', items: 8, eq: 3 },
  { type: 'Etch', name: 'Etch', desc: '식각', items: 7, eq: 4 },
  { type: 'Photo', name: 'Photo', desc: '노광', items: 9, eq: 5 },
  { type: 'Depo', name: 'Depo', desc: '증착', items: 8, eq: 3 },
  { type: 'Implant', name: 'Implant', desc: '이온주입', items: 7, eq: 2 },
  { type: 'Thermal', name: 'Thermal', desc: '열처리', items: 6, eq: 3 },
  { type: 'Clean', name: 'Clean', desc: '세정', items: 6, eq: 4 },
];

type Def = [string, string, string, string, string, string, boolean];
const SPEC_DEF: Record<string, Def[]> = {
  CMP: [['처리 능력', '수치', 'WPH', '120', '100', '140', true], ['연마 헤드 수', '수치', 'EA', '4', '4', '4', true], ['연마 압력', '수치', 'psi', '5.0', '3.0', '7.0', true], ['플래튼 회전수', '수치', 'rpm', '93', '60', '120', true], ['슬러리 유량', '수치', 'mL/min', '200', '150', '250', true], ['소비 전력', '수치', 'kW', '32', '—', '40', true], ['CDA 사용량', '수치', 'L/min', '850', '—', '1,000', false], ['장비 중량', '수치', 'kg', '4,200', '—', '—', false]],
  Etch: [['처리 능력', '수치', 'WPH', '90', '75', '110', true], ['챔버 수', '수치', 'EA', '2', '2', '2', true], ['RF 출력', '수치', 'W', '3,000', '2,500', '3,500', true], ['공정 압력', '수치', 'mTorr', '50', '30', '80', true], ['진공도', '수치', 'Torr', '5×10⁻³', '—', '1×10⁻²', true], ['소비 전력', '수치', 'kW', '45', '—', '55', true], ['장비 중량', '수치', 'kg', '5,100', '—', '—', false]],
  Photo: [['처리 능력', '수치', 'WPH', '180', '150', '200', true], ['해상도', '수치', 'nm', '38', '—', '45', true], ['오버레이', '수치', 'nm', '2.0', '—', '3.0', true], ['광원 파장', '선택', 'nm', '193', '—', '—', true], ['NA(개구수)', '수치', '-', '1.35', '1.20', '1.40', true], ['스테이지 정밀도', '수치', 'nm', '2', '—', '5', true], ['소비 전력', '수치', 'kW', '60', '—', '70', true], ['환경 온도', '수치', '℃', '23', '22.9', '23.1', true], ['장비 중량', '수치', 'kg', '12,000', '—', '—', false]],
  Depo: [['처리 능력', '수치', 'WPH', '110', '90', '130', true], ['챔버 수', '수치', 'EA', '4', '4', '4', true], ['공정 온도', '수치', '℃', '400', '350', '450', true], ['가스 라인', '수치', 'EA', '8', '6', '10', false], ['공정 압력', '수치', 'Torr', '2.5', '1.0', '5.0', true], ['소비 전력', '수치', 'kW', '38', '—', '48', true], ['두께 균일도', '수치', '%', '±1.5', '—', '±3.0', true], ['장비 중량', '수치', 'kg', '6,300', '—', '—', false]],
  Implant: [['처리 능력', '수치', 'WPH', '200', '160', '230', true], ['빔 전류', '수치', 'mA', '25', '10', '30', true], ['가속 전압', '수치', 'keV', '900', '5', '900', true], ['진공도', '수치', 'Torr', '1×10⁻⁶', '—', '5×10⁻⁶', true], ['도즈 균일도', '수치', '%', '±0.5', '—', '±1.0', true], ['소비 전력', '수치', 'kW', '52', '—', '62', true], ['장비 중량', '수치', 'kg', '9,800', '—', '—', false]],
  Thermal: [['처리 능력', '수치', 'WPH', '150', '120', '170', true], ['튜브 수', '수치', 'EA', '1', '1', '1', true], ['최대 온도', '수치', '℃', '1,200', '1,000', '1,250', true], ['승온 속도', '수치', '℃/min', '50', '30', '60', true], ['온도 균일도', '수치', '℃', '±2', '—', '±3', true], ['소비 전력', '수치', 'kW', '28', '—', '35', true]],
  Clean: [['처리 능력', '수치', 'WPH', '160', '130', '190', true], ['배스 수', '수치', 'EA', '6', '6', '6', true], ['DI수 사용량', '수치', 'L/min', '1,200', '900', '1,400', true], ['DI수 비저항', '수치', 'MΩ·cm', '18', '18', '—', true], ['배스 온도', '수치', '℃', '65', '60', '70', true], ['소비 전력', '수치', 'kW', '18', '—', '24', false]],
};

interface Meas { eq: string; name: string; vals: string[]; state: '표준' | '주의' | '이탈'; flag: number[] }
const MEAS: Record<string, Meas[]> = {
  CMP: [{ eq: 'EQ-CMP01', name: 'CMP 01호기', vals: ['118', '4', '5.0', '93'], state: '표준', flag: [] }, { eq: 'EQ-CMP02', name: 'CMP 02호기', vals: ['120', '4', '5.2', '95'], state: '표준', flag: [] }, { eq: 'EQ-CMP03', name: 'CMP 03호기', vals: ['96', '4', '7.4', '93'], state: '이탈', flag: [0, 2] }],
  Etch: [{ eq: 'EQ-ETCH01', name: 'Etch 01호기', vals: ['92', '2', '3,000', '50'], state: '표준', flag: [] }, { eq: 'EQ-ETCH02', name: 'Etch 02호기', vals: ['88', '2', '2,950', '54'], state: '표준', flag: [] }, { eq: 'EQ-ETCH03', name: 'Etch 03호기', vals: ['90', '2', '3,600', '78'], state: '주의', flag: [2] }, { eq: 'EQ-ETCH04', name: 'Etch 04호기', vals: ['74', '2', '3,100', '52'], state: '이탈', flag: [0] }],
  Photo: [{ eq: 'EQ-PHO01', name: 'Photo 01호기', vals: ['182', '38', '2.0', '193'], state: '표준', flag: [] }, { eq: 'EQ-PHO02', name: 'Photo 02호기', vals: ['178', '40', '2.4', '193'], state: '표준', flag: [] }, { eq: 'EQ-PHO03', name: 'Photo 03호기', vals: ['180', '42', '3.2', '193'], state: '주의', flag: [2] }, { eq: 'EQ-PHO04', name: 'Photo 04호기', vals: ['175', '38', '2.1', '193'], state: '표준', flag: [] }, { eq: 'EQ-PHO05', name: 'Photo 05호기', vals: ['184', '39', '2.0', '193'], state: '표준', flag: [] }],
  Depo: [{ eq: 'EQ-DEP01', name: 'Depo 01호기', vals: ['112', '4', '400', '8'], state: '표준', flag: [] }, { eq: 'EQ-DEP02', name: 'Depo 02호기', vals: ['108', '4', '460', '8'], state: '이탈', flag: [2] }, { eq: 'EQ-DEP03', name: 'Depo 03호기', vals: ['110', '4', '405', '8'], state: '표준', flag: [] }],
  Implant: [{ eq: 'EQ-IMP01', name: 'Implant 01호기', vals: ['205', '25', '900', '1×10⁻⁶'], state: '표준', flag: [] }, { eq: 'EQ-IMP02', name: 'Implant 02호기', vals: ['198', '24', '900', '3×10⁻⁶'], state: '표준', flag: [] }],
  Thermal: [{ eq: 'EQ-OVEN01', name: 'Thermal 01호기', vals: ['152', '1', '1,200', '50'], state: '표준', flag: [] }, { eq: 'EQ-OVEN03', name: 'Thermal 03호기', vals: ['148', '1', '1,180', '48'], state: '표준', flag: [] }, { eq: 'EQ-OVEN05', name: 'Thermal 05호기', vals: ['118', '1', '1,260', '50'], state: '이탈', flag: [0, 2] }],
  Clean: [{ eq: 'EQ-CLN01', name: 'Clean 01호기', vals: ['162', '6', '1,200', '18.2'], state: '표준', flag: [] }, { eq: 'EQ-CLN02', name: 'Clean 02호기', vals: ['158', '6', '1,180', '18.0'], state: '표준', flag: [] }, { eq: 'EQ-CLN03', name: 'Clean 03호기', vals: ['160', '6', '1,420', '18.1'], state: '주의', flag: [2] }, { eq: 'EQ-CLN04', name: 'Clean 04호기', vals: ['155', '6', '1,210', '17.4'], state: '이탈', flag: [3] }],
};

const measTone = (s: string): Tone => (s === '표준' ? 'ok' : s === '주의' ? 'warn' : 'err');
const dtypeTone = (t: string): Tone => (t === '수치' ? 'info' : 'mute');

/** 설비 스펙·제원 관리 — 와이어프레임 equip-spec.jsx 정본. */
export default function EquipSpecScreen() {
  const [sel, setSel] = useState('CMP');
  const def = SPEC_DEF[sel] ?? [];
  const meas = MEAS[sel] ?? [];
  const cur = TYPES.find((t) => t.type === sel) ?? TYPES[0];
  const matrixItems = def.slice(0, 4);
  const outCnt = meas.filter((m) => m.state === '이탈').length;
  const warnCnt = meas.filter((m) => m.state === '주의').length;

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
