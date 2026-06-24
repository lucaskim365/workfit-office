import { Fragment } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useIqcLinks } from '@/features/iqcLink/useIqcLinks';

const FLOW: [string, string, boolean][] = [['입고', 'IQC 대기', false], ['수입검사', '판정 진행', false], ['합격', '가용재고(Available) 전환', true]];
const stTone = (s: string): Tone => (s === 'IQC 합격' ? 'ok' : s === 'IQC 불합격' ? 'err' : s === 'IQC 진행' ? 'info' : 'warn');

/** 수입검사(IQC) 상태 연동 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatIqcLinkScreen() {
  const { data: rows = [], isLoading } = useIqcLinks();
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="수입검사(IQC) 상태 연동" sub="입고 / 수입검사(IQC) 상태 연동 (Quality Gate)" actions={<ActionBar actions={['refresh', 'download']} />} />
      <MKpis items={[['입고 보류 중', '3', '건'], ['IQC 대기/진행', '2', '건'], ['합격 → 가용전환', '2', '건', 'teal'], ['불합격 보류', '1', '건']]} />
      <Card title="품질 게이트 흐름">
        <div className="flex items-stretch">
          {FLOW.map((f, i) => (
            <Fragment key={i}>
              <div className="flex flex-1 flex-col gap-1.5 rounded-[10px] px-4 py-3.5" style={{ background: f[2] ? C.tealSoft : C.panelAlt, border: `1px solid ${f[2] ? C.teal + '55' : C.border}` }}>
                <span className="text-[12.5px] font-extrabold" style={{ color: f[2] ? C.teal : C.ink }}>{f[0]}</span>
                <span className="text-[10.5px] text-ink2">{f[1]}</span>
                <span className="mt-0.5 text-[9.5px] font-bold" style={{ color: f[2] ? C.teal : C.ink3 }}>{f[2] ? '✓ 가용재고 반영' : '✕ 가용재고 미반영'}</span>
              </div>
              {i < FLOW.length - 1 && <div className="grid w-[34px] place-items-center text-[18px] text-ink3">→</div>}
            </Fragment>
          ))}
        </div>
      </Card>
      <Card title="입고 Lot별 IQC 상태 · 가용재고 반영" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">합격 판정 전까지 가용재고(Available Stock) 제외</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['추적번호(Lot)', '품목', '입고수량', 'IQC 상태', '가용재고 반영', '처리'].map((c, i) => <th key={c} className={th(i === 2 ? 'right' : i >= 4 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td className={td('left')} colSpan={6}>불러오는 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className={td('left')} colSpan={6}>입고 Lot이 없습니다.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.lot} style={{ background: r.available ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.available ? C.teal : C.ink, borderLeft: r.available ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.lot}</td>
                  <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r.code}</span> <span className="text-[10.5px] text-ink3">{r.name}</span></td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty.toLocaleString()}</td>
                  <td className={td('left')}><Pill tone={stTone(r.iqcStatus)} solid={r.iqcStatus === 'IQC 불합격'}>{r.iqcStatus}</Pill></td>
                  <td className={td('center')}>{r.available ? <span className="text-[10.5px] font-extrabold" style={{ color: C.teal }}>✓ 반영</span> : <span className="text-[10.5px] font-bold text-ink3">✕ 제외</span>}</td>
                  <td className={td('center')}><span className="rounded-[5px] px-2 py-0.5 text-[10px] font-bold text-ink2" style={{ background: C.bgDeep }}>{r.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
