import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';
import { useAlarmMasters } from '@/features/alarmMaster/useAlarmMasters';
import type { AlarmCode } from '@/domain/alarmMaster/schema';

const SEV: Record<string, { c: string; tone: Tone }> = {
  중대: { c: '#e0564f', tone: 'err' },
  경고: { c: '#ef8f43', tone: 'warn' },
  주의: { c: '#3a6ee0', tone: 'info' },
};

/** 인라인 Code 인터페이스는 alarmMaster 슬라이스(AlarmCode)로 이관됨. */
type Code = AlarmCode;

const TYPES = [
  { key: 'CMP', label: 'CMP (연마)' }, { key: 'Etch', label: 'Etch (식각)' }, { key: 'Photo', label: 'Photo (노광)' },
  { key: 'Depo', label: 'Depo (증착)' }, { key: 'Implant', label: 'Implant (이온주입)' }, { key: 'Thermal', label: 'Thermal (열처리)' }, { key: 'Clean', label: 'Clean (세정)' },
];

function genTrend(code: string, total: number): number[] {
  let seed = code.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  return Array.from({ length: 30 }, () => (rnd() < total / 60 ? Math.ceil(rnd() * 2) : 0));
}

/** 알람·에러 코드 마스터 — 와이어프레임 equip-alarm.jsx 정본. */
export default function EquipErrorCodeScreen() {
  const { data: masters = [], isLoading } = useAlarmMasters();
  /** type별 도큐먼트 → 화면이 쓰던 Record<type, Code[]> 형태로 파생. */
  const CODES: Record<string, Code[]> = Object.fromEntries(masters.map((m) => [m.type, m.codes]));
  const [type, setType] = useState('CMP');
  const list = CODES[type] ?? [];
  const [sel, setSel] = useState('AL-1021');
  const cur = list.find((c) => c.code === sel) ?? list[0];
  const sevCount = (s: string) => list.filter((c) => c.sev === s).length;
  const trend = cur ? genTrend(cur.code, cur.cnt) : [];
  const trendMax = Math.max(1, ...trend);

  const pickType = (k: string) => { setType(k); setSel((CODES[k] ?? [])[0]?.code ?? ''); };

  const ALL = Object.values(CODES).flat();

  if (masters.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '알람 코드가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">알람 · 에러 코드 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 기준정보 관리 / 알람·에러 코드 마스터</p>
        </div>
        <ActionBar actions={['add', 'save', { preset: 'delete' }, 'upload', 'download']} />
      </div>

      <div className="flex gap-2.5">
        {([['전체 코드', ALL.length, T.ink], ['중대(Critical)', ALL.filter((c) => c.sev === '중대').length, SEV['중대'].c], ['경고(Warning)', ALL.filter((c) => c.sev === '경고').length, SEV['경고'].c], ['주의(Caution)', ALL.filter((c) => c.sev === '주의').length, SEV['주의'].c]] as const).map(([l, v, c]) => (
          <div key={l} className="flex flex-1 flex-col gap-1 rounded-[10px] border border-border bg-panel px-4 py-3" style={{ borderTop: `3px solid ${c}` }}>
            <span className="text-[10.5px] font-semibold text-ink3">{l}</span>
            <span className="text-[23px] font-extrabold leading-none tabular-nums" style={{ color: c }}>{v}<span className="text-[12px] font-semibold text-ink3"> 건</span></span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[210px_1fr]">
        <Card title="설비 유형" action={<span className="text-[10px] text-ink3">{TYPES.length}종</span>} bodyClassName="p-1.5">
          <div className="flex flex-col gap-px">
            {TYPES.map((t) => {
              const on = t.key === type;
              const crit = (CODES[t.key] ?? []).filter((c) => c.sev === '중대').length;
              return (
                <button key={t.key} onClick={() => pickType(t.key)} className={`flex items-center gap-2 rounded-r-[7px] px-2.5 py-2 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                  <span className={`flex-1 text-[11.5px] ${on ? 'font-extrabold text-teal' : 'font-semibold text-ink'}`}>{t.label}</span>
                  <span className="text-[10px] font-bold text-ink3">{(CODES[t.key] ?? []).length}</span>
                  {crit > 0 && <span className="rounded-full px-1.5 py-px text-[9px] font-extrabold text-white" style={{ background: SEV['중대'].c }}>{crit}</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title={`${type} 알람 코드`} action={<div className="flex gap-2">{['중대', '경고', '주의'].map((s) => <span key={s} className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: SEV[s].c }}><span className="h-[7px] w-[7px] rounded-full" style={{ background: SEV[s].c }} />{s} {sevCount(s)}</span>)}</div>} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {['코드', '알람 명칭', '등급', '발생 부위', '인터록', '자동복구', '30일 발생'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 6 ? 'text-right' : i === 2 || i === 4 || i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c, i) => {
                    const on = c.code === sel;
                    return (
                      <tr key={c.code} onClick={() => setSel(c.code)} className={`cursor-pointer ${on ? 'bg-teal-soft' : i % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                        <td className="border-b border-border px-3 py-2.5 font-mono font-bold text-teal" style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{c.code}</td>
                        <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{c.name}</td>
                        <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={SEV[c.sev].tone}>{c.sev}</Pill></td>
                        <td className="border-b border-border px-3 py-2.5 text-ink2">{c.part}</td>
                        <td className="border-b border-border px-3 py-2.5 text-center">{c.il ? <span className="rounded bg-danger px-1.5 py-0.5 text-[9px] font-extrabold text-white">ON</span> : <span className="text-ink3">—</span>}</td>
                        <td className={`border-b border-border px-3 py-2.5 text-center font-semibold ${c.auto === '자동' ? 'text-ok' : 'text-ink3'}`}>{c.auto}</td>
                        <td className="border-b border-border px-3 py-2.5 text-right font-bold tabular-nums text-ink">{c.cnt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {cur && (
            <Card bodyClassName="p-0">
              <div className="flex items-center gap-2.5 border-b border-border bg-panel-alt px-4 py-3">
                <span className="font-mono text-[14px] font-extrabold text-teal">{cur.code}</span>
                <span className="text-[13px] font-extrabold text-ink">{cur.name}</span>
                <Pill tone={SEV[cur.sev].tone}>{cur.sev}</Pill>
                {cur.il && <span className="rounded-[5px] bg-danger px-1.5 py-0.5 text-[9.5px] font-extrabold text-white">인터록 발생</span>}
                <span className="ml-auto text-[11px] text-ink3">발생 부위 · <b className="text-ink2">{cur.part}</b></span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="flex flex-col gap-3.5 border-b border-border p-4 md:border-b-0 md:border-r">
                  <div>
                    <div className="mb-1.5 text-[11px] font-extrabold text-ink2">발생 원인</div>
                    <div className="rounded-lg bg-panel-alt px-3 py-2.5 text-[12px] leading-relaxed text-ink2">{cur.cause}</div>
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-extrabold text-ink2">조치 가이드</div>
                    <div className="flex flex-col gap-1.5">
                      {cur.fix.map((f, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-teal text-[10px] font-extrabold text-white">{i + 1}</span>
                          <span className="pt-px text-[12px] leading-relaxed text-ink">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3.5 p-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-ink2">최근 30일 발생 추이</span>
                      <span className="text-[10.5px] text-ink3">총 <b style={{ color: SEV[cur.sev].c }}>{cur.cnt}건</b></span>
                    </div>
                    <div className="flex h-14 items-end gap-0.5 px-0.5">
                      {trend.map((v, i) => (
                        <div key={i} title={`${v}건`} className="flex-1 rounded-sm" style={{ height: v ? `${(v / trendMax) * 100}%` : '2px', minHeight: 2, background: v ? SEV[cur.sev].c : 'var(--color-border)' }} />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-ink3"><span>30일 전</span><span>오늘</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([['MTBA (평균 발생 간격)', cur.mtba], ['최근 발생', cur.last], ['자동 복구', cur.auto], ['연계 점검 항목', cur.chk]] as const).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-0.5 rounded-lg bg-panel-alt px-3 py-2.5">
                        <span className="text-[9.5px] font-semibold text-ink3">{k}</span>
                        <span className="text-[12px] font-bold text-ink">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
