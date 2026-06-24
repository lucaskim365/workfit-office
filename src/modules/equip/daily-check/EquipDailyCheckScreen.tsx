import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C } from '../_maint';
import { useDailyChecks, useTransitionDailyCheck } from '@/features/dailyCheck/useDailyChecks';
import { nextStatus } from '@/domain/dailyCheck/status';

interface ChkItem { id: string; name: string; std: string; unit: string; init: 'ok' | 'ng' | null; val: string; note?: string }
const DC_ITEMS: { group: string; items: ChkItem[] }[] = [
  { group: '연마부 (Platen)', items: [
    { id: 'p1', name: '연마 패드 마모도', std: '두께 ≥ 1.2 mm', unit: 'mm', init: 'ok', val: '1.45' },
    { id: 'p2', name: '연마 압력', std: '5.5 ± 0.5 psi', unit: 'psi', init: 'ok', val: '5.6' },
    { id: 'p3', name: '플래튼 회전 이상음', std: '이상음 없음', unit: '', init: 'ok', val: '정상' },
  ] },
  { group: '슬러리 공급부', items: [
    { id: 's1', name: '슬러리 공급 압력', std: '0.2 ~ 0.4 MPa', unit: 'MPa', init: 'ok', val: '0.31' },
    { id: 's2', name: '슬러리 탱크 잔량', std: '≥ 20 %', unit: '%', init: 'ok', val: '34' },
    { id: 's3', name: '공급 배관 누설', std: '누설 없음', unit: '', init: null, val: '' },
  ] },
  { group: '헤드 / 캐리어', items: [
    { id: 'h1', name: '헤드 진공 누설률', std: '≤ 5 mmHg/min', unit: 'mmHg/min', init: 'ok', val: '3.2' },
    { id: 'h2', name: '캐리어 멤브레인 손상', std: '균열·손상 없음', unit: '', init: null, val: '' },
  ] },
  { group: '구동 / 유틸리티', items: [
    { id: 'd1', name: '구동부 윤활 유량', std: '규정 범위 내', unit: '', init: 'ng', val: '윤활유 부족', note: '윤활유 보충 필요 — 보전팀 요청' },
    { id: 'd2', name: 'CDA 공급 압력', std: '0.5 ~ 0.7 MPa', unit: 'MPa', init: null, val: '' },
    { id: 'd3', name: '누수 / 누유', std: '누수·누유 없음', unit: '', init: null, val: '' },
  ] },
];
const dcStTone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행중' ? 'info' : 'mute');
const dotColor = (s: string) => (s === '완료' ? C.ok : s === '진행중' ? C.blue : C.ink3);

/** 일상 점검 관리 — 와이어프레임 equip-daily-check.jsx 정본. */
export default function EquipDailyCheckScreen() {
  const [sel, setSel] = useState('EQ-CMP02');
  const { data: dcEquip, isLoading } = useDailyChecks();
  const transition = useTransitionDailyCheck();
  const flat = DC_ITEMS.flatMap((g) => g.items);
  const initRes: Record<string, 'ok' | 'ng' | null> = {};
  const initVal: Record<string, string> = {};
  flat.forEach((it) => { initRes[it.id] = it.init; initVal[it.id] = it.val || ''; });
  const [res, setRes] = useState(initRes);
  const [vals] = useState(initVal);

  const total = flat.length;
  const okN = flat.filter((it) => res[it.id] === 'ok').length;
  const ngN = flat.filter((it) => res[it.id] === 'ng').length;
  const naN = flat.filter((it) => !res[it.id]).length;
  const pct = Math.round(((okN + ngN) / total) * 100);
  const setJ = (id: string, v: 'ok' | 'ng') => setRes((r) => ({ ...r, [id]: r[id] === v ? null : v }));

  // 로딩/빈 가드 — 화면 출력은 데이터 적재 후 동일.
  if (isLoading || !dcEquip) {
    return <div className="px-1 py-6 text-[12px] text-ink3">불러오는 중…</div>;
  }
  if (dcEquip.length === 0) {
    return <div className="px-1 py-6 text-[12px] text-ink3">점검 대상 설비가 없습니다.</div>;
  }
  const DC_EQUIP = dcEquip;
  const eq = DC_EQUIP.find((e) => e.code === sel) || DC_EQUIP[0];
  /** 선택 설비의 다음 상태로 전이(점검 착수 → 진행중, 점검 완료 → 완료). */
  const advance = (e: { code: string; state: (typeof DC_EQUIP)[number]['state'] }) => {
    const to = nextStatus(e.state);
    if (to) transition.mutate({ code: e.code, to });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">일상 점검 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 보전 및 점검 / 일상 점검 관리</p>
        </div>
        <ActionBar
          actions={[
            'save',
            {
              icon: 'save',
              label: '점검 완료 제출',
              variant: 'primary',
              // 선택 설비의 다음 상태로 전이(미점검→진행중→완료). 완료면 비활성.
              onClick: () => advance(eq),
              disabled: nextStatus(eq.state) == null || transition.isPending,
            },
          ]}
        />
      </div>

      {/* 점검 컨텍스트 바 */}
      <div className="flex flex-wrap items-center gap-[22px] rounded-[11px] px-5 py-3.5 text-white" style={{ background: C.navy }}>
        {[['점검일', '2026-06-10 (수)'], ['교대', '주간 (Day)'], ['점검자', '김설비'], ['점검표', '일상점검 v3.2']].map(([k, v]) => (
          <span key={k} className="flex flex-col gap-0.5">
            <span className="text-[9.5px] font-semibold text-white/55">{k}</span>
            <span className="text-[13px] font-bold">{v}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2.5">
          <span className="text-[9.5px] font-semibold text-white/55">전체 진행</span>
          <span className="text-[13px] font-extrabold" style={{ color: C.teal }}>{DC_EQUIP.filter((e) => e.state === '완료').length}/{DC_EQUIP.length} 설비 완료</span>
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[250px_1fr]">
        {/* 설비 목록 */}
        <Card title="점검 대상 설비" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{DC_EQUIP.length}대</span>}>
          <div className="flex flex-col">
            {DC_EQUIP.map((e, i) => {
              const on = e.code === sel;
              const p = Math.round((e.done / e.total) * 100);
              return (
                <button key={e.code} onClick={() => setSel(e.code)} className="flex flex-col gap-1.5 px-3.5 py-2.5 text-left" style={{ background: on ? C.tealSoft : undefined, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent', borderBottom: i < DC_EQUIP.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="flex w-full items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: dotColor(e.state) }} />
                    <span className="flex-1 text-[12px] font-bold" style={{ color: on ? C.teal : C.ink }}>{e.name}</span>
                    <Pill tone={dcStTone(e.state)}>{e.state}</Pill>
                  </span>
                  <span className="flex w-full items-center gap-2">
                    <span className="h-[5px] flex-1 rounded-[3px]" style={{ background: C.bgDeep }}>
                      <span className="block h-full rounded-[3px]" style={{ width: `${p}%`, background: e.state === '완료' ? C.ok : C.teal }} />
                    </span>
                    <span className="text-[9.5px] font-bold tabular-nums text-ink3">{e.done}/{e.total}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 체크리스트 */}
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="flex items-center gap-3.5 rounded-[11px] border border-border bg-panel px-4 py-3.5 md:col-span-1">
              <div className="relative h-[46px] w-[46px] shrink-0">
                <svg width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" fill="none" stroke={C.bgDeep} strokeWidth="6" /><circle cx="23" cy="23" r="19" fill="none" stroke={C.teal} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 119.4} 119.4`} transform="rotate(-90 23 23)" /></svg>
                <span className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold text-ink">{pct}%</span>
              </div>
              <div><div className="text-[10.5px] font-semibold text-ink3">{eq.name} 진행률</div><div className="text-[13px] font-bold text-ink">{okN + ngN} / {total} 항목</div></div>
            </div>
            {([['정상 (OK)', okN, C.ok], ['비정상 (NG)', ngN, C.err], ['미점검', naN, C.ink3]] as const).map(([l, v, c]) => (
              <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
                <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
                <span className="text-[24px] font-extrabold tabular-nums" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>

          {ngN > 0 && (
            <div className="flex items-center gap-2.5 rounded-[10px] px-4 py-2.5" style={{ background: '#fdecea', border: `1px solid ${C.err}` }}>
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: C.err }}>!</span>
              <span className="text-[12px] font-bold" style={{ color: C.err }}>비정상(NG) 항목 {ngN}건 발생 — 제출 시 자동으로 보전(BM) 작업요청이 생성됩니다.</span>
            </div>
          )}

          {DC_ITEMS.map((g, gi) => (
            <Card key={gi} bodyClassName="p-0" title={g.group} action={<span className="text-[10.5px] text-ink3">{g.items.length}개 항목</span>}>
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="w-[34px] border-b border-border bg-panel-alt px-2.5 py-2 text-center text-[10px] font-bold text-ink3">No</th>
                    <th className="border-b border-border bg-panel-alt px-3 py-2 text-left text-[10px] font-bold text-ink3">점검 항목</th>
                    <th className="border-b border-border bg-panel-alt px-3 py-2 text-left text-[10px] font-bold text-ink3">점검 기준</th>
                    <th className="w-[150px] border-b border-border bg-panel-alt px-3 py-2 text-center text-[10px] font-bold text-ink3">판정</th>
                    <th className="w-[130px] border-b border-border bg-panel-alt px-3 py-2 text-center text-[10px] font-bold text-ink3">측정값 / 비고</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it, ii) => {
                    const j = res[it.id];
                    return (
                      <tr key={it.id} style={{ background: j === 'ng' ? '#fdf2f1' : '#fff' }}>
                        <td className="border-b border-border p-2.5 text-center text-[11px] text-ink3">{ii + 1}</td>
                        <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{it.name}</td>
                        <td className="border-b border-border px-3 py-2.5 text-ink2">{it.std}</td>
                        <td className="border-b border-border px-3 py-2">
                          <div className="flex justify-center gap-1.5">
                            {([['ok', '정상', C.ok], ['ng', '비정상', C.err]] as const).map(([k, lab, c]) => {
                              const on = j === k;
                              return (
                                <button key={k} onClick={() => setJ(it.id, k)} className="flex-1 rounded-[7px] py-[7px] text-[11px] font-bold" style={{ border: `1.5px solid ${on ? c : C.borderHi}`, background: on ? c : '#fff', color: on ? '#fff' : C.ink3 }}>{lab}</button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="border-b border-border px-3 py-2">
                          <div className="flex h-8 items-center rounded-[7px] border px-2.5 text-[11.5px]" style={{ borderColor: C.borderHi, color: vals[it.id] ? (j === 'ng' ? C.err : C.ink) : C.ink3, fontWeight: j === 'ng' ? 700 : 500, background: '#fff' }}>
                            {vals[it.id] || '입력'}{it.unit && vals[it.id] && !isNaN(parseFloat(vals[it.id])) ? ' ' + it.unit : ''}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
