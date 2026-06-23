import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [lot: string, code: string, name: string, exp: string, dleft: number];
const ROWS: Row[] = [
  ['LOT-RES-1102', 'RES-PR-22', '포토레지스트', '2026-06-15', 4],
  ['LOT-CHM-0440', 'CHM-SL-05', '슬러리 SL-05', '2026-06-20', 9],
  ['LOT-CHM-0099', 'CHM-GAS-02', '공정 가스', '2026-06-12', 1],
  ['LOT-RES-1120', 'RES-PR-22', '포토레지스트', '2026-07-10', 29],
  ['LOT-CHM-0457', 'CHM-SL-05', '슬러리 SL-05', '2026-08-01', 51],
];
const tone = (d: number): Tone => (d <= 2 ? 'err' : d <= 5 ? 'warn' : d <= 14 ? 'info' : 'ok');
const lbl = (d: number) => (d <= 2 ? '긴급' : d <= 5 ? '임박' : d <= 14 ? '주의' : '정상');

/** 재고 보존 기한 관리 — 와이어프레임 wms-screens-3.jsx 정본. */
export default function MatAgingScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="재고 보존 기한 관리" sub="재고 보존 기한 관리 (Aging/Expiry)" actions={<ActionBar actions={['download']} />} />
      <MKpis items={[['유효기한 품목', '64', '종'], ['기한 임박(7일)', '6', '건'], ['기한 긴급(2일)', '2', '건', 'err'], ['만료 폐기', '1', '건']]} />
      <Card title="유효기간 추적 (FEFO)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">기한 임박 시 자동 경고</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['Lot 번호', '품목', '품목명', '유효기한', '잔여일', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[4] <= 2 ? '#fdeceb' : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r[1]}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r[2]}</td>
                <td className={`${td('left')} tabular-nums`}>{r[3]}</td>
                <td className={`${td('right')} font-extrabold tabular-nums`} style={{ color: r[4] <= 2 ? C.err : r[4] <= 5 ? C.warn : C.ink2 }}>D-{r[4]}</td>
                <td className={td('center')}><Pill tone={tone(r[4])} solid={r[4] <= 2}>{lbl(r[4])}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
