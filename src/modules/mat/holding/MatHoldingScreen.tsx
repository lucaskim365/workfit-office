import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

const ROWS: string[][] = [
  ['LOT-RES-1120', 'RES-PR-22', '포토레지스트', 'IQC 대기', '격리구역 A', '40', '검사대기'],
  ['LOT-CHM-0099', 'CHM-GAS-02', '공정 가스', '불합격', '격리구역 B', '15', '보류'],
  ['LOT-PKG-3320', 'PKG-BGA-14', 'BGA 기판', 'IQC 대기', '격리구역 A', '500', '검사대기'],
  ['LOT-RAW-8830', 'WF-200-A', '200mm 웨이퍼', '조건부 합격', '대기구역 C', '300', '보류'],
];
const tone = (s: string): Tone => (s === '검사대기' ? 'warn' : 'err');

/** 입고 대기/보류 관리 — 와이어프레임 wms-screens.jsx 정본. */
export default function MatHoldingScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="입고 대기/보류 관리" sub="입고 대기/보류 관리 (Holding)" actions={<ActionBar actions={['save', 'download']} />} />
      <MKpis items={[['격리 중', '4', '건'], ['IQC 대기', '2', '건'], ['불합격 보류', '1', '건', 'err'], ['보류 수량', '855', 'EA']]} />
      <Card title="격리/보류 자재" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">수입검사(IQC) 완료 전 이동 제한</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['추적번호', '품목', '보류 사유', '격리 위치', '수량', '상태', '조치'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i >= 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r[1]}</span> <span className="text-[10.5px] text-ink3">{r[2]}</span></td>
                <td className={td('left')}>{r[3]}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 text-[10px] font-bold text-ink2" style={{ background: C.bgDeep }}>{r[4]}</span></td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[5]}</td>
                <td className={td('center')}><Pill tone={tone(r[6])} solid={r[6] === '보류'}>{r[6]}</Pill></td>
                <td className={td('center')}>
                  <span className="inline-flex gap-1">
                    {(['합격', '반품'] as const).map((a) => <span key={a} className="cursor-pointer rounded-md bg-panel px-2 py-0.5 text-[10px] font-bold" style={{ color: a === '합격' ? C.ok : C.err, border: `1px solid ${(a === '합격' ? C.ok : C.err)}55` }}>{a}</span>)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
