import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { useWorkCenters } from '@/features/workCenter/useWorkCenters';

/** 작업장 미매핑 설비(보조 표시) — 설비 마스터 슬라이스 도입 시 이관 예정. */
const UNMAPPED: Array<[string, string, string]> = [
  ['CNC 04호기', '가공기', '신규 도입 — 작업장 미지정'],
  ['세정 04호기', '세정기', '라인 이설 후 미매핑'],
];

const eqTone = (s: string): Tone => (s === '가동' ? 'ok' : s === '대기' ? 'info' : s === '정비' ? 'warn' : 'mute');
const capaColor = (p: number) => (p >= 90 ? 'bg-danger' : p >= 80 ? 'bg-amber' : 'bg-teal');

/** 작업장 및 설비 매핑 — 데이터: features/workCenter/useWorkCenters. */
export default function WorkcenterMapScreen() {
  const [sel, setSel] = useState('WC-ASM');
  const { data: WC_LIST = [] } = useWorkCenters();
  const wc = WC_LIST.find((w) => w.code === sel) ?? WC_LIST[0];
  const totalEq = WC_LIST.reduce((s, w) => s + w.eqs.length, 0);
  const running = WC_LIST.reduce((s, w) => s + w.eqs.filter((e) => e.status === '가동').length, 0);
  const avgCapa = WC_LIST.length ? Math.round(WC_LIST.reduce((s, w) => s + w.capa, 0) / WC_LIST.length) : 0;

  const kpis: Array<[string, string, string, string]> = [
    ['작업장(Work Center)', String(WC_LIST.length), '개', 'text-ink'],
    ['매핑 설비', String(totalEq), '대', 'text-ink'],
    ['가동중 설비', String(running), '대', 'text-ok'],
    ['미매핑 설비', String(UNMAPPED.length), '대', 'text-danger'],
    ['평균 Capa', String(avgCapa), '%', 'text-ink'],
  ];

  const info: Array<[string, string]> = wc
    ? [['관리부서', wc.dept], ['근무조', wc.shift], ['투입 인원', `${wc.crew}명`], ['설비 수', `${wc.eqs.length}대`], ['작업장 Capa', `${wc.capa}%`]]
    : [];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">작업장 및 설비 매핑</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 기준정보 / 작업장 및 설비 매핑</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '작업장 등록', variant: 'primary' }, 'save', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c]) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${c}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3.5">
          <Card title="작업장 목록" bodyClassName="p-0">
            <div className="py-1.5">
              {WC_LIST.map((w) => {
                const on = w.code === sel;
                return (
                  <button key={w.code} onClick={() => setSel(w.code)} className={`block w-full px-3.5 py-3 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div>
                        <span className={`text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{w.name}</span>
                        <span className="ml-1.5 font-mono text-[9.5px] text-ink3">{w.code}</span>
                      </div>
                      <span className="text-[9.5px] text-ink3">{w.eqs.length}대 · {w.crew}명</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded bg-bg-deep">
                        <div className={`h-full rounded ${capaColor(w.capa)}`} style={{ width: `${w.capa}%` }} />
                      </div>
                      <span className={`w-[30px] text-right font-mono text-[9.5px] font-bold ${w.capa >= 90 ? 'text-danger' : 'text-ink2'}`}>{w.capa}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="미매핑 설비" action={<Pill tone="err">{UNMAPPED.length}</Pill>} bodyClassName="p-0">
            <div className="py-1">
              {UNMAPPED.map((e, i) => (
                <div key={e[0]} className={`flex items-center gap-2.5 px-4 py-2.5 ${i < UNMAPPED.length - 1 ? 'border-b border-border' : ''}`}>
                  <span className="text-[13px]">⚠</span>
                  <div className="flex-1">
                    <div className="text-[11.5px] font-bold text-ink">{e[0]} <span className="text-[9.5px] font-semibold text-ink3">· {e[1]}</span></div>
                    <div className="mt-px text-[9.5px] text-ink3">{e[2]}</div>
                  </div>
                  <button className="rounded-md bg-teal-soft px-2.5 py-1 text-[10px] font-bold text-teal">매핑</button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="매핑 상세" action={<span className="font-mono text-[10.5px] text-ink3">{wc?.code}</span>} bodyClassName="p-0">
          <div className="flex items-center justify-between border-b border-border bg-panel-alt px-4 py-3.5">
            <span className="text-[15px] font-extrabold text-ink">{wc?.name}</span>
            <span className="text-[10.5px] text-ink3">{wc?.line}</span>
          </div>

          <div className="grid grid-cols-5 gap-2.5 border-b border-border px-4 py-3">
            {info.map(([k, v], i) => (
              <div key={k}>
                <div className="mb-1 text-[9.5px] text-ink3">{k}</div>
                <div className={`text-[12.5px] font-extrabold ${i === 4 && wc && wc.capa >= 90 ? 'text-danger' : 'text-ink'} ${/\d/.test(v) ? 'font-mono' : ''}`}>{v}</div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-1 pt-3 text-[10.5px] font-bold text-ink3">매핑된 설비</div>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['설비명', '구분', '시간 Capa(EA/h)', '상태', '동작'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 2 ? 'text-right' : i >= 3 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(wc?.eqs ?? []).map((e, i) => (
                <tr key={e.name} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{e.name}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center text-ink3">{e.kind}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink2">{e.capa}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={eqTone(e.status)}>{e.status}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><span className="cursor-pointer text-[10px] font-bold text-ink3">매핑 해제</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-border px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">연결 공정 (Routing)</div>
            <div className="flex flex-wrap gap-1.5">
              {(wc?.procs ?? []).map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-[7px] bg-blue-soft px-2.5 py-1 text-[10.5px] font-bold text-blue">
                  <span className="font-mono text-[9.5px]">⚙</span>{p}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[9.5px] text-ink3">해당 작업장은 위 공정의 표준 라우팅에 배정되어 작업지시 발행 시 설비가 자동 할당됩니다.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
