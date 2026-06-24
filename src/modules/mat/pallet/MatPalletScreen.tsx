import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { usePallets } from '@/features/pallet/usePallets';

const tone = (s: string): Tone => (s === '사용중' ? 'info' : 'mute');

/** 대차/파레트 관리 — 와이어프레임 wms-screens-3.jsx 정본. */
export default function MatPalletScreen() {
  const { data: rows = [], isLoading } = usePallets();
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="대차/파레트 관리" sub="대차/파레트 관리 (Pallet/Container)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['총 용기', '320', '개'], ['사용중', '214', '개'], ['공용기', '98', '개', 'teal'], ['점검 필요', '8', '개']]} />
      <Card title="이동 용기 추적" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">용기-자재 매핑 현황</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['용기번호', '용기 유형', '적재 품목', '적재 Lot', '현재 위치', '상태'].map((c, i) => <th key={c} className={th(i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '용기가 없습니다.'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} style={{ background: r.urgent ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.urgent ? C.teal : C.ink, borderLeft: r.urgent ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.id}</td>
                <td className={td('left')}><Pill tone="mute">{r.type}</Pill></td>
                <td className={`${td('left')} font-semibold ${r.code === '—' ? 'text-ink3' : 'font-mono text-[11px] text-ink'}`}>{r.code}</td>
                <td className={`${td('left')} ${r.lot === '—' ? 'text-ink3' : 'font-mono text-[11px]'}`}>{r.lot}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] text-ink2" style={{ background: C.bgDeep }}>{r.loc}</span></td>
                <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
