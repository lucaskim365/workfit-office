import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';

const TYPE_TONE: Record<string, Tone> = { 합격: 'ok', 조건부합격: 'info', 특채: 'warn', 처리: 'info', 불합격: 'err' };
const STOCK_C: Record<string, string> = { ok: C.ok, info: C.blue, warn: C.warn, err: C.err, mute: C.ink3 };

interface Grade { code: string; name: string; type: string; color: string; ship: boolean; rework: boolean; stock: string; stockTone: string; allow: { 치명: boolean; 주요: boolean; 경미: boolean }; approve: string; price: number | null; stages: string[]; use: boolean; desc: string }
const QG_GRADES: Grade[] = [
  { code: 'A', name: 'A급 (양품)', type: '합격', color: C.ok, ship: true, rework: false, stock: '양품 재고', stockTone: 'ok', allow: { 치명: false, 주요: false, 경미: false }, approve: '자동 판정', price: 100, stages: ['수입', '공정', '출하'], use: true, desc: '전 검사항목이 규격 내 — 결함 없는 정상 양품. 즉시 입고·출하 가능.' },
  { code: 'B', name: 'B급 (2급)', type: '조건부합격', color: C.blue, ship: true, rework: false, stock: '등급 재고', stockTone: 'info', allow: { 치명: false, 주요: false, 경미: true }, approve: '검사 담당', price: 85, stages: ['공정', '출하'], use: true, desc: '경미 결함 허용 범위 내. 등급 분리 보관 후 할인 단가로 출하.' },
  { code: 'C', name: 'C급 (특채)', type: '특채', color: C.warn, ship: true, rework: false, stock: '특채 재고', stockTone: 'warn', allow: { 치명: false, 주요: true, 경미: true }, approve: 'MRB 심의 / 고객 승인', price: 70, stages: ['공정', '출하'], use: true, desc: '주요 결함 일부 포함. MRB 심의 및 고객 특채(Waiver) 승인 후 한정 출하.' },
  { code: 'RW', name: '재작업 대상', type: '처리', color: '#9159d6', ship: false, rework: true, stock: '보류 (재작업 대기)', stockTone: 'info', allow: { 치명: false, 주요: true, 경미: true }, approve: '생산 / 품질', price: null, stages: ['공정'], use: true, desc: '재작업으로 양품 전환 가능한 부적합품. 재작업 오더 발행 후 재검사.' },
  { code: 'RG', name: '선별 대상', type: '처리', color: '#3a8ee0', ship: false, rework: false, stock: '보류 (선별 대기)', stockTone: 'info', allow: { 치명: false, 주요: true, 경미: true }, approve: '품질 담당', price: null, stages: ['수입', '공정'], use: true, desc: '혼입 의심 로트. 전수 선별(Sorting) 후 양품/불량 재판정.' },
  { code: 'SC', name: '폐기 (Scrap)', type: '불합격', color: C.err, ship: false, rework: false, stock: '폐기 대기', stockTone: 'err', allow: { 치명: true, 주요: true, 경미: true }, approve: '품질 책임자', price: 0, stages: ['수입', '공정', '출하'], use: true, desc: '재작업 불가 치명 결함. 폐기(Scrap) 처리 및 손실 비용 반영.' },
  { code: 'RT', name: '반품 (협력사)', type: '불합격', color: '#d6603a', ship: false, rework: false, stock: '반품 대기', stockTone: 'err', allow: { 치명: true, 주요: true, 경미: false }, approve: '구매 / 품질', price: 0, stages: ['수입'], use: true, desc: '수입검사 불합격 자재. 협력사 반품서 발행 및 입고 보류 연동.' },
];

/** 품질 등급·조건 마스터 — 와이어프레임 qual-grade.jsx 정본. */
export default function QualGradeScreen() {
  const [sel, setSel] = useState('A');
  const cur = QG_GRADES.find((g) => g.code === sel) || QG_GRADES[0];

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
        ['총 등급·상태', '' + QG_GRADES.length, '종', C.ink],
        ['출하 가능 등급', '' + QG_GRADES.filter((g) => g.ship).length, '종', C.ok],
        ['처리·불합격 상태', '' + QG_GRADES.filter((g) => !g.ship).length, '종', C.err],
        ['사용중', '' + QG_GRADES.filter((g) => g.use).length, '종', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        {/* 목록 */}
        <Card title="등급 · 상태 목록" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{QG_GRADES.length}종</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['등급 / 명칭', 'text-left'], ['판정 유형', 'text-center'], ['출하', 'text-center'], ['재고 상태값', 'text-left'], ['단가율', 'text-right']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QG_GRADES.map((g, i) => {
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
