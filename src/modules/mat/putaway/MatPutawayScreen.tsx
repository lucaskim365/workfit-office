import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, th, td } from '../_mat';
import { usePutawayTasks } from '@/features/putawayTask/usePutawayTasks';

const tone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행' ? 'info' : 'mute');

/** 적치 지시/등록 (Put-away) — 와이어프레임 wms-screens.jsx 정본. */
export default function MatPutawayScreen() {
  const { data: rows = [], isLoading } = usePutawayTasks();

  if (rows.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '적치 지시가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="적치 지시/등록" sub="적치 지시/등록 (Put-away)" actions={<ActionBar actions={['save']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="적치 지시 목록" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">최적 보관 위치 자동 추천</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['추적번호', '품목', '현재위치', '추천 적치위치', '단위', '상태'].map((c, i) => <th key={c} className={th(i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.lot} style={{ background: i === 0 ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: i === 0 ? C.teal : C.ink, borderLeft: i === 0 ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.lot}</td>
                  <td className={`${td('left')} font-mono text-[11px]`}>{r.code}</td>
                  <td className={`${td('left')} text-ink3`}>{r.from}</td>
                  <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[11px] font-bold" style={{ color: C.teal, background: C.tealSoft }}>{r.to}</span></td>
                  <td className={td('left')}>{r.unit}</td>
                  <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="스캔 적치">
          <div className="flex flex-col gap-3 rounded-xl p-4" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
            <div className="text-center">
              <div className="text-[10.5px] font-semibold text-ink3">적치 대상</div>
              <div className="mt-0.5 font-mono text-[15px] font-extrabold text-ink">LOT-RAW-8821</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-[9px] bg-panel px-3.5 py-3" style={{ border: `1px solid ${C.borderHi}` }}>
              <span className="text-[15px]">▦</span><span className="flex-1 text-[11.5px] text-ink3">① 자재 라벨 스캔</span><span className="font-extrabold" style={{ color: C.ok }}>✓</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-[9px] bg-panel px-3.5 py-3" style={{ border: `1.5px solid ${C.teal}` }}>
              <span className="text-[15px]" style={{ color: C.teal }}>▤</span><span className="flex-1 text-[11.5px] font-semibold text-ink">② 위치 라벨 스캔 (A-1-2-1)</span>
            </div>
            <div className="flex justify-end"><ActionButton icon="save" label="적치 확정" variant="primary" /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
