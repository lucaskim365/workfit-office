import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { materialKinds } from '@/domain/issue/schema';
import { useIssues, useCompleteIssue } from '@/features/issue/useIssues';

const tone = (s: string): Tone => (s === '불출완료' ? 'ok' : 'warn');
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/** 생산 불출 관리 — 데이터: features/issue. 불출완료 시 자재별 재고 차감 반영. */
export default function MatIssuingScreen() {
  const [sel, setSel] = useState<string>();
  const { data: rows = [] } = useIssues();
  const completeIssue = useCompleteIssue();

  const selected = rows.find((r) => r.no === sel);
  const canIssue = !!selected && selected.status !== '불출완료';
  const done = rows.filter((r) => r.status === '불출완료').length;
  const waiting = rows.filter((r) => r.status !== '불출완료').length;
  const kinds = rows.reduce((s, r) => s + materialKinds(r), 0);

  const handleIssue = () => {
    if (canIssue && selected) completeIssue.mutate({ no: selected.no, at: stamp() });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="생산 불출 관리" sub="생산 불출 관리 (Kitting/Issuing)" actions={<ActionBar actions={['download']} />} />
      <MKpis items={[['금일 불출', String(rows.length), '건'], ['불출완료', String(done), '건', 'teal'], ['키팅 대기', String(waiting), '건'], ['불출 자재', String(kinds), '종']]} />
      <Card
        title="라인 불출 / 키팅 현황"
        bodyClassName="p-0"
        action={
          canIssue ? (
            <ActionButton icon="save" label={`${selected!.no} · 불출 처리`} variant="primary" onClick={handleIssue} />
          ) : (
            <span className="text-[10.5px] text-ink3">행 선택 → 불출 처리 · 불출 시 자재별 재고 자동 차감</span>
          )
        }
      >
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['불출번호', '작업지시', '불출 대상', '키트', '자재 종수', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const on = r.no === sel;
              return (
                <tr key={r.no} onClick={() => setSel(r.no)} style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: on ? C.teal : C.ink, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                  <td className={`${td('left')} font-mono text-[11px]`}>{r.wo}</td>
                  <td className={`${td('left')} font-semibold text-ink`}>{r.target}</td>
                  <td className={td('left')}><Pill tone="info">{r.kit}</Pill></td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{materialKinds(r)}종</td>
                  <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
