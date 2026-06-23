import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';

interface Op {
  op: string;
  name: string;
  wc: string;
  eq: string;
  kind: '가공' | '검사' | '이동';
  setup: number;
  ct: number;
  crew: number;
  yield: number;
}
interface Product {
  code: string;
  name: string;
  rev: string;
  line: string;
}

const PRODUCTS: Product[] = [
  { code: 'CN-ASM-100', name: '커넥터 어셈블리', rev: 'B', line: '조립 라인' },
  { code: 'SN-MOD-200', name: '센서 모듈', rev: 'A', line: 'SMT 라인' },
  { code: 'BR-KIT-2T', name: '브래킷 키트', rev: 'C', line: '프레스 라인' },
];

const ROUTING: Record<string, Op[]> = {
  'CN-ASM-100': [
    { op: 'OP10', name: '사출 성형', wc: 'WC-INJ', eq: '사출 03호기', kind: '가공', setup: 30, ct: 45, crew: 1, yield: 99.2 },
    { op: 'OP20', name: '디버링/외관', wc: 'WC-DBG', eq: '–', kind: '검사', setup: 5, ct: 20, crew: 1, yield: 99.5 },
    { op: 'OP30', name: '터미널 압착', wc: 'WC-PRS', eq: '프레스 01호기', kind: '가공', setup: 25, ct: 30, crew: 1, yield: 98.8 },
    { op: 'OP40', name: '본체 조립', wc: 'WC-ASM', eq: '조립셀 A', kind: '가공', setup: 10, ct: 60, crew: 2, yield: 99.0 },
    { op: 'OP50', name: '기능 검사', wc: 'WC-EOL', eq: 'EOL 테스터', kind: '검사', setup: 8, ct: 35, crew: 1, yield: 97.5 },
    { op: 'OP60', name: '포장', wc: 'WC-PKG', eq: '–', kind: '가공', setup: 5, ct: 18, crew: 1, yield: 99.9 },
  ],
  'SN-MOD-200': [
    { op: 'OP10', name: 'SMT 실장', wc: 'WC-SMT', eq: 'SMT 라인 2', kind: '가공', setup: 40, ct: 28, crew: 1, yield: 99.0 },
    { op: 'OP20', name: '리플로우', wc: 'WC-RFL', eq: '리플로우 오븐', kind: '가공', setup: 15, ct: 22, crew: 1, yield: 99.3 },
    { op: 'OP30', name: 'AOI 검사', wc: 'WC-AOI', eq: 'AOI 02호기', kind: '검사', setup: 6, ct: 16, crew: 1, yield: 98.2 },
    { op: 'OP40', name: '케이스 조립', wc: 'WC-ASM', eq: '조립셀 B', kind: '가공', setup: 10, ct: 48, crew: 2, yield: 99.1 },
    { op: 'OP50', name: '교정/검사', wc: 'WC-CAL', eq: '교정 지그', kind: '검사', setup: 12, ct: 40, crew: 1, yield: 96.8 },
  ],
  'BR-KIT-2T': [
    { op: 'OP10', name: '프레스 성형', wc: 'WC-PRS', eq: '프레스 01호기', kind: '가공', setup: 35, ct: 12, crew: 1, yield: 99.4 },
    { op: 'OP20', name: '표면 처리', wc: 'WC-SFC', eq: '도금 라인', kind: '가공', setup: 20, ct: 90, crew: 1, yield: 98.5 },
    { op: 'OP30', name: '치수 검사', wc: 'WC-INSP', eq: '–', kind: '검사', setup: 5, ct: 25, crew: 1, yield: 99.6 },
    { op: 'OP40', name: '키트 포장', wc: 'WC-PKG', eq: '–', kind: '가공', setup: 5, ct: 30, crew: 2, yield: 99.9 },
  ],
};

const KIND_TONE: Record<Op['kind'], Tone> = { 가공: 'info', 검사: 'warn', 이동: 'mute' };
const KIND_C: Record<Op['kind'], string> = { 가공: T.blue, 검사: T.warn, 이동: T.ink3 };

/** 공정(Routing) 마스터 — 와이어프레임 routing-master.jsx 정본. */
export default function RoutingMasterScreen() {
  const [sel, setSel] = useState('CN-ASM-100');
  const prod = PRODUCTS.find((p) => p.code === sel) ?? PRODUCTS[0];
  const ops = ROUTING[sel] ?? [];
  const totalCt = ops.reduce((s, o) => s + o.ct, 0);
  const totalSetup = ops.reduce((s, o) => s + o.setup, 0);
  const maxCt = Math.max(...ops.map((o) => o.ct));
  const bottleneck = ops.find((o) => o.ct === maxCt)!;
  const rolledYield = ops.reduce((s, o) => (s * o.yield) / 100, 1) * 100;

  const kpis: Array<[string, string, string, string]> = [
    ['등록 라우팅', String(PRODUCTS.length), '종', 'text-ink'],
    ['공정 수', String(ops.length), 'OP', 'text-ink'],
    ['총 표준 C/T', String(totalCt), '초', 'text-teal'],
    ['병목 공정', `${bottleneck.op} ${bottleneck.ct}s`, '', 'text-danger'],
    ['누적 수율(RTY)', rolledYield.toFixed(1), '%', 'text-ink'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정(Routing) 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 기준정보 / 공정(Routing) 마스터</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '공정 추가', variant: 'primary' }, 'save', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c], i) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`font-extrabold tracking-tight tabular-nums ${c} ${i === 3 ? 'text-base' : 'text-2xl'}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[250px_1fr]">
        <Card title="제품 / 라우팅" bodyClassName="p-0">
          <div className="py-1.5">
            {PRODUCTS.map((p) => {
              const on = p.code === sel;
              const cnt = (ROUTING[p.code] ?? []).length;
              return (
                <button key={p.code} onClick={() => setSel(p.code)} className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{p.name}</div>
                    <div className="mt-0.5 font-mono text-[9.5px] text-ink3">{p.code} · {p.line}</div>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[9.5px] font-bold text-blue">Rev {p.rev}</span>
                    <div className="mt-1 text-[9px] text-ink3">{cnt} OP</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="공정 흐름도" action={<span className="text-[10.5px] text-ink3">{prod.name} <span className="font-mono">· Rev {prod.rev}</span></span>}>
            <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
              {ops.map((o, i) => {
                const isBn = o.ct === maxCt;
                return (
                  <Fragment key={o.op}>
                    <div className={`min-w-[96px] flex-1 rounded-[10px] border-[1.5px] p-2.5 ${isBn ? 'border-danger bg-[#fdecea]' : 'border-border bg-panel'}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-1.5">
                        <span className="font-mono text-[9.5px] font-extrabold text-ink3">{o.op}</span>
                        {isBn ? (
                          <span className="whitespace-nowrap rounded bg-danger px-1.5 py-px text-[8.5px] font-extrabold text-white">병목</span>
                        ) : (
                          <span className="h-[7px] w-[7px] rounded-sm" style={{ background: KIND_C[o.kind] }} />
                        )}
                      </div>
                      <div className="mb-1.5 text-[11.5px] font-bold leading-tight text-ink">{o.name}</div>
                      <div className={`font-mono text-[13px] font-extrabold ${isBn ? 'text-danger' : 'text-teal'}`}>{o.ct}s</div>
                      <div className="mt-0.5 truncate text-[9px] text-ink3">{o.eq}</div>
                    </div>
                    {i < ops.length - 1 && <div className="flex flex-shrink-0 items-center px-1 text-[14px] text-ink3">→</div>}
                  </Fragment>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-[10.5px]">
              <span className="text-ink3">총 표준시간 <b className="font-mono text-ink">{totalCt}s</b> · Setup <b className="font-mono text-ink2">{totalSetup}분</b></span>
              <span className="text-ink3">라인 택트(병목) <b className="font-mono text-danger">{maxCt}s/EA</b></span>
              <div className="ml-auto flex gap-3">
                {(['가공', '검사'] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 font-semibold text-ink2">
                    <span className="h-2 w-2 rounded-sm" style={{ background: KIND_C[k] }} />{k}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card title="공정 순서 상세" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {['공정', '구분', '작업장 / 설비', 'Setup(분)', '표준 C/T(초)', '인원', '공정수율'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 || i === 6 ? 'text-right' : i === 1 || i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ops.map((o, i) => {
                    const isBn = o.ct === maxCt;
                    return (
                      <tr key={o.op} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                        <td className="border-b border-border px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-8 font-mono text-[9.5px] font-extrabold text-ink3">{o.op}</span>
                            <span className="font-bold text-ink">{o.name}</span>
                          </div>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={KIND_TONE[o.kind]}>{o.kind}</Pill></td>
                        <td className="border-b border-border px-3 py-2.5">
                          <span className="font-mono text-[10.5px] text-ink2">{o.wc}</span>
                          <div className="mt-0.5 text-[9.5px] text-ink3">{o.eq}</div>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{o.setup}</td>
                        <td className="border-b border-border px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 min-w-[70px] flex-1 rounded bg-bg-deep">
                              <div className="h-full rounded" style={{ width: `${(o.ct / maxCt) * 100}%`, background: isBn ? T.err : T.teal }} />
                            </div>
                            <span className={`w-8 text-right font-mono font-extrabold ${isBn ? 'text-danger' : 'text-ink'}`}>{o.ct}</span>
                          </div>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-center font-mono text-ink2">{o.crew}명</td>
                        <td className={`border-b border-border px-3 py-2.5 text-right font-mono font-bold ${o.yield < 98 ? 'text-amber' : 'text-ink2'}`}>{o.yield}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border bg-panel-alt px-4 py-2.5">
              <span className="text-[10.5px] text-ink3">{ops.length}개 공정 · 누적 수율(RTY) <b className="text-ink2">{rolledYield.toFixed(1)}%</b></span>
              <span className="text-[11px] text-ink3">병목 <b className="text-danger">{bottleneck.op} {bottleneck.name}</b> — 라인 능력 결정 공정</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
