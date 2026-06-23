import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [no: string, code: string, name: string, lot: string, qty: number, reason: string, approve: string, out: string, sel?: boolean];
const ROWS: Row[] = [
  ['SC-260611-02', 'RES-PR-19', '포토레지스트(구)', 'LOT-RES-0901', 18, '보존기한 만료', '승인완료', '반출완료', true],
  ['SC-260611-03', 'CHM-GAS-02', '공정 가스', 'LOT-CHM-0099', 15, '품질 불량', '승인대기', '대기'],
  ['SC-260610-15', 'PKG-BGA-09', 'BGA 기판(구)', 'LOT-PKG-2210', 240, '설계 변경(EO)', '승인완료', '반출대기'],
  ['SC-260610-08', 'WF-200-A', '200mm 웨이퍼', 'LOT-RAW-7740', 12, '파손', '반려', '종결'],
];
const SUMS: [string, number, string][] = [['보존기한 만료', 5, C.warn], ['품질 불량/파손', 4, C.err], ['설계 변경(EO)', 3, C.blue]];
const aTone = (s: string): Tone => (s === '승인완료' ? 'ok' : s === '반려' ? 'err' : 'warn');
const oTone = (s: string): Tone => (s === '반출완료' ? 'ok' : s === '종결' ? 'mute' : 'warn');

/** 불용 및 폐기 자재 관리 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatScrapScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="불용 및 폐기 자재 관리" sub="실사/조정 / 불용 및 폐기(Scrap) 자재 관리" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['폐기 품의', '12', '건'], ['승인대기', '1', '건', 'teal'], ['반출대기', '1', '건'], ['폐기 수량', '285', 'EA']]} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SUMS.map(([l, n, c]) => (
          <Card key={l}>
            <div className="flex items-center justify-between"><span className="text-[11.5px] font-bold text-ink2">{l}</span><span className="h-2 w-2 rounded-full" style={{ background: c }} /></div>
            <div className="mt-1.5 flex items-baseline gap-1"><span className="text-[24px] font-extrabold tabular-nums text-ink">{n}</span><span className="text-[10.5px] font-semibold text-ink3">건</span></div>
          </Card>
        ))}
      </div>
      <Card title="폐기(Scrap) 품의 및 창고 반출 이력" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">품의 승인 후 창고 반출 처리</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['폐기번호', '품목', 'Lot', '수량', '폐기사유', '품의', '반출'].map((c, i) => <th key={c} className={th(i === 3 ? 'right' : i >= 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[8] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[8] ? C.teal : C.ink, borderLeft: r[8] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r[1]}</span> <span className="text-[10.5px] text-ink3">{r[2]}</span></td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r[3]}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[4]}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 text-[10px] font-bold text-ink2" style={{ background: C.bgDeep }}>{r[5]}</span></td>
                <td className={td('center')}><Pill tone={aTone(r[6])} solid={r[6] === '반려'}>{r[6]}</Pill></td>
                <td className={td('center')}><Pill tone={oTone(r[7])}>{r[7]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
