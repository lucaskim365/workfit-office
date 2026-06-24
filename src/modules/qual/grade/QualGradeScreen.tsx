import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';
import { useQualityGrades } from '@/features/qualityGrade/useQualityGrades';

const TYPE_TONE: Record<string, Tone> = { 합격: 'ok', 조건부합격: 'info', 특채: 'warn', 처리: 'info', 불합격: 'err' };
const STOCK_C: Record<string, string> = { ok: C.ok, info: C.blue, warn: C.warn, err: C.err, mute: C.ink3 };

/** 품질 등급·조건 마스터 — 와이어프레임 qual-grade.jsx 정본. */
export default function QualGradeScreen() {
  const { data: grades = [], isLoading } = useQualityGrades();
  const [sel, setSel] = useState('A');
  const cur = grades.find((g) => g.code === sel) || grades[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '등급이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">품질 등급·조건 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 기준정보 / 품질 등급·조건 마스터</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '등급 등록', variant: 'primary' }, 'save', 'download']} />
      </div>

      <KpiGrid cols={4} items={[
        ['총 등급·상태', '' + grades.length, '종', C.ink],
        ['출하 가능 등급', '' + grades.filter((g) => g.ship).length, '종', C.ok],
        ['처리·불합격 상태', '' + grades.filter((g) => !g.ship).length, '종', C.err],
        ['사용중', '' + grades.filter((g) => g.use).length, '종', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        {/* 목록 */}
        <Card title="등급 · 상태 목록" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{grades.length}종</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['등급 / 명칭', 'text-left'], ['판정 유형', 'text-center'], ['출하', 'text-center'], ['재고 상태값', 'text-left'], ['단가율', 'text-right']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.map((g, i) => {
                const on = g.code === sel;
                return (
                  <tr key={g.code} onClick={() => setSel(g.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] font-mono text-[11px] font-extrabold text-white" style={{ background: g.color }}>{g.code}</span>
                        <span>
                          <span className="block font-bold" style={{ color: on ? C.teal : C.ink }}>{g.name}</span>
                          <span className="mt-px block text-[9.5px] text-ink3">승인 {g.approve}</span>
                        </span>
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={TYPE_TONE[g.type]}>{g.type}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><span className="text-[13px] font-extrabold" style={{ color: g.ship ? C.ok : C.ink3 }}>{g.ship ? '○' : '×'}</span></td>
                    <td className="border-b border-border px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-[7px] w-[7px] rounded-full" style={{ background: STOCK_C[g.stockTone] }} />
                        <span className="text-[10.5px] text-ink2">{g.stock}</span>
                      </span>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: g.price == null ? C.ink3 : g.price === 0 ? C.err : C.ink }}>{g.price == null ? '—' : g.price + '%'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="등급 정의" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">GRADE-{cur.code}</span>}>
          <div className="flex items-center gap-3 border-b border-border px-4 py-4" style={{ background: C.panelAlt }}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] font-mono text-[17px] font-extrabold text-white" style={{ background: cur.color }}>{cur.code}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold text-ink">{cur.name}</span>
                <Pill tone={TYPE_TONE[cur.type]}>{cur.type}</Pill>
              </div>
              <div className="mt-0.5 text-[10.5px] text-ink3">승인 단계 · {cur.approve}</div>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3 text-[11.5px] leading-relaxed text-ink2">{cur.desc}</div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">허용 불량 등급</div>
            <div className="flex gap-2">
              {(['치명', '주요', '경미'] as const).map((k) => {
                const ok = cur.allow[k];
                const tone = k === '치명' ? C.err : k === '주요' ? C.warn : C.ink3;
                return (
                  <div key={k} className="flex-1 rounded-lg px-1 py-2 text-center" style={{ border: `1px solid ${ok ? tone : C.border}`, background: ok ? tone + '14' : C.panelAlt }}>
                    <div className="text-[12px] font-extrabold" style={{ color: ok ? tone : C.ink3 }}>{k}</div>
                    <div className="mt-0.5 text-[11px] font-bold" style={{ color: ok ? tone : C.ink3 }}>{ok ? '허용' : '불가'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">처리 및 상태</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
              {([['출하 가능', cur.ship ? '가능' : '불가', cur.ship ? C.ok : C.err], ['재작업', cur.rework ? '대상' : '해당없음', cur.rework ? C.warn : C.ink3], ['등급 단가율', cur.price == null ? '—' : cur.price + ' %', cur.price === 0 ? C.err : C.ink2], ['승인 단계', cur.approve, C.ink2]] as const).map(([k, v, c]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10.5px] text-ink3">{k}</span>
                  <span className="text-right text-[11.5px] font-bold" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">재고 상태값 연동 (WMS / ERP)</div>
            <div className="flex items-center justify-between rounded-[9px] px-3.5 py-2.5" style={{ background: STOCK_C[cur.stockTone] + '14', border: `1px solid ${STOCK_C[cur.stockTone]}33` }}>
              <span className="flex items-center gap-2.5">
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: STOCK_C[cur.stockTone] }} />
                <span className="text-[12.5px] font-extrabold text-ink">{cur.stock}</span>
              </span>
              <span className="text-[10px] text-ink3">판정 시 자동 반영</span>
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">적용 검사 단계</div>
            <div className="flex gap-2">
              {([['수입', 'IQC'], ['공정', 'PQC'], ['출하', 'OQC']] as const).map(([s, full]) => {
                const on = cur.stages.includes(s);
                return (
                  <div key={s} className="flex-1 rounded-lg px-1 py-2 text-center" style={{ border: `1px solid ${on ? C.teal : C.border}`, background: on ? C.tealSoft : C.panelAlt }}>
                    <div className="text-[11.5px] font-extrabold" style={{ color: on ? C.teal : C.ink3 }}>{s}</div>
                    <div className="mt-0.5 text-[8.5px]" style={{ color: on ? C.ink2 : C.ink3 }}>{full}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
