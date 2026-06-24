import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, th, td } from '../_mat';
import { useAdjustments } from '@/features/adjustment/useAdjustments';

const tone = (s: string): Tone => (s === '승인완료' ? 'ok' : 'warn');

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><span className="text-[10.5px] font-semibold text-ink3">{label}</span>{children}</div>;
}
function Box({ value, bold }: { value: string; bold?: boolean }) {
  return <span className={`flex h-9 items-center rounded-md border border-border-hi bg-panel px-3 font-mono text-[12.5px] ${bold ? 'font-bold text-ink' : 'text-ink2'}`}>{value}</span>;
}

/** 재고 조정 등록 — 와이어프레임 wms-screens-3.jsx 정본. */
export default function MatAdjustScreen() {
  const { data: rows = [], isLoading } = useAdjustments();

  if (rows.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '재고 조정 내역이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="재고 조정 등록" sub="재고 조정 등록 (Stock Adjustment)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="재고 조정 내역" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">전산-실물 차이 보정</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['조정번호', '품목', '위치', '조정수량', '사유', '상태'].map((c, i) => <th key={c} className={th(i === 3 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.no} style={{ background: r.urgent ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.urgent ? C.teal : C.ink, borderLeft: r.urgent ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                  <td className={`${td('left')} font-mono text-[11px] font-semibold text-ink`}>{r.code}</td>
                  <td className={`${td('left')} font-mono text-[10.5px]`}>{r.loc}</td>
                  <td className={`${td('right')} font-extrabold tabular-nums`} style={{ color: r.qty[0] === '-' ? C.err : C.warn }}>{r.qty}</td>
                  <td className={td('left')}>{r.reason}</td>
                  <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="조정 등록">
          <div className="flex flex-col gap-3">
            <Field label="품목"><Box value="WF-200-A" bold /></Field>
            <Field label="위치"><Box value="A-1-2-1" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="전산"><Box value="3,100" /></Field>
              <Field label="실물"><Box value="3,085" bold /></Field>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5" style={{ background: '#fdeceb' }}>
              <span className="text-[11.5px] font-semibold text-ink2">조정 수량</span>
              <span className="ml-auto text-[17px] font-extrabold tabular-nums" style={{ color: C.err }}>-15</span>
            </div>
            <Field label="사유"><span className="flex h-9 items-center justify-between rounded-md border border-border-hi bg-panel px-3 text-[11.5px] font-semibold text-ink">자연 감실 <span className="text-[8px] text-ink3">▾</span></span></Field>
            <div className="flex justify-end"><ActionButton icon="save" label="조정 승인 요청" variant="primary" /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
