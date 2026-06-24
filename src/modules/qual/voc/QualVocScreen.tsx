import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';
import { useVocs, useTransitionVoc } from '@/features/voc/useVocs';
import { nextStatus } from '@/domain/voc/status';

const VOC_ST: Record<string, Tone> = { 접수: 'info', 조사중: 'warn', 회신: 'warn', 종결: 'ok' };
const VOC_TYPE: Record<string, string> = { 품질: C.err, 납기: C.warn, 포장: C.blue, 수량: '#8a5cf6', 서비스: C.teal };
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const dueColor = (d: string) => (d === '지연' ? C.err : d === 'D-Day' || d === 'D-1' ? C.warn : C.ink2);

/** 고객 클레임(VOC) 접수 관리 — 와이어프레임 qual-voc.jsx 정본. */
export default function QualVocScreen() {
  const { data: list = [], isLoading } = useVocs();
  const transition = useTransitionVoc();
  const [sel, setSel] = useState('VOC-260621-007');
  const [tab, setTab] = useState('전체');
  const cur = list.find((v) => v.no === sel) || list[0];
  const rows = list.filter((v) => tab === '전체' || (tab === '미종결' ? v.status !== '종결' : v.status === '종결'));

  const open = list.filter((v) => v.status !== '종결').length;
  const urgent = list.filter((v) => v.status !== '종결' && (v.due === '지연' || v.due === 'D-Day' || v.due === 'D-1')).length;
  const quality = list.filter((v) => v.type === '품질').length;

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '접수된 클레임이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">고객 클레임(VOC) 접수 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 추적·사후관리 / 고객 클레임(VOC) 접수 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: 'VOC 접수', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['미처리 VOC', '' + open, '건', C.err],
        ['회신 임박·지연', '' + urgent, '건', C.warn],
        ['금월 접수', '' + list.length, '건', C.ink],
        ['품질 클레임', '' + quality, '건', C.err],
        ['평균 회신', '1.8', '일', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        {/* 목록 */}
        <Card title="고객 클레임 접수 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '미종결', '종결']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['접수번호 / 일자', 'text-left'], ['고객 / 제품', 'text-left'], ['유형', 'text-center'], ['경로', 'text-center'], ['회신기한', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const on = v.no === sel;
                return (
                  <tr key={v.no} onClick={() => setSel(v.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{v.no}</div>
                      <div className="mt-px text-[9px] text-ink3">{v.date}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{v.cust}</div><div className="mt-px text-[9.5px] text-ink3">{v.prod} · {v.lot}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ color: VOC_TYPE[v.type], border: `1px solid ${VOC_TYPE[v.type]}55` }}>{v.type}</span>
                      <div className="mt-1"><Pill tone={sevTone(v.sev)} solid={v.sev === '치명'}>{v.sev}</Pill></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center text-[10px] text-ink2">{v.channel}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center text-[10.5px] font-extrabold" style={{ color: dueColor(v.due) }}>{v.due}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={VOC_ST[v.status]} solid={v.status === '종결'}>{v.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="클레임 상세" bodyClassName="p-0" action={<Pill tone={VOC_ST[cur.status]} solid={cur.status === '종결'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ color: VOC_TYPE[cur.type], border: `1px solid ${VOC_TYPE[cur.type]}` }}>{cur.type} 클레임</span>
              <Pill tone={sevTone(cur.sev)} solid={cur.sev === '치명'}>{cur.sev}</Pill>
              <span className="ml-auto font-mono text-[9px] text-ink3">{cur.no}</span>
            </div>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.cust}</div>
            <div className="mt-0.5 text-[10px] text-ink3">{cur.contact} · {cur.channel} 접수 · {cur.date}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-1.5 text-[10px] font-bold text-ink3">대상 제품</div>
            <div className="mb-2.5 text-[11px] font-bold text-ink">{cur.prod} <span className="font-mono text-[9.5px] font-normal text-ink3">{cur.code} · {cur.lot}{cur.qty ? ` · ${cur.qty}EA` : ''}</span></div>
            <div className="mb-1.5 text-[10px] font-bold text-ink3">클레임 내용</div>
            <div className="mb-2.5 text-[10.5px] leading-relaxed text-ink2">{cur.content}</div>
            <div className="mb-1.5 text-[10px] font-bold text-ink3">고객 요구사항</div>
            <div className="rounded-[7px] px-2.5 py-2 text-[10.5px] leading-relaxed text-ink2" style={{ background: C.panelAlt, borderLeft: `3px solid ${VOC_TYPE[cur.type]}` }}>{cur.req}</div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="mb-1.5 text-[10px] font-bold text-ink3">연계 처리</div>
            <div className="flex flex-wrap gap-1.5">
              {([['NCR', cur.link.ncr], ['8D', cur.link.d8], ['MRB', cur.link.mrb]] as const).map(([k, v]) => (
                <span key={k} className="rounded-md px-2 py-1 font-mono text-[9.5px] font-bold" style={{ color: v === '—' ? C.ink3 : C.blue, background: v === '—' ? C.panelAlt : C.blueSoft }}>{k} {v}</span>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10px] font-bold text-ink3">처리 진행</div>
            <div className="flex flex-col">
              {cur.steps.map((s, i) => {
                const done = s[2] === 1;
                const active = !done && (i === 0 || cur.steps[i - 1][2] === 1);
                const last = i === cur.steps.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8.5px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? C.warn : '#fff', border: done || active ? 'none' : `1.5px solid ${C.borderHi}` }}>{done ? '✓' : i + 1}</span>
                      {!last && <span className="w-0.5 flex-1" style={{ minHeight: 14, background: done ? C.ok : C.border }} />}
                    </div>
                    <div className="flex flex-1 items-baseline justify-between" style={{ paddingBottom: last ? 0 : 11 }}>
                      <span className="text-[10.5px] font-bold" style={{ color: active ? C.warn : done ? C.ink : C.ink3 }}>{s[0]}</span>
                      <span className="font-mono text-[8.5px]" style={{ color: active ? C.warn : C.ink3 }}>{s[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between rounded-[9px] px-3 py-2.5" style={{ background: cur.status === '종결' ? C.tealSoft : cur.due === '지연' ? '#fdf1ef' : '#fef6ec' }}>
              <span className="text-[10px] font-bold text-ink3">회신 SLA</span>
              <span className="text-[12px] font-extrabold" style={{ color: cur.status === '종결' ? C.ok : dueColor(cur.due) }}>{cur.status === '종결' ? '회신 완료' : `회신기한 ${cur.due}`}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const to = nextStatus(cur.status);
                  if (to) transition.mutate({ no: cur.no, to });
                }}
                disabled={cur.status === '종결' || transition.isPending}
                className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: cur.status === '종결' ? C.borderHi : C.navy }}
              >{cur.status === '종결' ? '처리 완료됨' : '고객 회신 등록 →'}</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3 text-[12px] font-bold text-ink2">8D 연계</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
