import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useMatRequisitions } from '@/features/matRequisition/useMatRequisitions';

const tone = (s: string): Tone => (s === '승인' ? 'ok' : 'mute');

/** 자재 청구/요청 관리 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatRequestScreen() {
  const { data: rows = [], isLoading } = useMatRequisitions();
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="자재 청구/요청 관리" sub="자재 청구/요청 관리 (Material Request)" actions={<ActionBar actions={['save', 'download']} />} />
      <MKpis items={[['금일 청구', '24', '건'], ['승인', '18', '건', 'teal'], ['대기', '6', '건'], ['청구 품목', '32', '종']]} />
      <Card title="작업지시 기준 자재 청구 (BOM 소요량)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">현장 라인 → 창고 요청</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['청구번호', '작업지시', '품목', '요청 라인', '소요량', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[11px] text-ink3">{isLoading ? '불러오는 중…' : '청구 내역이 없습니다.'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.no} style={{ background: r.urgent ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.urgent ? C.teal : C.ink, borderLeft: r.urgent ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r.wo}</td>
                <td className={`${td('left')} font-mono text-[11px] font-semibold text-ink`}>{r.code}</td>
                <td className={td('left')}>{r.line}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
