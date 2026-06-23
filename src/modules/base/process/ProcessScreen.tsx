import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterField } from '@/shared/ui/FilterBar';
import { DetailField } from '@/shared/ui/DetailField';

interface Proc {
  seq: string;
  code: string;
  name: string;
  type: '전처리' | '가공' | '검사' | '후처리';
  eq: string;
  tt: string;
  insp: string;
  materials: string;
  std: string;
}

const PROCS: Proc[] = [
  { seq: '10', code: 'OP-10', name: '입고/세정', type: '전처리', eq: 'CLEAN', tt: '12', insp: '무검사', materials: 'WF-300-B · DI-Water', std: '웨이퍼 표면 파티클 제거. 세정액 농도 2.5%, 수온 23±1℃ 유지.' },
  { seq: '20', code: 'OP-20', name: '포토(노광)', type: '가공', eq: 'PHO05', tt: '35', insp: '무검사', materials: 'RES-PR-22', std: '노광 정렬 오차 ±5nm 이내 관리.' },
  { seq: '30', code: 'OP-30', name: '식각(Etch)', type: '가공', eq: 'ETCH01', tt: '28', insp: '무검사', materials: 'Etch Gas', std: '식각 깊이 SPC 관리.' },
  { seq: '40', code: 'OP-40', name: '증착(Depo)', type: '가공', eq: 'DEP03', tt: '40', insp: '무검사', materials: 'Target Metal', std: '박막 두께 균일도 관리.' },
  { seq: '50', code: 'OP-50', name: 'CMP 연마', type: '가공', eq: 'CMP02', tt: '22', insp: '무검사', materials: 'CHM-SL-05', std: '연마 패드 교체 주기 점검.' },
  { seq: '60', code: 'OP-60', name: '검사(Inspection)', type: '검사', eq: 'INS-VIS', tt: '15', insp: '전수검사', materials: '–', std: '외관/치수 자동 비전 검사.' },
  { seq: '70', code: 'OP-70', name: '출하 포장', type: '후처리', eq: 'PACK', tt: '10', insp: '무검사', materials: 'Pkg Box', std: '진공 포장 및 라벨 부착.' },
];

const TYPE_TONE: Record<Proc['type'], Tone> = { 가공: 'info', 검사: 'warn', 전처리: 'ok', 후처리: 'mute' };
const totalTt = PROCS.reduce((s, p) => s + Number(p.tt), 0);

function FakeSelect({ label, value }: { label: string; value: string }) {
  return (
    <FilterField label={label}>
      <span className="inline-flex h-8 min-w-[120px] items-center justify-between gap-4 rounded-md border border-border-hi bg-panel px-3.5 text-[11.5px] font-semibold text-ink">
        {value} <span className="text-[8px] text-ink3">▾</span>
      </span>
    </FilterField>
  );
}

/** 공정등록 — 필터 + 공정 흐름도 + 마스터-디테일. 와이어프레임 admin-screens.ProcessRegContent 정본. */
export default function ProcessScreen() {
  const [selected, setSelected] = useState('OP-10');
  const cur = PROCS.find((p) => p.code === selected) ?? PROCS[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정등록</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 공정등록</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '공정 추가' }, 'save', 'upload', 'download']} />
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-panel p-3.5">
        <FakeSelect label="제품/공정 라우팅" value="RT-WF300-A" />
        <FakeSelect label="공정 구분" value="전체" />
        <FilterField label="검색">
          <span className="inline-flex h-8 w-[180px] items-center rounded-md border border-border-hi bg-panel px-3 text-[11.5px] text-ink3">공정코드 / 공정명</span>
        </FilterField>
        <span className="ml-auto">
          <ActionButton icon="search" label="조회" variant="primary" />
        </span>
      </div>

      {/* 공정 흐름도 */}
      <Card
        title={<span>공정 라우팅 (흐름) <span className="text-teal">· RT-WF300-A</span></span>}
        action={<span className="text-[10.5px] text-ink3">총 {PROCS.length}개 공정 · 표준 {totalTt}분</span>}
      >
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {PROCS.map((p, i) => {
            const on = p.code === selected;
            return (
              <Fragment key={p.code}>
                <button
                  onClick={() => setSelected(p.code)}
                  className={`w-24 flex-shrink-0 rounded-[10px] border-[1.5px] p-2.5 text-center transition-colors ${
                    on ? 'border-teal bg-teal-soft shadow-sm' : 'border-border bg-panel hover:bg-panel-alt'
                  }`}
                >
                  <div className={`font-mono text-[10px] font-bold ${on ? 'text-teal' : 'text-ink3'}`}>{p.code}</div>
                  <div className="mt-1 text-[11.5px] font-bold leading-tight text-ink">{p.name}</div>
                  <div className="mt-1 text-[9px] text-ink3">{p.tt}분</div>
                </button>
                {i < PROCS.length - 1 && <span className="mb-4 flex-shrink-0 px-0.5 text-[17px] text-border-hi">→</span>}
              </Fragment>
            );
          })}
        </div>
      </Card>

      {/* 마스터-디테일 */}
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <Card title="공정 목록" action={<span className="text-[10.5px] text-ink3">총 {PROCS.length}개 공정</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['순서', '공정코드', '공정명', '구분', '표준설비', 'T/T(분)'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 || i === 3 ? 'text-center' : i === 5 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROCS.map((p) => {
                  const on = p.code === selected;
                  return (
                    <tr key={p.code} onClick={() => setSelected(p.code)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3 py-2.5 text-center font-extrabold tabular-nums ${on ? 'text-teal' : 'text-ink3'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                        {p.seq}
                      </td>
                      <td className={`px-3 py-2.5 font-mono font-bold ${on ? 'text-teal' : 'text-ink'}`}>{p.code}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{p.name}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={TYPE_TONE[p.type]}>{p.type}</Pill></td>
                      <td className="px-3 py-2.5 font-mono text-ink2">{p.eq}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink2">{p.tt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="공정 상세정보" action={<ActionBar actions={[{ preset: 'save', label: '저장' }]} />}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="공정코드" value={cur.code} mono />
              <DetailField label="순서" value={cur.seq} mono />
            </div>
            <DetailField label="공정명" value={cur.name} />
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="공정구분" select value={cur.type} />
              <DetailField label="표준설비" select value={cur.eq} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Tact Time" value={`${cur.tt} 분`} mono />
              <DetailField label="검사여부" select value={cur.insp} />
            </div>
            <DetailField label="투입자재" select value={cur.materials} />
            <DetailField label="사용여부" select value="사용" />
            <DetailField label="작업표준" multiline value={cur.std} />
          </div>
        </Card>
      </div>
    </div>
  );
}
