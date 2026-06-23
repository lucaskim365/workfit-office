import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';

interface Row { no: string; sn: string; name: string; cat: string; failDate: string; err: string; tol: string; dept: string; dispo: string; note: string }
const FAIL_ROWS: Row[] = [
  { no: 'CR-2606-022', sn: 'CAL-2305-007', name: '디지털 압력계', cat: '압력계', failDate: '06-18', err: '+0.42 %FS', tol: '±0.25 %FS', dept: '설비팀', dispo: '미조치', note: '드리프트 과다 — 센서 모듈 점검 필요' },
  { no: 'CR-2604-009', sn: 'CAL-2310-099', name: '구형 토크렌치', cat: '토크렌치', failDate: '04-22', err: '+5.4 %', tol: '±3 %', dept: '설비팀', dispo: '수리신청', note: '교정 조정 한계 초과 — 외주 수리 의뢰' },
  { no: 'CR-2603-014', sn: 'CAL-2105-040', name: '노후 다이얼게이지', cat: '다이얼게이지', failDate: '03-30', err: '+0.08 mm', tol: '±0.01 mm', dept: '품질팀', dispo: '폐기', note: '스핀들 마모 — 수리 불가 판정' },
  { no: 'CR-2602-007', sn: 'CAL-2208-077', name: '소형 전자저울', cat: '저울', failDate: '02-14', err: '+0.6 g', tol: '±0.1 g', dept: '품질팀', dispo: '사용중지', note: '로드셀 이상 — 사용 중지 후 재검 대기' },
];
const dispoTone = (d: string): Tone => (d === '미조치' ? 'err' : d === '사용중지' ? 'warn' : d === '수리신청' ? 'info' : 'mute');
const ACTIONS: [string, string, string, string][] = [
  ['사용 중지', '즉시 현장에서 회수·라벨 부착', '⛔', C.warn],
  ['수리 신청', '설비 보전 / 외주 수리 의뢰 연동', '⚒', C.blue],
  ['폐기 처리', '예비품 폐기·불용품 관리로 연동', '⊟', C.err],
];

/** 검교정 불합격 자산 처리 — 와이어프레임 cal-fail.jsx 정본. */
export default function CalFailScreen() {
  const [sel, setSel] = useState('CAL-2305-007');
  const cur = FAIL_ROWS.find((r) => r.sn === sel) || FAIL_ROWS[0];

  const noAction = FAIL_ROWS.filter((r) => r.dispo === '미조치').length;
  const stopped = FAIL_ROWS.filter((r) => r.dispo === '사용중지').length;
  const repair = FAIL_ROWS.filter((r) => r.dispo === '수리신청').length;
  const scrap = FAIL_ROWS.filter((r) => r.dispo === '폐기').length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">검교정 불합격 자산 처리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 계측기 및 검교정 관리 / 검교정 불합격 자산 처리</p>
        </div>
        <ActionBar actions={['refresh', 'download']} />
      </div>

      {noAction > 0 && (
        <div className="flex items-center gap-2.5 rounded-[10px] px-4 py-2.5" style={{ background: '#fdecea', border: `1px solid ${C.err}` }}>
          <span className="text-[15px]">⛔</span>
          <span className="text-[12px] font-bold" style={{ color: C.err }}>미조치 불합격 계측기 {noAction}대 — 사용 중지 및 후속 조치(수리/폐기)가 필요합니다.</span>
        </div>
      )}

      <KpiGrid cols={5} items={[
        ['미조치', '' + noAction, '대', C.err], ['사용 중지', '' + stopped, '대', C.warn], ['수리 신청', '' + repair, '대', C.blue], ['폐기 처리', '' + scrap, '대', C.ink], ['총 불합격', '' + FAIL_ROWS.length, '대', C.ink],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_340px]">
        {/* 목록 */}
        <Card title="불합격 계측기 목록" bodyClassName="p-0">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['계측기 / 불합격 실적', 'text-left'], ['측정오차 / 허용', 'text-right'], ['관리부서', 'text-left'], ['조치', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAIL_ROWS.map((r, i) => {
                const on = r.sn === sel;
                return (
                  <tr key={r.sn} onClick={() => setSel(r.sn)} className="cursor-pointer align-top" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="flex items-center gap-1.5">
                        {r.dispo === '미조치' && <span className="text-[12px]">⛔</span>}
                        <div>
                          <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{r.name}</div>
                          <div className="mt-px font-mono text-[9.5px] text-ink3">{r.sn} · {r.no} · {r.failDate}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono"><div className="font-extrabold" style={{ color: C.err }}>{r.err}</div><div className="mt-px text-[9px] text-ink3">{r.tol}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-ink2">{r.dept}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={dispoTone(r.dispo)}>{r.dispo}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 처리 패널 */}
        <Card title="자산 처리" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.sn}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: cur.dispo === '미조치' ? '#fdecea' : C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span>
              <Pill tone={dispoTone(cur.dispo)}>{cur.dispo}</Pill>
            </div>
            <div className="font-mono text-[10.5px] text-ink3">{cur.sn} · {cur.cat}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex">
              {([['측정 오차', cur.err, C.err], ['허용 범위', cur.tol, C.ink2], ['불합격일', cur.failDate, C.ink2]] as const).map(([k, v, c], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <div className="font-mono text-[14px] font-extrabold" style={{ color: c }}>{v}</div>
                  <div className="mt-0.5 text-[9.5px] text-ink3">{k}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg px-3 py-2 text-[10.5px] leading-relaxed text-ink2" style={{ background: C.panelAlt }}><b className="text-ink3">판정 의견 · </b>{cur.note}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">후속 조치 선택</div>
            <div className="flex flex-col gap-2">
              {ACTIONS.map(([t, d, ic, c]) => (
                <button key={t} className="flex items-center gap-2.5 rounded-[9px] border-[1.5px] border-border bg-panel px-3 py-2.5 text-left">
                  <span className="w-[22px] text-center text-[15px]" style={{ color: c }}>{ic}</span>
                  <div className="flex-1">
                    <div className="text-[12px] font-extrabold text-ink">{t}</div>
                    <div className="mt-px text-[9.5px] text-ink3">{d}</div>
                  </div>
                  <span className="text-[12px] text-ink3">›</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-start gap-2 text-[10.5px] leading-relaxed text-ink2">
              <span style={{ color: C.warn }}>ⓘ</span>
              <span>사용 중지 처리 시 해당 계측기는 검사 화면에서 <b className="text-ink">선택 불가</b> 상태가 되며, 마스터 상태가 자동으로 <b style={{ color: C.err }}>사용중지</b>로 전환됩니다.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
