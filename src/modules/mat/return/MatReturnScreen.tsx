import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useMatReturns } from '@/features/matReturn/useMatReturns';

const tone = (s: string): Tone => (s === '처리완료' ? 'ok' : 'warn');

/** 반품/환수 관리 — 와이어프레임 wms-screens.jsx 정본. */
export default function MatReturnScreen() {
  const { data: rows = [], isLoading } = useMatReturns();

  if (rows.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '반품/환수 내역이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="반품/환수 관리" sub="반품/환수 관리 (Return Management)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['반품/환수', '8', '건'], ['협력사 반품', '5', '건'], ['창고 환수', '3', '건'], ['처리완료', '6', '건', 'teal']]} />
      <Card title="반품 · 환수 내역" bodyClassName="p-0">
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['반품번호', '품목', '유형', '대상', '수량', '사유', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.no} style={{ background: r.urgent ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.urgent ? C.teal : C.ink, borderLeft: r.urgent ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r.code}</span> <span className="text-[10.5px] text-ink3">{r.name}</span></td>
                <td className={td('left')}><Pill tone={r.type === '협력사 반품' ? 'warn' : 'info'}>{r.type}</Pill></td>
                <td className={td('left')}>{r.vendor}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                <td className={td('left')}>{r.reason}</td>
                <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
