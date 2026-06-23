import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Toggle } from '@/shared/ui/Toggle';

interface Policy {
  name: string;
  cycle: string;
  keep: string;
  after: string;
  size: string;
  on: boolean;
}

const POLICIES: Policy[] = [
  { name: '설비 가동 로그', cycle: '매일 02:00', keep: '90일', after: '아카이브 후 삭제', size: '1.2 GB/일', on: true },
  { name: '사용자 접속 로그', cycle: '매일 02:00', keep: '365일', after: '백업 후 삭제', size: '120 MB/일', on: false },
  { name: '데이터 변경 이력', cycle: '매일 03:00', keep: '365일', after: '백업 보관', size: '340 MB/일', on: false },
  { name: 'SPC 측정 데이터', cycle: '매주 일 04:00', keep: '180일', after: '아카이브 후 삭제', size: '4.6 GB/주', on: false },
  { name: '알람 이력', cycle: '매일 02:30', keep: '180일', after: '백업 후 삭제', size: '85 MB/일', on: false },
  { name: '인터페이스 로그', cycle: '매일 01:00', keep: '30일', after: '즉시 삭제', size: '2.1 GB/일', on: false },
];

const HISTORY: Array<[string, string, string, string, string, string]> = [
  ['2026-06-11 02:00', '설비 가동 로그', '백업', '1.21 GB', '00:04:12', '성공'],
  ['2026-06-11 02:00', '사용자 접속 로그', '백업', '118 MB', '00:00:38', '성공'],
  ['2026-06-11 02:30', '알람 이력', '백업+삭제', '84 MB', '00:00:21', '성공'],
  ['2026-06-11 01:00', '인터페이스 로그', '삭제', '2.08 GB', '00:01:05', '성공'],
  ['2026-06-10 04:00', 'SPC 측정 데이터', '아카이브', '4.55 GB', '00:08:47', '성공'],
  ['2026-06-10 02:00', '설비 가동 로그', '백업', '1.19 GB', '00:03:58', '경고'],
];

const STORAGE: Array<[string, string, string]> = [
  ['운영 데이터', 'bg-navy', '3.2 TB'],
  ['백업/아카이브', 'bg-teal', '1.84 TB'],
  ['로그(삭제 예정)', 'bg-amber', '0.9 TB'],
  ['여유 공간', 'bg-bg-deep border border-border-hi', '2.3 TB'],
];

const afterTone = (a: string): Tone => (a.includes('삭제') ? 'warn' : 'info');
const jobTone = (j: string): Tone => (j.includes('삭제') ? 'warn' : j === '아카이브' ? 'info' : 'ok');
const resTone = (r: string): Tone => (r === '성공' ? 'ok' : r === '경고' ? 'warn' : 'err');

/** 데이터 백업 — 요약 + 저장소 + 백업/삭제 정책 + 이력. 와이어프레임 sys-screens-2.DataBackupContent 정본. */
export default function BackupScreen() {
  const [policies, setPolicies] = useState(POLICIES);
  const toggle = (i: number) => setPolicies((p) => p.map((x, j) => (j === i ? { ...x, on: !x.on } : x)));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">데이터 백업</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 데이터 백업</p>
        </div>
        <ActionBar actions={['save', 'download']} />
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="DB 사용량" value="68.4" unit="%" /></Card>
        <Card>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-ink2">최근 백업</div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ok" />
              <span className="text-[21px] font-extrabold text-teal">성공</span>
              <span className="text-[10.5px] font-semibold text-ink3">02:00</span>
            </div>
          </div>
        </Card>
        <Card><Kpi label="보관 데이터" value="1.84" unit="TB" /></Card>
        <Card><Kpi label="이달 절감" value="312" unit="GB" tone="teal" /></Card>
      </div>

      {/* 저장소 사용 현황 */}
      <Card title="저장소 사용 현황">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex h-4 overflow-hidden rounded-lg bg-bg-deep">
              <div className="bg-navy" style={{ width: '44%' }} />
              <div className="bg-teal" style={{ width: '24%' }} />
              <div className="bg-amber" style={{ width: '12%' }} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-4">
              {STORAGE.map(([label, cls, val]) => (
                <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink2">
                  <span className={`h-2.5 w-2.5 rounded-[3px] ${cls}`} />
                  {label} <b className="text-ink">{val}</b>
                </span>
              ))}
            </div>
          </div>
          <div className="border-l border-border pl-4 text-center">
            <div className="text-[27px] font-extrabold tabular-nums text-ink">68.4%</div>
            <div className="text-[10.5px] font-semibold text-ink3">전체 8.25 TB 중</div>
          </div>
        </div>
      </Card>

      {/* 정책 */}
      <Card title="백업 · 삭제 정책" action={<span className="text-[10.5px] text-ink3">속도 유지를 위한 주기적 로그 백업·삭제</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['대상 데이터', '백업 주기', '보관 기간', '처리 방식', '예상 용량', '활성'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((r, i) => (
                <tr key={r.name} className={r.on ? 'bg-teal-soft' : i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className={`border-b border-border px-3 py-2.5 font-bold whitespace-nowrap ${r.on ? 'text-teal' : 'text-ink'}`} style={r.on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{r.name}</td>
                  <td className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap text-ink2">{r.cycle}</td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap text-ink2">{r.keep}</td>
                  <td className="border-b border-border px-3 py-2.5"><Pill tone={afterTone(r.after)}>{r.after}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap tabular-nums text-ink3">{r.size}</td>
                  <td className="border-b border-border px-3 py-2.5"><div className="flex justify-center"><Toggle on={r.on} onChange={() => toggle(i)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 이력 */}
      <Card title="백업 · 삭제 이력" action={<span className="text-[10.5px] text-ink3">최근 실행 결과</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['실행 일시', '대상', '작업', '용량', '소요시간', '결과'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((r, i) => (
                <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap tabular-nums text-ink3">{r[0]}</td>
                  <td className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap text-ink">{r[1]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={jobTone(r[2])}>{r[2]}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 text-center tabular-nums text-ink2">{r[3]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center tabular-nums text-ink3">{r[4]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={resTone(r[5])}>{r[5]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
