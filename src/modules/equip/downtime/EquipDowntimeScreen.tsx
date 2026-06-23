import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { RankBars } from '@/shared/ui/charts/RankBars';

const DT_CAT = [
  { key: 'bm', name: '고장(BM)', c: '#e0564f' },
  { key: 'pm', name: '계획보전(PM)', c: '#3a6ee0' },
  { key: 'setup', name: '준비·교체', c: '#17a89a' },
  { key: 'wait', name: '자재 대기', c: '#ef8f43' },
  { key: 'qc', name: '품질·검사', c: '#8b6fd6' },
  { key: 'etc', name: '기타', c: '#94a0b8' },
] as const;

const DT_REASON = [
  { name: '고장(BM)', h: 48.5, c: '#e0564f', cnt: 9 },
  { name: '계획보전(PM)', h: 35.0, c: '#3a6ee0', cnt: 12 },
  { name: '준비·교체', h: 24.0, c: '#17a89a', cnt: 14 },
  { name: '자재 대기', h: 18.5, c: '#ef8f43', cnt: 6 },
  { name: '품질·검사', h: 10.5, c: '#8b6fd6', cnt: 4 },
  { name: '기타', h: 6.0, c: '#94a0b8', cnt: 2 },
];

const DT_EQUIP = [
  { label: 'Thermal 05호기', v: 32.5, c: '#e0564f' },
  { label: 'Etch 01호기', v: 24.0, c: '#17a89a' },
  { label: 'Depo 03호기', v: 21.5, c: '#e0564f' },
  { label: 'CMP 02호기', v: 18.0, c: '#3a6ee0' },
  { label: 'Implant 02호기', v: 15.5, c: '#ef8f43' },
  { label: 'Photo 05호기', v: 12.0, c: '#8b6fd6' },
  { label: 'Clean 04호기', v: 11.0, c: '#e0564f' },
];

type DayKey = (typeof DT_CAT)[number]['key'];
const DT_DAILY: ({ d: string } & Record<DayKey, number>)[] = [
  { d: '06.01', bm: 2.5, pm: 4.0, setup: 2.0, wait: 1.0, qc: 0.5, etc: 0.5 },
  { d: '06.02', bm: 4.0, pm: 3.5, setup: 2.5, wait: 2.0, qc: 1.0, etc: 0 },
  { d: '06.03', bm: 3.0, pm: 5.0, setup: 3.0, wait: 1.5, qc: 1.0, etc: 1.0 },
  { d: '06.04', bm: 6.5, pm: 2.0, setup: 2.0, wait: 2.5, qc: 0.5, etc: 0.5 },
  { d: '06.05', bm: 3.5, pm: 4.5, setup: 3.5, wait: 1.0, qc: 2.0, etc: 0 },
  { d: '06.06', bm: 5.0, pm: 3.0, setup: 2.0, wait: 3.0, qc: 1.0, etc: 1.0 },
  { d: '06.07', bm: 4.5, pm: 3.5, setup: 2.5, wait: 2.0, qc: 1.5, etc: 0.5 },
  { d: '06.08', bm: 5.5, pm: 2.5, setup: 2.0, wait: 1.5, qc: 1.0, etc: 1.0 },
  { d: '06.09', bm: 6.0, pm: 4.5, setup: 1.5, wait: 2.0, qc: 1.0, etc: 0 },
  { d: '06.10', bm: 8.0, pm: 2.0, setup: 2.5, wait: 1.5, qc: 1.0, etc: 0.5 },
];

const DT_LOG: string[][] = [
  ['Thermal 05호기', '06-10 13:20', '— (진행중)', '2.4', '고장(BM)', 'AL-6003 튜브 과승온 — 히터 점검중', '박보전', '진행중'],
  ['Depo 03호기', '06-09 22:10', '06-10 02:40', '4.5', '고장(BM)', '챔버 누설 — O-Ring 교체', '이정비', '완료'],
  ['CMP 02호기', '06-09 14:00', '06-09 16:00', '2.0', '계획보전(PM)', '월간 예방점검 — 소모품 교체', '김설비', '완료'],
  ['Etch 01호기', '06-09 09:30', '06-09 12:00', '2.5', '준비·교체', '제품 전환 레시피 셋업', '박보전', '완료'],
  ['Implant 02호기', '06-08 20:00', '06-08 21:15', '1.25', '자재 대기', '웨이퍼 공급 지연', '—', '완료'],
  ['Photo 05호기', '06-08 11:00', '06-08 11:40', '0.67', '품질·검사', '오버레이 재측정', '김설비', '완료'],
  ['Clean 04호기', '06-07 16:30', '06-07 18:00', '1.5', '고장(BM)', '필터 차압 초과 — 필터 교체', '이정비', '완료'],
];

const catColor = (n: string) => DT_REASON.find((r) => r.name === n)?.c || '#94a0b8';

function Sel({ value, w }: { value?: string; w?: number }) {
  return (
    <span className="inline-flex items-center justify-between gap-3.5 rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold" style={{ minWidth: w || 100, color: value ? 'var(--color-ink)' : 'var(--color-ink3)' }}>
      {value || '전체'} <span className="text-[8px] text-ink3">▾</span>
    </span>
  );
}

const KPI: [string, string, string, string][] = [
  ['총 비가동 시간', '142.5', 'h', '#e0564f'],
  ['평균 가동률', '88.3', '%', '#17a89a'],
  ['비가동 건수', '47', '건', '#1c2536'],
  ['MTBF', '38.2', 'h', '#3a6ee0'],
  ['MTTR', '3.0', 'h', '#3a6ee0'],
  ['최다 사유', '고장', 'BM', '#e0564f'],
];

const AL: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
const th = (al: string) => `border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${AL[al]}`;
const td = (al: string) => `border-b border-border px-3 py-2.5 ${AL[al]} text-ink2 leading-snug`;

/** 비가동(Downtime) 현황 — 와이어프레임 equip-downtime.jsx 정본. */
export default function EquipDowntimeScreen() {
  const totalH = DT_REASON.reduce((s, r) => s + r.h, 0);
  const maxReason = Math.max(...DT_REASON.map((r) => r.h));
  const dailyMax = Math.max(...DT_DAILY.map((d) => DT_CAT.reduce((s, c) => s + d[c.key], 0)));
  let cum = 0;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">비가동(Downtime) 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 상태 모니터링 / 비가동(Downtime) 현황</p>
        </div>
        <ActionBar actions={['refresh', 'download']} />
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-panel p-3.5">
        <span className="flex items-center gap-2"><span className="text-[11px] font-semibold text-ink3">기간</span><Sel value="2026-06-01 ~ 06-10" w={170} /></span>
        <span className="flex items-center gap-2"><span className="text-[11px] font-semibold text-ink3">라인</span><Sel w={90} /></span>
        <span className="flex items-center gap-2"><span className="text-[11px] font-semibold text-ink3">설비</span><Sel w={120} /></span>
        <span className="flex items-center gap-2"><span className="text-[11px] font-semibold text-ink3">비가동 구분</span><Sel w={110} /></span>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KPI.map(([l, v, u, c]) => (
          <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className="whitespace-nowrap text-[24px] font-extrabold tracking-tight tabular-nums" style={{ color: c }}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
        {/* 사유별 파레토 */}
        <Card title="사유별 비가동 (Pareto)" action={<span className="text-[10.5px] text-ink3">누적 기여도 %</span>}>
          <div className="flex flex-col gap-3">
            {DT_REASON.map((r, i) => {
              const pct = (r.h / totalH) * 100;
              cum += pct;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-[92px] shrink-0 text-right text-[11.5px] font-bold text-ink">{r.name}</span>
                  <div className="min-w-0 flex-1">
                    <div className="relative h-[18px] rounded bg-bg-deep">
                      <div className="flex h-full items-center rounded pl-2" style={{ width: `${(r.h / maxReason) * 100}%`, background: r.c }}>
                        <span className="text-[10px] font-extrabold text-white">{r.h}h</span>
                      </div>
                    </div>
                  </div>
                  <span className="flex w-[78px] shrink-0 flex-col items-end">
                    <span className="text-[11px] font-extrabold tabular-nums text-ink">{pct.toFixed(1)}%</span>
                    <span className="text-[9px] text-ink3">누적 {cum.toFixed(0)}% · {r.cnt}건</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 설비별 비가동 */}
        <Card title="설비별 비가동 Top" action={<span className="text-[10.5px] text-ink3">누적 시간 기준</span>}>
          <RankBars rows={DT_EQUIP} />
        </Card>
      </div>

      {/* 일자별 추이 (스택) */}
      <Card
        title="일자별 비가동 추이"
        action={
          <div className="flex flex-wrap gap-3">
            {DT_CAT.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5 text-[10px] text-ink2"><span className="h-[9px] w-[9px] rounded-sm" style={{ background: c.c }} />{c.name}</span>
            ))}
          </div>
        }
      >
        <div className="flex h-[180px] items-end gap-0 pt-2">
          {DT_DAILY.map((d, i) => {
            const tot = DT_CAT.reduce((s, c) => s + d[c.key], 0);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[9.5px] font-bold tabular-nums text-ink2">{tot.toFixed(1)}</span>
                <div className="flex h-[130px] w-[26px] flex-col-reverse overflow-hidden rounded bg-bg-deep">
                  {DT_CAT.map((c) =>
                    d[c.key] > 0 ? <div key={c.key} style={{ height: (d[c.key] / dailyMax) * 130, background: c.c }} title={`${c.name} ${d[c.key]}h`} /> : null,
                  )}
                </div>
                <span className="text-[9.5px] text-ink3">{d.d}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 비가동 이력 */}
      <Card title="비가동 이력" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">최근 발생 순 · {DT_LOG.length}건</span>}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className={th('left')}>설비</th>
              <th className={th('center')}>시작</th>
              <th className={th('center')}>종료</th>
              <th className={th('right')}>시간(h)</th>
              <th className={th('center')}>구분</th>
              <th className={th('left')}>사유 / 조치</th>
              <th className={th('center')}>담당</th>
              <th className={th('center')}>상태</th>
            </tr>
          </thead>
          <tbody>
            {DT_LOG.map((r, i) => (
              <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('center')} font-mono`}>{r[1]}</td>
                <td className={`${td('center')} font-mono`}>{r[2]}</td>
                <td className={`${td('right')} font-extrabold tabular-nums text-ink`}>{r[3]}</td>
                <td className={td('center')}><span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink2"><span className="h-[9px] w-[9px] rounded-sm" style={{ background: catColor(r[4]) }} />{r[4]}</span></td>
                <td className={`${td('left')} text-ink`}>{r[5]}</td>
                <td className={td('center')}>{r[6]}</td>
                <td className={td('center')}><Pill tone={r[7] === '진행중' ? 'err' : 'ok'}>{r[7]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
