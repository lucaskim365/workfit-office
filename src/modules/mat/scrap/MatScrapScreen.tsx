import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useMatScraps } from '@/features/matScrap/useMatScraps';

const SUMS: [string, number, string][] = [['보존기한 만료', 5, C.warn], ['품질 불량/파손', 4, C.err], ['설계 변경(EO)', 3, C.blue]];
const aTone = (s: string): Tone => (s === '승인완료' ? 'ok' : s === '반려' ? 'err' : 'warn');
const oTone = (s: string): Tone => (s === '반출완료' ? 'ok' : s === '종결' ? 'mute' : 'warn');

/** 불용 및 폐기 자재 관리 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatScrapScreen() {
  const { data: rows = [], isLoading } = useMatScraps();

  if (rows.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '폐기 이력이 없습니다.'}</div>;
  }

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
            {rows.map((r, i) => (
              <tr key={r.no} style={{ background: r.urgent ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.urgent ? C.teal : C.ink, borderLeft: r.urgent ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r.code}</span> <span className="text-[10.5px] text-ink3">{r.name}</span></td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r.lot}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 text-[10px] font-bold text-ink2" style={{ background: C.bgDeep }}>{r.reason}</span></td>
                <td className={td('center')}><Pill tone={aTone(r.approval)} solid={r.approval === '반려'}>{r.approval}</Pill></td>
                <td className={td('center')}><Pill tone={oTone(r.status)}>{r.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
