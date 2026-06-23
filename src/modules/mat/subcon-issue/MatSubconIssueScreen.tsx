import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, FInput, th, td } from '../_mat';

type Row = [no: string, vendor: string, code: string, name: string, qty: number, type: string, doc: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['SI-260611-11', '대성테크', 'PCB-A1', '메인 PCB', 2000, '무상', '발행완료', '출고완료', true],
  ['SI-260611-12', '한울가공', 'CMP-SHD-02', 'EMI 쉴드캔', 1500, '유상', '발행완료', '출고완료'],
  ['SI-260611-15', '동진정밀', 'WF-200-A', '200mm 웨이퍼', 300, '무상', '미발행', '출고대기'],
  ['SI-260610-30', '서원SMT', 'CMP-CON-14', '보드 커넥터', 5000, '유상', '발행완료', '출고완료'],
];
const tone = (s: string): Tone => (s === '출고완료' ? 'ok' : 'warn');

/** 외주(사급) 자재 출고 관리 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatSubconIssueScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="외주(사급) 자재 출고 관리" sub="외주 자재 관리 / 외주(사급) 자재 출고 관리" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <FBar>
        <FField label="출고일자"><FSel value="2026-06-11" w={130} /></FField>
        <FField label="외주처"><FSel /></FField>
        <FField label="사급유형"><FSel /></FField>
        <FField label="검색"><FInput ph="출고번호 / 품목" w={170} /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="명세서 발행" accent="excel" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금일 출고', '8', '건'], ['무상 사급', '4', '건'], ['유상 사급', '4', '건', 'teal'], ['명세서 미발행', '1', '건']]} />
      <Card title="외주 지급(사급) 자재 출고 내역" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">협력사 무상/유상 지급 · 거래명세서 발행</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['출고번호', '외주처', '품목', '수량', '사급유형', '명세서', '상태'].map((c, i) => <th key={c} className={th(i === 3 ? 'right' : i >= 4 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[8] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[8] ? C.teal : C.ink, borderLeft: r[8] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-bold text-ink`}>{r[1]}</td>
                <td className={td('left')}><span className="font-mono text-[11px]">{r[2]}</span> <span className="text-[10.5px] text-ink3">{r[3]}</span></td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[4].toLocaleString()}</td>
                <td className={td('center')}><Pill tone={r[5] === '유상' ? 'info' : 'mute'}>{r[5]}</Pill></td>
                <td className={td('center')}>{r[6] === '발행완료' ? <span className="text-[10.5px] font-semibold text-ink2">발행완료</span> : <span className="rounded-md bg-panel px-2 py-0.5 text-[10px] font-bold" style={{ color: C.blue, border: `1px solid ${C.blue}55` }}>발행</span>}</td>
                <td className={td('center')}><Pill tone={tone(r[7])}>{r[7]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
