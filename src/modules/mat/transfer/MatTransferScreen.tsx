import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useTransfers } from '@/features/transfer/useTransfers';

const tone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행' ? 'info' : 'mute');

/** 창고 간 이송 등록 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatTransferScreen() {
  const { data: rows = [], isLoading } = useTransfers();

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="창고 간 이송 등록" sub="창고 간 이송 등록 (Location Transfer)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['금일 이송', '18', '건'], ['진행중', '4', '건'], ['완료', '13', '건', 'teal'], ['이송 수량', '2,840', 'EA']]} />
      <Card title="내부 위치 이송 이력" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">실시간 위치 변경 반영</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['이송번호', '품목', '출발 위치', '도착 위치', '수량', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '이송 이력이 없습니다.'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.no} style={{ background: r.urgent ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.urgent ? C.teal : C.ink, borderLeft: r.urgent ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                <td className={`${td('left')} font-mono text-[11px] font-semibold text-ink`}>{r.code}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] text-ink2" style={{ background: C.bgDeep }}>{r.from}</span></td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] font-bold" style={{ color: C.teal, background: C.tealSoft }}>{r.to}</span></td>
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
