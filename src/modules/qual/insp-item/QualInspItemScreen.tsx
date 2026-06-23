import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs, SearchBox } from '../_qual';

const QI_GROUP: Record<string, Tone> = { 치수: 'info', 외관: 'warn', 중량: 'ok', 온도: 'err', 물성: 'mute', 전기: 'info' };
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');

interface Item { code: string; name: string; group: string; type: '계량' | '계수'; unit: string; method: string; gage: string; nominal?: number | null; usl?: number | null; lsl?: number | null; digits?: number; judge?: string; sampling: string; severity: string; stages: string[]; defect: string; state: string; updated: string }
const QITEMS: Item[] = [
  { code: 'QI-DIM-001', name: '외경(O.D)', group: '치수', type: '계량', unit: 'mm', method: '버니어캘리퍼스', gage: 'CAL-2401-001', nominal: 25.0, usl: 25.05, lsl: 24.95, digits: 2, sampling: '샘플링', severity: '주요', stages: ['수입', '공정', '출하'], defect: 'D-DIM-OS', state: '사용', updated: '2026-05-18' },
  { code: 'QI-DIM-002', name: '내경(I.D)', group: '치수', type: '계량', unit: 'mm', method: '외측 마이크로미터', gage: 'CAL-2403-019', nominal: 12.0, usl: 12.02, lsl: 11.98, digits: 2, sampling: '샘플링', severity: '주요', stages: ['공정', '출하'], defect: 'D-DIM-US', state: '사용', updated: '2026-05-18' },
  { code: 'QI-DIM-003', name: '전장(Length)', group: '치수', type: '계량', unit: 'mm', method: '하이트게이지', gage: 'CAL-2208-003', nominal: 150.0, usl: 150.3, lsl: 149.7, digits: 1, sampling: '샘플링', severity: '경미', stages: ['공정'], defect: 'D-DIM-LN', state: '사용', updated: '2026-04-30' },
  { code: 'QI-WT-001', name: '제품 중량', group: '중량', type: '계량', unit: 'g', method: '정밀 전자저울', gage: 'CAL-2312-014', nominal: 320.0, usl: 325.0, lsl: 315.0, digits: 1, sampling: '샘플링', severity: '주요', stages: ['공정', '출하'], defect: 'D-WT-OV', state: '사용', updated: '2026-06-02' },
  { code: 'QI-AP-001', name: '표면 스크래치', group: '외관', type: '계수', unit: '-', method: '육안검사', gage: '-', judge: '길이 0.5mm 초과 스크래치 無', sampling: '전수', severity: '치명', stages: ['공정', '출하'], defect: 'D-AP-SC', state: '사용', updated: '2026-06-10' },
  { code: 'QI-AP-002', name: '도장 색상/광택', group: '외관', type: '계수', unit: '-', method: '색차계 / 한도견본', gage: 'CAL-2406-030', judge: '한도견본 대비 ΔE ≤ 1.5', sampling: '샘플링', severity: '주요', stages: ['공정', '출하'], defect: 'D-AP-CL', state: '사용', updated: '2026-05-22' },
  { code: 'QI-AP-003', name: '버(Burr)·이물', group: '외관', type: '계수', unit: '-', method: '육안검사', gage: '-', judge: '버·이물·오염 無 (한도견본 기준)', sampling: '전수', severity: '치명', stages: ['수입', '공정', '출하'], defect: 'D-AP-BR', state: '사용', updated: '2026-06-10' },
  { code: 'QI-TMP-001', name: '사출 수지온도', group: '온도', type: '계량', unit: '℃', method: '표면 온도센서', gage: 'CAL-2402-022', nominal: 230, usl: 235, lsl: 225, digits: 0, sampling: '샘플링', severity: '주요', stages: ['공정'], defect: 'D-PR-TMP', state: '사용', updated: '2026-03-14' },
  { code: 'QI-PRP-001', name: '인장강도', group: '물성', type: '계량', unit: 'MPa', method: '만능재료시험기', gage: 'UTM-01', nominal: null, usl: null, lsl: 45.0, digits: 1, sampling: '샘플링', severity: '치명', stages: ['수입', '출하'], defect: 'D-PR-TS', state: '사용', updated: '2026-02-28' },
  { code: 'QI-PRP-002', name: '표면 경도', group: '물성', type: '계량', unit: 'HRC', method: '로크웰 경도계', gage: 'HRD-02', nominal: 58, usl: 60, lsl: 56, digits: 0, sampling: '샘플링', severity: '주요', stages: ['수입', '공정'], defect: 'D-PR-HD', state: '사용', updated: '2026-01-20' },
  { code: 'QI-EL-001', name: '절연저항', group: '전기', type: '계량', unit: 'MΩ', method: '절연저항계', gage: 'IR-01', nominal: null, usl: null, lsl: 10, digits: 0, sampling: '전수', severity: '치명', stages: ['출하'], defect: 'D-EL-IR', state: '사용', updated: '2026-04-05' },
  { code: 'QI-WT-002', name: '충전량', group: '중량', type: '계량', unit: 'ml', method: '정량 측정기', gage: 'VOL-01', nominal: 500, usl: 503, lsl: 497, digits: 0, sampling: '샘플링', severity: '주요', stages: ['공정'], defect: 'D-WT-FL', state: '미사용', updated: '2025-12-11' },
];

function specText(it: Item) {
  if (it.type === '계수') return it.judge!;
  if (it.nominal == null) return `${it.lsl}${it.unit} 이상`;
  const tol = +(it.usl! - it.nominal).toFixed(it.digits);
  return `${it.nominal.toFixed(it.digits)} ±${tol.toFixed(it.digits)} ${it.unit}`;
}

/** 품질 검사 항목 마스터 — 와이어프레임 qual-insp-item.jsx 정본. */
export default function QualInspItemScreen() {
  const [sel, setSel] = useState('QI-DIM-001');
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState('전체');
  const cur = QITEMS.find((g) => g.code === sel) || QITEMS[0];
  const rows = QITEMS.filter((it) => (grp === '전체' || it.group === grp) && (!q || it.name.includes(q) || it.code.toLowerCase().includes(q.toLowerCase())));
  const isVar = cur.type === '계량';
  const oneSided = isVar && cur.nominal == null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">품질 검사 항목 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 기준정보 / 품질 검사 항목 마스터</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '항목 등록', variant: 'primary' }, 'save', 'upload', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['총 검사 항목', '' + QITEMS.length, '건', C.ink],
        ['계량치 항목', '' + QITEMS.filter((i) => i.type === '계량').length, '건', C.blue],
        ['계수치 항목', '' + QITEMS.filter((i) => i.type === '계수').length, '건', C.teal],
        ['치명 중요도', '' + QITEMS.filter((i) => i.severity === '치명').length, '건', C.err],
        ['미사용', '' + QITEMS.filter((i) => i.state === '미사용').length, '건', C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* 목록 */}
        <Card
          title="검사 항목 목록"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <ChipTabs items={['전체', '치수', '외관', '중량', '온도', '물성']} value={grp} onChange={setGrp} />
              <SearchBox value={q} onChange={setQ} placeholder="코드·항목명" w={100} />
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['코드 / 항목명', 'text-left'], ['그룹', 'text-center'], ['유형', 'text-center'], ['규격 / 판정 기준', 'text-left'], ['중요도', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((it, i) => {
                const on = it.code === sel;
                return (
                  <tr key={it.code} onClick={() => setSel(it.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff', opacity: it.state === '미사용' ? 0.6 : 1 }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{it.name}</div>
                      <div className="mt-px font-mono text-[9.5px] text-ink3">{it.code} · {it.method}</div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={QI_GROUP[it.group]}>{it.group}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><span className="text-[10.5px] font-bold" style={{ color: it.type === '계량' ? C.blue : C.teal }}>{it.type}치</span></td>
                    <td className="border-b border-border px-3 py-2.5 text-ink" style={{ maxWidth: 190, whiteSpace: 'normal', fontFamily: it.type === '계량' ? 'ui-monospace, monospace' : 'inherit', fontWeight: it.type === '계량' ? 700 : 500, fontSize: it.type === '계량' ? 11.5 : 10.5 }}>{specText(it)}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={sevTone(it.severity)}>{it.severity}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={it.state === '사용' ? 'ok' : 'mute'}>{it.state}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="항목 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.code}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-ink">{cur.name}</span>
              <span className="flex gap-1.5"><Pill tone={QI_GROUP[cur.group]}>{cur.group}</Pill><Pill tone={cur.state === '사용' ? 'ok' : 'mute'}>{cur.state}</Pill></span>
            </div>
            <div className="text-[11px] text-ink3">{isVar ? '계량치(측정값)' : '계수치(외관·판정)'} 검사 · {cur.method}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">기본 정보</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['검사 유형', cur.type + '치'], ['측정 단위', cur.unit], ['측정 방식', cur.method], ['사용 계측기', cur.gage], ['샘플링 구분', cur.sampling], ['개정일', cur.updated]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-right text-[11.5px] font-bold text-ink2 ${/^[\d.\-]/.test('' + v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-ink3">{isVar ? '검사 규격 (Spec Limit)' : '판정 기준'}</span>
              <Pill tone={sevTone(cur.severity)}>중요도 {cur.severity}</Pill>
            </div>
            {isVar ? (
              <>
                <div className="flex rounded-[9px] py-3" style={{ background: C.blueSoft }}>
                  {([['하한 (LSL)', cur.lsl == null ? '—' : cur.lsl.toFixed(cur.digits), C.err], ['기준값', cur.nominal == null ? '—' : cur.nominal.toFixed(cur.digits), C.blue], ['상한 (USL)', cur.usl == null ? '—' : cur.usl.toFixed(cur.digits), C.err]] as const).map(([k, v, c], i) => (
                    <div key={k} className="flex-1 text-center" style={{ borderRight: i < 2 ? '1px solid #cfe0f8' : 'none' }}>
                      <div className="font-mono text-[20px] font-extrabold tracking-tight" style={{ color: c }}>{v}</div>
                      <div className="mt-0.5 text-[9px] text-ink3">{k}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 text-center text-[9.5px] text-ink3">단위 {cur.unit} · {oneSided ? '하한 규격(이상) 관리' : '양측 규격 관리'} · 규격 이탈 시 불량 처리</div>
              </>
            ) : (
              <div className="flex items-center gap-2.5 rounded-[9px] px-4 py-3.5" style={{ background: C.tealSoft }}>
                <span className="text-[18px]" style={{ color: C.teal }}>✓</span>
                <span className="text-[12.5px] font-bold leading-snug text-ink">{cur.judge}</span>
              </div>
            )}
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">적용 검사 단계</div>
            <div className="flex gap-2">
              {([['수입', '수입검사 IQC'], ['공정', '공정검사 PQC'], ['출하', '출하검사 OQC']] as const).map(([s, full]) => {
                const on = cur.stages.includes(s);
                return (
                  <div key={s} className="flex-1 rounded-lg px-1 py-2 text-center" style={{ border: `1px solid ${on ? C.teal : C.border}`, background: on ? C.tealSoft : C.panelAlt }}>
                    <div className="text-[12px] font-extrabold" style={{ color: on ? C.teal : C.ink3 }}>{s}</div>
                    <div className="mt-0.5 text-[8.5px]" style={{ color: on ? C.ink2 : C.ink3 }}>{full}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">연계 불량 코드</div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-panel px-3.5 py-2.5">
              <span className="flex items-center gap-2.5">
                <span className="text-[13px]" style={{ color: C.err }}>⚠</span>
                <span className="font-mono text-[11.5px] font-bold text-ink">{cur.defect}</span>
              </span>
              <span className="text-[10.5px] font-bold" style={{ color: C.teal }}>불량 코드 마스터 →</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
