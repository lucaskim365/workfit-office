import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, Sel, FilterCard, FilterField, KpiGrid } from '../_maint';
import { usePeriodicChecks, useTransitionPeriodicCheck } from '@/features/periodicCheck/usePeriodicChecks';
import { nextStatus, nextActionLabel } from '@/domain/periodicCheck/status';

const resTone = (r: string): Tone => (r === '합격' ? 'ok' : r === '조건부' ? 'warn' : r === '불합격' ? 'err' : 'mute');

const PC_DETAIL: { group: string; items: [string, string, string, 'OK' | 'NG', string][] }[] = [
  { group: '광학계 / 렌즈', items: [
    ['렌즈 표면 청결도', '오염·스크래치 없음', '경미한 오염', 'NG', '렌즈 재세정 후 재점검 요'],
    ['조명 강도(Illumination)', '95 ~ 105 %', '98.4 %', 'OK', ''],
    ['포커스 오프셋', '± 0.05 µm', '0.03 µm', 'OK', ''],
  ] },
  { group: '스테이지 / 정렬', items: [
    ['스테이지 평탄도', '≤ 0.5 µm', '0.82 µm', 'NG', '스테이지 레벨링 재조정 필요'],
    ['X-Y 위치 정밀도', '± 2 nm', '1.4 nm', 'OK', ''],
    ['척(Chuck) 진공압', '≥ -85 kPa', '-88 kPa', 'OK', ''],
  ] },
  { group: '구동 / 안전', items: [
    ['도어 인터락 동작', '정상 차단', '정상', 'OK', ''],
    ['비상정지(EMO) 동작', '정상 동작', '정상', 'OK', ''],
    ['누설 전류', '≤ 1 mA', '0.3 mA', 'OK', ''],
  ] },
];

/** 정기 점검 현황 — 와이어프레임 equip-periodic-check.jsx 정본. */
export default function EquipPeriodicCheckScreen() {
  const { data: rows = [], isLoading } = usePeriodicChecks();
  const transition = useTransitionPeriodicCheck();
  const [sel, setSel] = useState('PC-2606-015');
  const flat = PC_DETAIL.flatMap((g) => g.items);
  const okN = flat.filter((i) => i[3] === 'OK').length;
  const ngN = flat.filter((i) => i[3] === 'NG').length;

  if (isLoading) {
    return <div className="p-6 text-sm text-ink3">불러오는 중…</div>;
  }
  if (rows.length === 0) {
    return <div className="p-6 text-sm text-ink3">정기 점검 실적이 없습니다.</div>;
  }

  const cur = rows.find((r) => r.no === sel) || rows[0];
  const nx = nextStatus(cur.status);
  const nxLabel = nextActionLabel(cur.status);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">정기 점검 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 보전 및 점검 / 정기 점검 현황</p>
        </div>
        <ActionBar actions={['add', 'download']} />
      </div>

      <FilterCard>
        <FilterField label="기간"><Sel value="2026-06" w={110} /></FilterField>
        <FilterField label="설비"><Sel w={120} /></FilterField>
        <FilterField label="점검주기"><Sel w={90} /></FilterField>
        <FilterField label="판정"><Sel w={90} /></FilterField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FilterCard>

      <KpiGrid cols={5} items={[
        ['이번달 정기점검', '18', '건', C.ink], ['합격', '13', '건', C.teal], ['조건부', '3', '건', C.warn],
        ['불합격', '2', '건', C.err], ['계획 이행률', '90.0', '%', C.teal],
      ]} />

      {/* 주기별 이행 현황 */}
      <Card title="점검 주기별 이행 현황">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {([['주간', 8, 8, C.blue], ['월간', 6, 7, C.teal], ['분기', 3, 4, C.amber], ['연간', 1, 1, C.violet]] as const).map(([lab, done, plan, c]) => {
            const p = Math.round((done / plan) * 100);
            return (
              <div key={lab} className="flex flex-col gap-2.5 rounded-[10px] border border-border px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink"><span className="h-[9px] w-[9px] rounded-sm" style={{ background: c }} />{lab} 점검</span>
                  <span className="text-[11px] font-extrabold tabular-nums" style={{ color: p === 100 ? C.teal : C.ink2 }}>{p}%</span>
                </div>
                <div className="h-[7px] rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: `${p}%`, background: c }} /></div>
                <span className="text-[10.5px] text-ink3">이행 <b className="text-ink2">{done}</b> / 계획 {plan} 건</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.55fr_1fr]">
        {/* 실적 목록 */}
        <Card title="정기 점검 실적" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{rows.length}건</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['점검번호', '설비', '주기', '점검일', 'NG', '판정'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i < 2 ? 'text-left' : 'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const on = r.no === sel;
                return (
                  <tr key={r.no} onClick={() => setSel(r.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[10.5px]" style={{ fontWeight: on ? 800 : 600, color: on ? C.teal : C.ink2, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                    <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{r.eq}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{r.type}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] text-ink3">{r.date.slice(5)}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-extrabold" style={{ color: r.ng > 0 ? C.err : C.ink3 }}>{r.ng}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={resTone(r.result)}>{r.result}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 결과 상세 */}
        <Card title="점검 결과 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.no}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[14px] font-extrabold text-ink">{cur.eq}</span>
              <div className="flex items-center gap-2">
                {nx && nxLabel && (
                  <ActionButton
                    icon="save"
                    label={nxLabel}
                    variant="primary"
                    onClick={() => transition.mutate({ no: cur.no, to: nx })}
                  />
                )}
                <Pill tone={resTone(cur.result)}>{cur.result}</Pill>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['점검주기', cur.type], ['점검팀', cur.team], ['점검자', cur.worker], ['소요시간', cur.dur + '분'], ['점검항목', cur.items + '개'], ['차기 점검', cur.next]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-[11.5px] font-bold text-ink2 ${/\d/.test(v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 border-b border-border px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-[11.5px]"><span className="h-2 w-2 rounded-full" style={{ background: C.ok }} /><b className="text-ink">{okN}</b> <span className="text-ink3">정상</span></span>
            <span className="flex items-center gap-1.5 text-[11.5px]"><span className="h-2 w-2 rounded-full" style={{ background: C.err }} /><b style={{ color: C.err }}>{ngN}</b> <span className="text-ink3">비정상</span></span>
            <span className="ml-auto text-[10.5px] text-ink3">주요 점검 부위</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {PC_DETAIL.map((g, gi) => (
              <div key={gi}>
                <div className="px-4 py-[7px] text-[10.5px] font-bold text-white" style={{ background: C.navy }}>{g.group}</div>
                {g.items.map((it, ii) => (
                  <div key={ii} className="border-b border-border px-4 py-2.5" style={{ background: it[3] === 'NG' ? '#fdf2f1' : '#fff' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-bold text-ink">{it[0]}</span>
                      <span className="rounded-[5px] px-[7px] py-0.5 text-[10px] font-extrabold" style={{ color: it[3] === 'NG' ? '#fff' : C.ok, background: it[3] === 'NG' ? C.err : C.okSoft }}>{it[3]}</span>
                    </div>
                    <div className="mt-0.5 flex gap-3">
                      <span className="text-[10px] text-ink3">기준 <span className="text-ink2">{it[1]}</span></span>
                      <span className="text-[10px] text-ink3">측정 <span className="font-bold" style={{ color: it[3] === 'NG' ? C.err : C.ink2 }}>{it[2]}</span></span>
                    </div>
                    {it[4] && <div className="mt-1 text-[10px] font-semibold" style={{ color: C.err }}>↳ {it[4]}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
