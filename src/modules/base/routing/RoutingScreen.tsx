import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterField } from '@/shared/ui/FilterBar';

interface Step {
  seq: number;
  code: string;
  name: string;
  eq: string;
  tt: string;
  insp: boolean;
}
interface Route {
  code: string;
  name: string;
  product: string;
  tt: string;
  rev: string;
  steps: Step[];
}

const ROUTES: Route[] = [
  {
    code: 'RT-WF300-A', name: '300mm 표준 라우팅', product: 'WF-300-B', tt: '162', rev: 'Rev.3',
    steps: [
      { seq: 10, code: 'OP-10', name: '입고/세정', eq: 'CLEAN', tt: '12', insp: false },
      { seq: 20, code: 'OP-20', name: '포토(노광)', eq: 'PHO05', tt: '35', insp: false },
      { seq: 30, code: 'OP-30', name: '식각(Etch)', eq: 'ETCH01', tt: '28', insp: false },
      { seq: 40, code: 'OP-40', name: '증착(Depo)', eq: 'DEP03', tt: '40', insp: false },
      { seq: 50, code: 'OP-50', name: 'CMP 연마', eq: 'CMP02', tt: '22', insp: false },
      { seq: 60, code: 'OP-60', name: '검사(Inspection)', eq: 'INS-VIS', tt: '15', insp: true },
      { seq: 70, code: 'OP-70', name: '출하 포장', eq: 'PACK', tt: '10', insp: false },
    ],
  },
  {
    code: 'RT-WF200-A', name: '200mm 표준 라우팅', product: 'WF-200-A', tt: '138', rev: 'Rev.2',
    steps: [
      { seq: 10, code: 'OP-10', name: '입고/세정', eq: 'CLEAN', tt: '12', insp: false },
      { seq: 20, code: 'OP-20', name: '포토(노광)', eq: 'PHO05', tt: '30', insp: false },
      { seq: 30, code: 'OP-30', name: '식각(Etch)', eq: 'ETCH01', tt: '26', insp: false },
      { seq: 40, code: 'OP-50', name: 'CMP 연마', eq: 'CMP02', tt: '20', insp: false },
      { seq: 50, code: 'OP-60', name: '검사', eq: 'INS-VIS', tt: '14', insp: true },
      { seq: 60, code: 'OP-70', name: '출하 포장', eq: 'PACK', tt: '10', insp: false },
    ],
  },
  {
    code: 'RT-BGA-14', name: 'BGA 패키지 라우팅', product: 'PKG-BGA-14', tt: '205', rev: 'Rev.1',
    steps: [
      { seq: 10, code: 'OP-10', name: '다이 어태치', eq: 'DA-02', tt: '30', insp: false },
      { seq: 20, code: 'OP-20', name: '와이어 본딩', eq: 'WB-05', tt: '45', insp: false },
      { seq: 30, code: 'OP-30', name: '몰딩', eq: 'MLD-01', tt: '40', insp: false },
      { seq: 40, code: 'OP-40', name: '볼 마운트', eq: 'BM-03', tt: '35', insp: false },
      { seq: 50, code: 'OP-50', name: '마킹', eq: 'MRK-02', tt: '20', insp: false },
      { seq: 60, code: 'OP-60', name: '외관검사', eq: 'INS-VIS', tt: '18', insp: true },
      { seq: 70, code: 'OP-70', name: '전기검사', eq: 'FCT-01', tt: '12', insp: true },
      { seq: 80, code: 'OP-80', name: '포장', eq: 'PACK', tt: '5', insp: false },
    ],
  },
];

/** 라우팅코드/적용제품 한 줄에 표시하는 화살표 버튼(순서 이동). */
function ArrowBtn({ dir }: { dir: 'up' | 'down' }) {
  return (
    <span className="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded-md border border-border-hi bg-panel text-[10px] text-ink2 hover:bg-panel-alt">
      {dir === 'up' ? '▲' : '▼'}
    </span>
  );
}

/** 공정라우팅 — 필터 + 마스터-디테일(라우팅 목록 + 공정 순서[흐름·이동]). 와이어프레임 admin-screens.ProcessRoutingContent 정본. */
export default function RoutingScreen() {
  const [selected, setSelected] = useState('RT-WF300-A');
  const cur = ROUTES.find((r) => r.code === selected) ?? ROUTES[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정라우팅</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 공정라우팅</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '라우팅 추가' }, 'save', 'upload', 'download']} />
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-panel p-3.5">
        {['적용 제품', '상태'].map((f) => (
          <FilterField key={f} label={f}>
            <span className="inline-flex h-8 min-w-[110px] items-center justify-between gap-4 rounded-md border border-border-hi bg-panel px-3.5 text-[11.5px] font-semibold text-ink">
              전체 <span className="text-[8px] text-ink3">▾</span>
            </span>
          </FilterField>
        ))}
        <FilterField label="검색">
          <span className="inline-flex h-8 w-[180px] items-center rounded-md border border-border-hi bg-panel px-3 text-[11.5px] text-ink3">라우팅코드 / 라우팅명</span>
        </FilterField>
        <span className="ml-auto">
          <ActionButton icon="search" label="조회" variant="primary" />
        </span>
      </div>

      {/* 마스터-디테일 */}
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_1.5fr]">
        {/* 라우팅 목록 */}
        <Card title="라우팅 목록" action={<span className="text-[10.5px] text-ink3">총 {ROUTES.length}건</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['라우팅코드', '적용 제품', '공정', '표준(분)', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 && i <= 3 ? 'text-right' : i === 4 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROUTES.map((r) => {
                  const on = r.code === selected;
                  return (
                    <tr key={r.code} onClick={() => setSelected(r.code)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className="px-3 py-2.5" style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                        <div className={`font-mono text-[11px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{r.code}</div>
                        <div className="mt-0.5 text-[10px] text-ink3">{r.name}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-ink2">{r.product}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink2">{r.steps.length}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{r.tt}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={on ? 'ok' : 'mute'}>{r.rev}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 공정 순서 */}
        <Card
          title={<span>공정 순서 <span className="text-teal">· {cur.code}</span></span>}
          action={
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-ink3">{cur.steps.length}개 공정 · {cur.tt}분</span>
              <ActionButton icon="plus" label="공정 추가" />
            </div>
          }
          bodyClassName="p-0"
        >
          {/* 흐름 */}
          <div className="flex items-center overflow-x-auto px-3.5 pb-1.5 pt-3.5">
            {cur.steps.map((p, i) => (
              <Fragment key={p.seq}>
                <div className={`w-[78px] flex-shrink-0 rounded-[9px] border-[1.5px] px-1.5 py-2 text-center ${p.insp ? 'border-amber bg-[#fdf6e8]' : 'border-border bg-panel'}`}>
                  <div className="font-mono text-[9px] font-bold text-ink3">{p.code}</div>
                  <div className="mt-0.5 text-[10.5px] font-bold leading-tight text-ink">{p.name}</div>
                </div>
                {i < cur.steps.length - 1 && <span className="flex-shrink-0 px-px text-[14px] text-border-hi">→</span>}
              </Fragment>
            ))}
          </div>

          {/* 테이블 */}
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  <th className="w-[50px] border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold text-ink2">순서</th>
                  {['공정코드', '공정명', '표준설비', 'T/T(분)', '검사'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 ? 'text-right' : i === 4 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                  <th className="w-[70px] border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold text-ink2">이동</th>
                </tr>
              </thead>
              <tbody>
                {cur.steps.map((p, i) => (
                  <tr key={p.seq} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 text-center font-extrabold tabular-nums text-navy">{p.seq}</td>
                    <td className="border-b border-border px-3 py-2.5 font-mono font-bold text-ink">{p.code}</td>
                    <td className="border-b border-border px-3 py-2.5 font-semibold text-ink">{p.name}</td>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-ink2">{p.eq}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-semibold tabular-nums text-ink2">{p.tt}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center">
                      {p.insp ? <Pill tone="warn">검사</Pill> : <span className="text-ink3">—</span>}
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center">
                      <span className="inline-flex gap-1">
                        <ArrowBtn dir="up" />
                        <ArrowBtn dir="down" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
