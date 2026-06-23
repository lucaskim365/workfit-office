import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';

const RES_GAGES = [
  { sn: 'CAL-2305-007', name: '디지털 압력계', tol: '±0.25 %FS', unit: '%FS' },
  { sn: 'CAL-2403-019', name: '외측 마이크로미터', tol: '±0.001 mm', unit: 'mm' },
  { sn: 'CAL-2402-022', name: '표준 온도센서(RTD)', tol: '±0.05 ℃', unit: '℃' },
  { sn: 'CAL-2312-014', name: '정밀 전자저울', tol: '±0.1 g', unit: 'g' },
];
interface Tx { no: string; date: string; sn: string; name: string; org: string; result: string; err: string; tol: string; cert: string; barcode: string; who: string }
const RES_TX: Tx[] = [
  { no: 'CR-2606-022', date: '06-18', sn: 'CAL-2305-007', name: '디지털 압력계', org: '한국계량기기', result: '불합격', err: '+0.42 %FS', tol: '±0.25 %FS', cert: 'CERT-26-1182', barcode: '8809-2606-0072', who: '이검교' },
  { no: 'CR-2606-021', date: '06-15', sn: 'CAL-2208-003', name: '하이트게이지', org: '사내 교정실', result: '합격', err: '+0.012 mm', tol: '±0.03 mm', cert: 'CERT-26-1175', barcode: '8809-2606-0061', who: '김품질' },
  { no: 'CR-2606-020', date: '06-12', sn: 'CAL-2401-001', name: '디지털 버니어캘리퍼스', org: '사내 교정실', result: '합격', err: '−0.008 mm', tol: '±0.02 mm', cert: 'CERT-26-1169', barcode: '8809-2606-0058', who: '김품질' },
  { no: 'CR-2606-019', date: '06-09', sn: 'CAL-2310-011', name: '디지털 토크렌치', org: '사내 교정실', result: '합격(조정)', err: '−1.8 %', tol: '±3 %', cert: 'CERT-26-1160', barcode: '8809-2606-0049', who: '박설비' },
  { no: 'CR-2606-018', date: '06-05', sn: 'CAL-2402-022', name: '표준 온도센서(RTD)', org: 'KOLAS 인정기관', result: '합격', err: '+0.021 ℃', tol: '±0.05 ℃', cert: 'CERT-26-1151', barcode: '8809-2606-0040', who: '이검교' },
  { no: 'CR-2606-017', date: '06-02', sn: 'CAL-2312-014', name: '정밀 전자저울', org: '한국계량기기', result: '합격', err: '+0.04 g', tol: '±0.1 g', cert: 'CERT-26-1144', barcode: '8809-2606-0031', who: '김품질' },
];
const resTone = (r: string): Tone => (r.startsWith('합격') ? 'ok' : 'err');
const BARS = [3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3];

/** 검교정 실적 등록 — 와이어프레임 cal-result.jsx 정본. */
export default function CalResultScreen() {
  const [sn, setSn] = useState('CAL-2305-007');
  const [result, setResult] = useState('합격');
  const [filter, setFilter] = useState('전체');
  const gage = RES_GAGES.find((g) => g.sn === sn) || RES_GAGES[0];
  const txRows = RES_TX.filter((t) => filter === '전체' || (filter === '합격' ? t.result.startsWith('합격') : t.result === '불합격'));
  const fail = result === '불합격';
  const passCnt = RES_TX.filter((t) => t.result.startsWith('합격')).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">검교정 실적 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 계측기 및 검교정 관리 / 검교정 실적 등록</p>
        </div>
        <ActionBar actions={['download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['당월 검교정', '' + RES_TX.length, '건', C.ink], ['합격', '' + passCnt, '건', C.ok], ['불합격', '' + RES_TX.filter((t) => t.result === '불합격').length, '건', C.err],
        ['합격률', Math.round((passCnt / RES_TX.length) * 100) + '', '%', C.ink], ['성적서 미등록', '0', '건', C.warn],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
        {/* 등록 폼 */}
        <Card title="검교정 실적 등록">
          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">계측기</label>
            <div className="flex flex-col gap-1.5">
              {RES_GAGES.map((g) => {
                const on = g.sn === sn;
                return (
                  <button key={g.sn} onClick={() => setSn(g.sn)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left" style={{ border: `1.5px solid ${on ? C.teal : C.border}`, background: on ? C.tealSoft : '#fff' }}>
                    <span className="rounded-[5px] px-1.5 py-0.5 font-mono text-[8.5px] font-bold" style={{ color: on ? C.teal : C.blue, background: on ? '#fff' : C.bgDeep }}>{g.sn}</span>
                    <span className="flex-1 text-[11px] font-bold text-ink">{g.name}</span>
                    <span className="font-mono text-[10px] text-ink3">{g.tol}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">판정 결과</label>
            <div className="flex overflow-hidden rounded-[9px] border border-border-hi">
              {([['합격', C.teal], ['합격(조정)', C.blue], ['불합격', C.err]] as const).map(([m, c], i) => {
                const on = result === m;
                return <button key={m} onClick={() => setResult(m)} className="flex-1 py-2.5 text-[11px] font-extrabold" style={{ borderRight: i < 2 ? `1px solid ${C.borderHi}` : 'none', background: on ? c : '#fff', color: on ? '#fff' : C.ink3 }}>{m}</button>;
              })}
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">측정 오차값 (허용 {gage.tol})</label>
            <div className="flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 text-[12.5px] font-medium text-ink3">예: +0.012 {gage.unit}</div>
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">검교정 일자</label>
              <div className="flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 font-mono text-[12.5px] font-medium text-ink3">2026-06-21</div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">의뢰기관</label>
              <span className="flex h-9 items-center justify-between rounded-lg border border-border-hi bg-panel px-3 text-[12.5px] font-medium text-ink3">사내 교정실 <span className="text-[8px]">▾</span></span>
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">성적서 첨부</label>
            <div className="rounded-[9px] border-[1.5px] border-dashed border-border-hi px-3 py-3.5 text-center" style={{ background: C.panelAlt }}>
              <div className="text-[16px] text-ink3">⤓</div>
              <div className="mt-0.5 text-[10.5px] font-semibold text-ink3">성적서 PDF 드래그 또는 클릭 업로드</div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-[9px] px-3.5 py-2.5" style={{ background: fail ? '#fdecea' : C.tealSoft }}>
            <div>
              <div className="text-[10px] font-semibold text-ink3">교정 필증 바코드</div>
              <div className="font-mono text-[13px] font-extrabold" style={{ color: fail ? C.err : C.teal }}>{fail ? '발행 불가' : '8809-2606-XXXX'}</div>
            </div>
            <div className="flex h-[26px] items-end gap-[1.5px]" style={{ opacity: fail ? 0.25 : 1 }}>
              {BARS.map((w, i) => <span key={i} className="h-full" style={{ width: w, background: C.ink }} />)}
            </div>
          </div>

          <button className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: fail ? C.err : C.navy }}>{fail ? '불합격 등록 → 자산 처리 연동' : '실적 등록 · 필증 발행'}</button>
        </Card>

        {/* 실적 이력 */}
        <Card
          title="검교정 실적 이력"
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {['전체', '합격', '불합격'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="rounded-[7px] px-3 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${filter === f ? C.teal : C.borderHi}`, background: filter === f ? C.teal : '#fff', color: filter === f ? '#fff' : C.ink2 }}>{f}</button>
              ))}
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['실적번호 / 일자', 'text-left'], ['계측기', 'text-left'], ['측정오차 / 허용', 'text-right'], ['판정', 'text-center'], ['성적서 / 필증', 'text-left']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txRows.map((t, i) => (
                <tr key={t.no} className="align-top" style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5 font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date} · {t.org}</div></td>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{t.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{t.sn}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono">
                    <div className="font-extrabold" style={{ color: t.result === '불합격' ? C.err : C.ink }}>{t.err}</div>
                    <div className="mt-px text-[9px] text-ink3">{t.tol}</div>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={resTone(t.result)}>{t.result}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: C.blue }}>📄 {t.cert}</div>
                    <div className="mt-0.5 font-mono text-[9px]" style={{ color: t.result === '불합격' ? C.ink3 : C.ink2 }}>{t.result === '불합격' ? '필증 미발행' : t.barcode}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
