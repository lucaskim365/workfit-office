import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';
import { useD8Reports, useTransitionD8 } from '@/features/d8Report/useD8Reports';
import { nextStatus } from '@/domain/d8Report/status';

const D8_ST: Record<string, Tone> = { 작성중: 'warn', 검토: 'info', 발행: 'ok', 고객승인: 'ok' };
const D8_DISC = ['팀 구성', '문제 정의', '봉쇄 조치(임시)', '근본 원인', '시정조치 선정', '시정조치 실행', '재발 방지', '완료·치하'];

/** 8D Report 발행·관리 — 와이어프레임 qual-8d-report.jsx 정본. */
export default function Qual8dReportScreen() {
  const { data: list = [], isLoading } = useD8Reports();
  const transition = useTransitionD8();
  const [sel, setSel] = useState('8D-260620-002');
  const [tab, setTab] = useState('전체');
  const cur = list.find((d) => d.no === sel) || list[0];
  const rows = list.filter((d) => tab === '전체' || (tab === '진행중' ? d.status === '작성중' || d.status === '검토' : d.status === '발행' || d.status === '고객승인'));

  const writing = list.filter((d) => d.status === '작성중' || d.status === '검토').length;
  const issued = list.filter((d) => d.status === '발행' || d.status === '고객승인').length;
  const approved = list.filter((d) => d.status === '고객승인').length;

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '8D 보고서가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">8D Report 발행·관리</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 추적·사후관리 / 8D Report 발행·관리</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '8D 발행', variant: 'primary' }, { icon: 'upload', label: '고객 전송', accent: 'excel' }, 'download']} />
      </div>

      <KpiGrid cols={4} items={[
        ['작성·검토중', '' + writing, '건', C.warn],
        ['발행 완료', '' + issued, '건', C.ok],
        ['고객 승인', '' + approved, '건', C.teal],
        ['평균 작성', '3.2', '일', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.25fr_1.4fr]">
        {/* 목록 */}
        <Card title="8D 보고서 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '진행중', '발행']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['8D / 제목', 'text-left'], ['고객', 'text-left'], ['진척', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => {
                const on = d.no === sel;
                return (
                  <tr key={d.no} onClick={() => setSel(d.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10px] font-bold" style={{ color: on ? C.teal : C.ink }}>{d.no}</div>
                      <div className="mt-0.5 text-[11px] font-bold leading-snug text-ink">{d.title}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-[10.5px]">{d.cust}<div className="text-[9px] text-ink3">{d.owner}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="mb-0.5 font-mono text-[10px] font-extrabold" style={{ color: d.step >= 8 ? C.ok : C.ink }}>D{Math.min(d.step + (d.step < 8 ? 1 : 0), 8)}/8</div>
                      <div className="mx-auto h-[5px] w-[44px] rounded-[3px]" style={{ background: C.bgDeep }}><div className="h-full rounded-[3px]" style={{ width: `${(d.step / 8) * 100}%`, background: d.step >= 8 ? C.ok : C.teal }} /></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={D8_ST[d.status]} solid={d.status === '고객승인'}>{d.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 문서 */}
        <Card title="8D 보고서" bodyClassName="p-0" action={<Pill tone={D8_ST[cur.status]} solid={cur.status === '고객승인'}>{cur.status}</Pill>}>
          <div className="px-4 py-3.5" style={{ borderBottom: `2px solid ${C.navy}`, background: C.panelAlt }}>
            <div className="flex items-baseline justify-between"><span className="text-[14px] font-extrabold" style={{ color: C.navy }}>8D 문제해결 보고서</span><span className="font-mono text-[9.5px] text-ink3">{cur.no}</span></div>
            <div className="mt-1 text-[12px] font-bold text-ink">{cur.title}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-[9.5px] text-ink3">
              <span>고객 <b className="text-ink2">{cur.cust}</b></span>
              <span>담당 <b className="text-ink2">{cur.owner}</b></span>
              <span>발행 <b className="font-mono text-ink2">{cur.date}</b></span>
              {cur.voc !== '—' && <span className="font-mono" style={{ color: C.blue }}>{cur.voc}</span>}
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1 border-b border-border px-4 py-3">
            {D8_DISC.map((_, i) => {
              const done = i < cur.step;
              const active = i === cur.step;
              return <div key={i} className="flex h-[22px] items-center justify-center rounded-[5px] text-[9px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? C.navy : '#fff', border: done || active ? 'none' : `1px solid ${C.borderHi}` }}>{done ? '✓' : 'D' + (i + 1)}</div>;
            })}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {D8_DISC.map((title, i) => {
              const filled = cur.body[i] && cur.body[i].length > 0;
              const active = i === cur.step;
              return (
                <div key={i} className="flex gap-3 px-4 py-3" style={{ borderBottom: i < 7 ? `1px solid ${C.border}` : 'none', background: active ? '#fbfcfe' : '#fff' }}>
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold" style={{ color: filled ? '#fff' : active ? C.navy : C.ink3, background: filled ? C.ok : active ? C.blueSoft : C.panelAlt, border: active && !filled ? `1.5px solid ${C.navy}` : 'none' }}>D{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="text-[11.5px] font-extrabold text-ink">{title}</span>
                      {filled ? <Pill tone="ok">완료</Pill> : active ? <Pill tone="warn">작성중</Pill> : <Pill tone="mute">대기</Pill>}
                    </div>
                    {filled ? <div className="text-[10px] leading-relaxed text-ink2">{cur.body[i]}</div> : <div className="text-[10px] italic text-ink3">{active ? '내용 작성 필요' : '이전 단계 완료 후 진행'}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 border-t border-border px-4 py-3.5">
            <button
              onClick={() => {
                const to = nextStatus(cur.status);
                if (to) transition.mutate({ no: cur.no, to });
              }}
              className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white disabled:cursor-not-allowed"
              disabled={cur.step < 8 || transition.isPending}
              style={{ background: cur.step >= 8 ? C.navy : C.borderHi }}
            >{cur.status === '고객승인' ? '승인 완료됨' : cur.step >= 8 ? '8D 발행·고객 전송 →' : `D${cur.step + 1} 작성 진행`}</button>
            <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">PDF</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
