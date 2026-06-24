import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { useJobLogs } from '@/features/jobLog/useJobLogs';
import type { JobLog } from '@/domain/jobLog/schema';

const tone = (s: JobLog['status']): Tone => (s === '진행중' ? 'info' : s === '완료' ? 'ok' : 'mute');

/** 작업 시작/종료 등록 — 와이어프레임 prod-screens.JobStartEndContent 정본. */
export default function JobStartEndScreen() {
  const { data: jobs = [], isLoading } = useJobLogs();
  const [sel, setSel] = useState('WO-260611-021');
  const cur = jobs.find((j) => j.no === sel) ?? jobs[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '작업 목록이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">작업 시작/종료 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 작업 시작/종료 등록 (Job Start/End)</p>
        </div>
        <ActionBar actions={['refresh']} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <Card title="내 작업 목록" action={<span className="text-[10.5px] text-ink3">홍길동 · M-Line</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['지시번호', '품목', '공정', '상태', '시작', '종료'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 3 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const on = j.no === sel;
                  return (
                    <tr key={j.no} onClick={() => setSel(j.no)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3 py-2.5 font-mono text-[11px] font-bold ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{j.no}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-ink2">{j.code}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{j.proc}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={tone(j.status)}>{j.status}</Pill></td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-ink2">{j.start}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-ink2">{j.end}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="작업 개시 / 종료">
          <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-panel-alt p-[18px]">
            <div className="text-center">
              <div className="text-[10.5px] font-semibold text-ink3">선택된 작업</div>
              <div className="mt-0.5 font-mono text-base font-extrabold text-ink">{cur.no}</div>
              <div className="mt-0.5 text-[11.5px] text-ink2">{cur.code} · {cur.proc}</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-[9px] border border-border-hi bg-panel px-3.5 py-2.5">
              <span className="text-[15px]">▦</span>
              <span className="flex-1 text-[11.5px] text-ink3">바코드 / QR 스캔 또는 지시번호 입력</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-teal text-[15px] font-extrabold text-white">
                <span className="text-[19px]">▶</span>작업 시작
              </button>
              <button className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-border-hi bg-panel text-[15px] font-extrabold text-ink2">
                <span className="text-[19px]">■</span>작업 종료
              </button>
            </div>
            <div className="flex justify-between pt-1 text-[11px] text-ink3">
              <span>경과 시간</span>
              <span className="text-[13px] font-extrabold tabular-nums text-ink">01:13:22</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
