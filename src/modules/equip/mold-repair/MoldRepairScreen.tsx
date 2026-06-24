import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';
import { useMoldRepairs } from '@/features/moldRepair/useMoldRepairs';

interface Cyc { code: string; name: string; cycle: number; sinceLast: number; last: string; state: string }
const CLEAN_CYCLE: Cyc[] = [
  { code: 'MD-PRS-210', name: '브래킷 프레스 금형', cycle: 50000, sinceLast: 0, last: '06-10', state: '정상' },
  { code: 'MD-INJ-101', name: '커넥터 하우징 금형', cycle: 30000, sinceLast: 3100, last: '06-08', state: '정상' },
  { code: 'MD-INJ-102', name: '센서 커버 금형', cycle: 25000, sinceLast: 3800, last: '06-05', state: '정상' },
  { code: 'MD-INJ-103', name: '하우징 캡 금형', cycle: 40000, sinceLast: 38000, last: '04-12', state: '도래임박' },
  { code: 'MD-PRS-211', name: '터미널 단자 금형', cycle: 60000, sinceLast: 62000, last: '03-30', state: '초과' },
];
const typeTone = (t: string): Tone => (t === '수리' ? 'err' : t === '정기세척' || t === '세척' ? 'ok' : t === '점검' ? 'info' : 'warn');
const stTone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행중' ? 'warn' : 'mute');
const cycleTone = (s: string): Tone => (s === '정상' ? 'ok' : s === '도래임박' ? 'warn' : 'err');
const won = (n: number) => n.toLocaleString('ko-KR');

function CycleBar({ since, cycle }: { since: number; cycle: number }) {
  const pct = Math.min((since / cycle) * 100, 120);
  const c = pct >= 100 ? C.err : pct >= 85 ? C.warn : C.teal;
  return <div className="relative h-[7px] min-w-[80px] rounded" style={{ background: C.bgDeep }}><div className="absolute inset-0 rounded" style={{ width: `${Math.min(pct, 100)}%`, background: c }} /></div>;
}

/** 금형 수리 / 세척 이력 — 와이어프레임 mold-repair.jsx 정본. */
export default function MoldRepairScreen() {
  const { data: repRows = [], isLoading } = useMoldRepairs();
  const [filter, setFilter] = useState('전체');
  const shown = repRows.filter((r) => filter === '전체' || (filter === '세척' ? r.type === '세척' || r.type === '정기세척' : r.type === filter));

  const repairCnt = repRows.filter((r) => r.type === '수리').length;
  const ongoing = repRows.filter((r) => r.state === '진행중').length;
  const totalCost = repRows.reduce((s, r) => s + r.cost, 0);
  const cycleDue = CLEAN_CYCLE.filter((c) => c.state !== '정상').length;

  if (repRows.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '수리·세척 이력이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">금형 수리 / 세척 이력</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 금형 및 치공구 관리 / 금형 수리·세척 이력</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '작업 등록', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['당월 작업', '' + repRows.length, '건', C.ink], ['수리 건', '' + repairCnt, '건', C.err], ['진행중', '' + ongoing, '건', C.warn],
        ['세척주기 도래', '' + cycleDue, '식', C.warn], ['당월 정비비용', (totalCost / 1e6).toFixed(2), 'M₩', C.ink],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_320px]">
        {/* 작업 이력 */}
        <Card
          title="수리 / 세척 작업 이력"
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {['전체', '세척', '수리', '점검', '개조'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="rounded-[7px] px-3 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${filter === f ? C.teal : C.borderHi}`, background: filter === f ? C.teal : '#fff', color: filter === f ? '#fff' : C.ink2 }}>{f}</button>
              ))}
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['작업번호 / 일시', 'text-left'], ['유형', 'text-center'], ['금형 / 작업 내용', 'text-left'], ['소요', 'text-right'], ['비용(₩)', 'text-right'], ['수행', 'text-left'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.no} className="align-top" style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5 font-mono text-[10px] text-ink3">{r.no}<div className="mt-0.5 text-[9.5px]">{r.date}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={typeTone(r.type)}>{r.type}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5">
                    <div className="font-bold text-ink">{r.name}</div>
                    <div className="mt-0.5 text-[10px] text-ink2">{r.detail}</div>
                    <div className="mt-0.5 font-mono text-[9px] text-ink3">{r.code} · {r.shotAt.toLocaleString()} shot 시점</div>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{r.hrs > 0 ? r.hrs + 'h' : '–'}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: r.cost > 0 ? C.ink : C.ink3 }}>{r.cost > 0 ? won(r.cost) : '–'}</td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{r.who}<div className="mt-px text-[9px] text-ink3">{r.vendor === '자체정비' ? '자체' : '외주'}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(r.state)}>{r.state}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[10.5px] text-ink3">{shown.length}건</span>
            <span className="text-[11px] text-ink3">비용 합계 <b className="font-mono text-ink">{won(shown.reduce((s, r) => s + r.cost, 0))} ₩</b></span>
          </div>
        </Card>

        {/* 세척 주기 */}
        <Card title="세척 주기 현황" bodyClassName="p-0" action={<span className="text-[10px] text-ink3">타수 기준</span>}>
          <div className="py-2.5">
            {CLEAN_CYCLE.map((c, i) => (
              <div key={c.code} className="px-4 py-2.5" style={{ borderBottom: i < CLEAN_CYCLE.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-ink">{c.name}</span>
                  <Pill tone={cycleTone(c.state)}>{c.state}</Pill>
                </div>
                <CycleBar since={c.sinceLast} cycle={c.cycle} />
                <div className="mt-1 flex justify-between font-mono text-[9.5px] text-ink3">
                  <span>경과 {c.sinceLast.toLocaleString()} / 주기 {c.cycle.toLocaleString()}</span>
                  <span>최근 {c.last}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-4 py-3" style={{ background: C.panelAlt }}>
            <button className="w-full rounded-[9px] py-2.5 text-[12px] font-extrabold text-white" style={{ background: C.navy }}>세척 작업지시 생성</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
