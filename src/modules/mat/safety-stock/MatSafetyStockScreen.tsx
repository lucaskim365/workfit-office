import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, FInput, Bar, th, td } from '../_mat';

type Row = [code: string, name: string, stock: number, min: number, max: number, rop: number, eoq: number, status: string];
const ROWS: Row[] = [
  ['WF-300-B', '300mm 웨이퍼', 320, 500, 3000, 800, 2500, '미달'],
  ['RES-PR-22', '포토레지스트', 46, 40, 200, 70, 120, '발주필요'],
  ['CHM-SL-05', '슬러리 SL-05', 180, 60, 300, 100, 150, '정상'],
  ['PKG-BGA-14', 'BGA 기판', 760, 500, 4000, 1200, 3000, '발주필요'],
  ['CHM-GAS-02', '공정 가스', 28, 30, 120, 50, 80, '미달'],
  ['WF-200-A', '200mm 웨이퍼', 1450, 800, 4000, 1500, 2000, '정상'],
];
const tone = (s: string): Tone => (s === '미달' ? 'err' : s === '발주필요' ? 'warn' : 'ok');

/** 안전재고 및 발주점 관리 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatSafetyStockScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="안전재고 및 발주점 관리" sub="기준정보/설정 / 안전재고 및 발주점 관리 (Safety Stock & ROP)" actions={<ActionBar actions={['add', 'save', 'upload', 'download']} />} />
      <FBar>
        <FField label="창고"><FSel value="원자재 창고" /></FField>
        <FField label="품목군"><FSel /></FField>
        <FField label="상태"><FSel /></FField>
        <FField label="검색"><FInput ph="품목코드 / 품명" w={180} /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="refresh" label="알람 재계산" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['관리 품목', '186', '종'], ['안전재고 미달', '2', '종', 'err'], ['발주점 도달', '2', '종'], ['자동 발주요청', '4', '건']]} />
      <Card title="품목별 안전재고(Min)·최대재고(Max)·발주점(ROP)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">적정 재고 미달 시 구매부서 발주요청 자동 생성</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['품목', '현재고', '안전(Min)', '최대(Max)', '발주점(ROP)', '발주량(EOQ)', '재고수준', '상태', '조치'].map((c, i) => <th key={c} className={th(i >= 1 && i <= 5 ? 'right' : i === 6 ? 'left' : 'center')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => {
              const danger = r[7] !== '정상';
              const pct = Math.min((r[2] / r[5]) * 100, 100);
              const barC = r[7] === '미달' ? C.err : r[7] === '발주필요' ? C.warn : C.teal;
              return (
                <tr key={i} style={{ background: danger ? (r[7] === '미달' ? '#fdecea' : '#fdf6e8') : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-semibold text-ink`} style={{ borderLeft: danger ? `3px solid ${barC}` : '3px solid transparent' }}><span className="font-mono text-[11px] font-bold">{r[0]}</span> <span className="text-[10.5px] text-ink3">{r[1]}</span></td>
                  <td className={`${td('right')} font-extrabold tabular-nums`} style={{ color: danger ? barC : C.ink }}>{r[2].toLocaleString()}</td>
                  <td className={`${td('right')} tabular-nums text-ink3`}>{r[3].toLocaleString()}</td>
                  <td className={`${td('right')} tabular-nums text-ink3`}>{r[4].toLocaleString()}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink2`}>{r[5].toLocaleString()}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r[6].toLocaleString()}</td>
                  <td className={td('left')}><div className="w-[84px]"><Bar v={pct} color={barC} /></div></td>
                  <td className={td('center')}><Pill tone={tone(r[7])} solid={r[7] === '미달'}>{r[7]}</Pill></td>
                  <td className={td('center')}>{danger ? <span className="rounded-md bg-panel px-2 py-0.5 text-[10px] font-bold" style={{ color: C.blue, border: `1px solid ${C.blue}55` }}>발주요청</span> : <span className="text-[10.5px] text-ink3">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
