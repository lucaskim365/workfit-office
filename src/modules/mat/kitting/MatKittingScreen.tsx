import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useKits } from '@/features/kit/useKits';

type Part = [code: string, name: string, need: number, ready: number, ok: boolean];
const PARTS: Part[] = [
  ['CMP-IC-3301', '메인 컨트롤러 IC', 1, 1, true],
  ['CMP-CAP-08', '적층 세라믹 콘덴서', 12, 12, true],
  ['CMP-RES-22', '칩 저항 22Ω', 8, 8, true],
  ['CMP-CON-14', '보드 커넥터', 2, 2, true],
  ['CMP-PCB-A1', '메인 PCB', 1, 0, false],
  ['CMP-SHD-02', 'EMI 쉴드캔', 1, 0, false],
];
const tone = (s: string): Tone => (s === '완료' ? 'ok' : s === '준비중' ? 'info' : 'mute');

/** 자재 키팅(Kitting) 작업 관리 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatKittingScreen() {
  const { data: kits = [], isLoading } = useKits();

  if (kits.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '키팅 지시가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="자재 키팅(Kitting) 작업 관리" sub="불출 / 자재 키팅(Kitting) 작업 관리" actions={<ActionBar actions={['add', 'save']} />} />
      <MKpis items={[['키팅 지시', '7', '건'], ['준비중', '1', '건', 'teal'], ['완료', '3', '건'], ['구성 부품', '32', '종']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Card title="키팅 지시 목록" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">작업지시별 Set 구성</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['키트번호', '작업지시', '작업장', '구성', '상태'].map((c, i) => <th key={c} className={th(i >= 3 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {kits.map((r, i) => (
                <tr key={r.no} style={{ background: i === 0 ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: i === 0 ? C.teal : C.ink, borderLeft: i === 0 ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                  <td className={`${td('left')} font-mono text-[10.5px]`}>{r.wo}</td>
                  <td className={td('left')}>{r.line}</td>
                  <td className={td('center')}><span className="text-[11px] font-bold text-ink">{r.done}/{r.count}</span><span className="text-[10px] text-ink3"> 종</span></td>
                  <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="KIT-260611-04 구성 부품 체크리스트" bodyClassName="p-0" action={<span className="text-[10.5px] font-bold" style={{ color: C.teal }}>4/6 준비완료</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['부품', '필요', '준비', '확인'].map((c, i) => <th key={c} className={th(i >= 1 && i <= 2 ? 'right' : i === 3 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {PARTS.map((r, i) => (
                <tr key={i} style={{ background: r[4] ? '#fff' : '#fdf6e8' }}>
                  <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r[0]}</span> <span className="text-[10.5px] text-ink3">{r[1]}</span></td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r[2]}</td>
                  <td className={`${td('right')} font-bold tabular-nums`} style={{ color: r[4] ? C.ink : C.warn }}>{r[3]}</td>
                  <td className={td('center')}>{r[4] ? <span className="inline-grid h-5 w-5 place-items-center rounded-full text-[11px] font-extrabold text-white" style={{ background: C.ok }}>✓</span> : <span className="cursor-pointer rounded-md bg-panel px-2 py-0.5 text-[10px] font-bold" style={{ color: C.warn, border: `1px solid ${C.warn}55` }}>피킹</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-3" style={{ background: C.panelAlt }}>
            <span className="text-[11px] text-ink2">잔여 2종 피킹 후 키트 구성 완료 처리</span>
            <ActionButton icon="save" label="구성 완료" variant="primary" />
          </div>
        </Card>
      </div>
    </div>
  );
}
