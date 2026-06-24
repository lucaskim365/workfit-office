import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useHoldingStock } from '@/features/holdingStock/useHoldingStock';

const tone = (s: string): Tone => (s === '검사대기' ? 'warn' : 'err');

/** 입고 대기/보류 관리 — 와이어프레임 wms-screens.jsx 정본. */
export default function MatHoldingScreen() {
  const { data: rows = [], isLoading } = useHoldingStock();

  if (!rows.length) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '격리/보류 자재가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="입고 대기/보류 관리" sub="입고 대기/보류 관리 (Holding)" actions={<ActionBar actions={['save', 'download']} />} />
      <MKpis items={[['격리 중', '4', '건'], ['IQC 대기', '2', '건'], ['불합격 보류', '1', '건', 'err'], ['보류 수량', '855', 'EA']]} />
      <Card title="격리/보류 자재" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">수입검사(IQC) 완료 전 이동 제한</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['추적번호', '품목', '보류 사유', '격리 위치', '수량', '상태', '조치'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i >= 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.lot} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r.lot}</td>
                <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r.code}</span> <span className="text-[10.5px] text-ink3">{r.name}</span></td>
                <td className={td('left')}>{r.reason}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 text-[10px] font-bold text-ink2" style={{ background: C.bgDeep }}>{r.loc}</span></td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                <td className={td('center')}><Pill tone={tone(r.status)} solid={r.status === '보류'}>{r.status}</Pill></td>
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
