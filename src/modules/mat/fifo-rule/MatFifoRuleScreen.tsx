import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, th, td } from '../_mat';

type Rule = [group: string, rule: string, basis: string, control: string, on: boolean];
const RULES: Rule[] = [
  ['원자재(웨이퍼)', 'FIFO', '입고일자', '강제', true],
  ['화학약품·가스', 'FEFO', '유효기한', '강제', true],
  ['포토레지스트', 'FEFO', '제조일자', '강제', true],
  ['포장·부자재', 'FIFO', '입고일자', '권고', false],
];
type Lot = [lot: string, recv: string, mfg: string, qty: number, order: number, status: string];
const LOTS: Lot[] = [
  ['LOT-RAW-8810', '2026-05-28', '2026-05-20', 120, 1, '우선'],
  ['LOT-RAW-8821', '2026-06-02', '2026-05-26', 500, 2, '대기'],
  ['LOT-RAW-8830', '2026-06-08', '2026-06-01', 300, 3, '대기'],
  ['LOT-RAW-8835', '2026-06-10', '2026-06-05', 480, 4, '위반선택'],
];

/** 자재 선입선출(FIFO) 룰 관리 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatFifoRuleScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="자재 선입선출(FIFO) 룰 관리" sub="기준정보/설정 / 선입선출(FIFO·FEFO) 룰 관리" actions={<ActionBar actions={['add', 'save']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Card title="품목군별 불출 룰 설정" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">FIFO=입고순 · FEFO=유효기한순</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['품목군', '룰', '기준일자', '통제', '적용'].map((c, i) => <th key={c} className={th(i >= 3 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {RULES.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                  <td className={td('left')}><Pill tone={r[1] === 'FEFO' ? 'warn' : 'info'}>{r[1]}</Pill></td>
                  <td className={td('left')}>{r[2]}</td>
                  <td className={td('center')}><Pill tone={r[3] === '강제' ? 'err' : 'mute'} solid={r[3] === '강제'}>{r[3]}</Pill></td>
                  <td className={td('center')}>
                    <span className="relative inline-block h-[18px] w-[34px] rounded-full align-middle" style={{ background: r[4] ? C.teal : C.borderHi }}>
                      <span className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white" style={{ left: r[4] ? 18 : 2 }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="불출 순서 검증 — WF-300-B" bodyClassName="p-0" action={<span className="text-[10.5px] font-bold" style={{ color: C.err }}>⚠ 순서 위반 시 불출 차단</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['Lot', '입고일', '제조일', '잔량', '순서', '상태'].map((c, i) => <th key={c} className={th(i === 3 ? 'right' : i >= 4 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {LOTS.map((r, i) => {
                const violate = r[5] === '위반선택';
                return (
                  <tr key={i} style={{ background: violate ? '#fdecea' : r[5] === '우선' ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[5] === '우선' ? C.teal : C.ink, borderLeft: r[5] === '우선' ? `3px solid ${C.teal}` : violate ? `3px solid ${C.err}` : '3px solid transparent' }}>{r[0]}</td>
                    <td className={`${td('left')} tabular-nums`}>{r[1]}</td>
                    <td className={`${td('left')} tabular-nums text-ink3`}>{r[2]}</td>
                    <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[3]}</td>
                    <td className={td('center')}><span className="inline-grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold" style={{ background: r[4] === 1 ? C.teal : C.bgDeep, color: r[4] === 1 ? '#fff' : C.ink2 }}>{r[4]}</span></td>
                    <td className={td('center')}><Pill tone={r[5] === '우선' ? 'ok' : violate ? 'err' : 'mute'} solid={violate}>{violate ? 'FIFO 위반' : r[5]}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-[11px] text-ink2" style={{ background: C.panelAlt }}>
            <span style={{ color: C.err }}>●</span> 가장 먼저 입고된 <b className="text-ink">LOT-RAW-8810</b> 우선 불출. 후입고 Lot 선택 시 시스템이 불출을 차단합니다.
          </div>
        </Card>
      </div>
    </div>
  );
}
