import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, Sel, FilterCard, FilterField, ChipTabs, SearchBox } from '../_qual';

const PRIO_TONE: Record<string, Tone> = { 긴급: 'err', 일반: 'mute' };
const ST_TONE: Record<string, Tone> = { 대기: 'info', 검사중: 'warn', 보류: 'mute' };

interface ItemRow { n: string; t: string; s: string }
interface Lot { recv: string; date: string; code: string; name: string; mtype: string; vendor: string; qty: number; unit: string; lot: string; insp: string; letter: string; n: number; ac: number; re: number; level: string; aql: number; prio: string; wait: number; due: string; status: string; pic: string; items: ItemRow[] }
const IQ_LOTS: Lot[] = [
  { recv: 'GR-260621-014', date: '06-21 08:20', code: 'RM-AL6061', name: '알루미늄 빌렛 6061', mtype: '원자재', vendor: '대한금속', qty: 1200, unit: 'EA', lot: 'L2606-0021', insp: '샘플링', letter: 'J', n: 80, ac: 2, re: 3, level: 'II', aql: 1.0, prio: '긴급', wait: 5.2, due: 'D-Day', status: '대기', pic: '김검사', items: [{ n: '외경(O.D)', t: '계량', s: '25.00 ±0.05 mm' }, { n: '표면 경도', t: '계량', s: '58 ±2 HRC' }, { n: '버·이물', t: '계수', s: '버·이물 無' }] },
  { recv: 'GR-260621-013', date: '06-21 08:05', code: 'RM-PA66', name: 'PA66 수지 (검정)', mtype: '원자재', vendor: '코리아폴리머', qty: 3200, unit: 'kg', lot: 'L2606-0020', insp: '샘플링', letter: 'K', n: 125, ac: 3, re: 4, level: 'II', aql: 1.5, prio: '일반', wait: 5.5, due: 'D-1', status: '대기', pic: '미지정', items: [{ n: '인장강도', t: '계량', s: '45.0 MPa 이상' }, { n: '함수율', t: '계량', s: '0.20 % 이하' }] },
  { recv: 'GR-260620-031', date: '06-20 16:40', code: 'SP-BRG-608', name: '베어링 608ZZ', mtype: '부자재', vendor: '정밀베어링', qty: 500, unit: 'EA', lot: 'L2606-0019', insp: '샘플링', letter: 'H', n: 50, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '일반', wait: 21.0, due: 'D-Day', status: '검사중', pic: '이품질', items: [{ n: '내경(I.D)', t: '계량', s: '8.00 ±0.01 mm' }, { n: '회전 토크', t: '계량', s: '규격 내' }, { n: '외관', t: '계수', s: '녹·손상 無' }] },
  { recv: 'GR-260620-028', date: '06-20 14:10', code: 'RM-STS304', name: 'STS304 강판 t2.0', mtype: '원자재', vendor: '동방스틸', qty: 280, unit: 'SHT', lot: 'L2606-0018', insp: '샘플링', letter: 'G', n: 32, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '긴급', wait: 23.5, due: '지연', status: '보류', pic: '이품질', items: [{ n: '두께', t: '계량', s: '2.00 ±0.05 mm' }, { n: '인장강도', t: '계량', s: '520 MPa 이상' }, { n: '표면 스크래치', t: '계수', s: '0.5mm 초과 無' }] },
  { recv: 'GR-260620-022', date: '06-20 11:30', code: 'EL-CON-12P', name: '12P 커넥터 하우징', mtype: '부자재', vendor: '한일전자', qty: 5000, unit: 'EA', lot: 'L2606-0017', insp: '샘플링', letter: 'L', n: 200, ac: 5, re: 6, level: 'II', aql: 1.5, prio: '일반', wait: 26.0, due: 'D-Day', status: '대기', pic: '미지정', items: [{ n: '핀 피치', t: '계량', s: '2.54 ±0.05 mm' }, { n: '절연저항', t: '계량', s: '10 MΩ 이상' }, { n: '버·이물', t: '계수', s: '버·이물 無' }] },
  { recv: 'GR-260619-040', date: '06-19 17:50', code: 'PK-BOX-A', name: '포장 박스 A형', mtype: '부자재', vendor: '한국팩', qty: 2000, unit: 'EA', lot: 'L2606-0016', insp: '전수', letter: '—', n: 2000, ac: 0, re: 1, level: '—', aql: 0, prio: '일반', wait: 39.0, due: 'D-Day', status: '대기', pic: '미지정', items: [{ n: '인쇄 상태', t: '계수', s: '오인쇄·번짐 無' }, { n: '치수', t: '계량', s: '규격 내' }] },
  { recv: 'GR-260619-035', date: '06-19 15:20', code: 'RM-CU-T1', name: '동(Cu) 판재 t1.0', mtype: '원자재', vendor: '대한금속', qty: 90, unit: 'SHT', lot: 'L2606-0015', insp: '샘플링', letter: 'E', n: 13, ac: 0, re: 1, level: 'II', aql: 1.0, prio: '일반', wait: 41.5, due: '지연', status: '검사중', pic: '김검사', items: [{ n: '두께', t: '계량', s: '1.00 ±0.03 mm' }, { n: '전기 전도도', t: '계량', s: '규격 내' }] },
  { recv: 'GR-260619-029', date: '06-19 10:05', code: 'SP-SCR-M4', name: '육각 볼트 M4×10', mtype: '부자재', vendor: '삼화정공', qty: 10000, unit: 'EA', lot: 'L2606-0014', insp: '샘플링', letter: 'M', n: 315, ac: 7, re: 8, level: 'II', aql: 1.5, prio: '일반', wait: 46.0, due: 'D-Day', status: '대기', pic: '미지정', items: [{ n: '나사부 외경', t: '계량', s: '4.00 ±0.03 mm' }, { n: '체결 토크', t: '계량', s: '규격 내' }, { n: '도금 상태', t: '계수', s: '박리·녹 無' }] },
];
const waitColor = (h: number) => (h >= 36 ? C.err : h >= 12 ? C.warn : C.ink2);
const dueColor = (d: string) => (d === '지연' ? C.err : d === 'D-Day' ? C.warn : C.ink2);

/** 수입검사 대기·대상 현황 — 와이어프레임 qual-iqc-wait.jsx 정본. */
export default function QualIqcWaitScreen() {
  const [sel, setSel] = useState('GR-260621-014');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('전체');
  let rows = IQ_LOTS.filter((l) => tab === '전체' || l.status === tab);
  if (q) rows = rows.filter((l) => l.name.includes(q) || l.code.toLowerCase().includes(q.toLowerCase()) || l.vendor.includes(q) || l.recv.toLowerCase().includes(q.toLowerCase()));
  const cur = IQ_LOTS.find((l) => l.recv === sel) || IQ_LOTS[0];

  const cnt = (s: string) => IQ_LOTS.filter((l) => l.status === s).length;
  const urgent = IQ_LOTS.filter((l) => l.due === '지연' || (l.due === 'D-Day' && l.status !== '검사중')).length;
  const waiting = IQ_LOTS.filter((l) => l.status === '대기');
  const avgWait = (waiting.reduce((s, l) => s + l.wait, 0) / waiting.length).toFixed(1);

  const banner = cur.insp === '전수'
    ? [['검사', '전수'], ['시료수', cur.n.toLocaleString()], ['Ac', '0'], ['Re', '1']]
    : [['시료문자', cur.letter], ['시료수 n', '' + cur.n], ['합격 Ac', '' + cur.ac], ['불합격 Re', '' + cur.re]];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">수입검사 대기·대상 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 수입검사(IQC) / 수입검사 대기·대상 현황</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '검사 착수', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['검사 대기', '' + cnt('대기'), 'LOT', C.ink],
        ['검사 진행중', '' + cnt('검사중'), 'LOT', C.warn],
        ['기한 임박·지연', '' + urgent, 'LOT', C.err],
        ['보류', '' + cnt('보류'), 'LOT', C.ink3],
        ['평균 대기시간', avgWait, 'h', C.blue],
      ]} />

      <FilterCard>
        {[['자재유형', '전체'], ['협력사', '전체'], ['검사구분', '전체']].map(([k, v]) => <FilterField key={k} label={k}><Sel value={v} w={80} /></FilterField>)}
        <SearchBox value={q} onChange={setQ} placeholder="입고번호·품목·협력사" w={150} />
        <span className="ml-auto text-[10.5px] text-ink3">기준일 2026-06-21 09:00</span>
      </FilterCard>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.85fr_1fr]">
        {/* 대기 목록 */}
        <Card title="검사 대기 LOT 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '대기', '검사중', '보류']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['입고번호 / 일시', 'text-left'], ['품목', 'text-left'], ['협력사', 'text-left'], ['입고수량', 'text-right'], ['검사구분', 'text-center'], ['우선', 'text-center'], ['대기/기한', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => {
                const on = l.recv === sel;
                return (
                  <tr key={l.recv} onClick={() => setSel(l.recv)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{l.recv}</div>
                      <div className="mt-px text-[9px] text-ink3">{l.date}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{l.name}</div><div className="mt-px font-mono text-[9px] text-ink3">{l.code} · {l.mtype}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-[10.5px]">{l.vendor}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold text-ink">{l.qty.toLocaleString()}<span className="text-[9px] font-normal text-ink3"> {l.unit}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={l.insp === '전수' ? 'info' : 'mute'}>{l.insp}</Pill><div className="mt-0.5 font-mono text-[9px] text-ink3">n={l.n.toLocaleString()}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={PRIO_TONE[l.prio]}>{l.prio}</Pill></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: waitColor(l.wait) }}>{l.wait}h</div>
                      <div className="text-[9px] font-bold" style={{ color: dueColor(l.due) }}>{l.due}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={ST_TONE[l.status]}>{l.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* LOT 상세 */}
        <Card title="입고 LOT 상세" bodyClassName="p-0" action={<Pill tone={ST_TONE[cur.status]}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.name}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.code} · {cur.recv}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">입고 정보</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['협력사', cur.vendor], ['자재유형', cur.mtype], ['입고수량', cur.qty.toLocaleString() + ' ' + cur.unit], ['LOT 번호', cur.lot], ['입고일시', cur.date], ['검사 담당', cur.pic]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-right text-[11px] font-bold ${/^[\d]/.test('' + v) ? 'font-mono' : ''}`} style={{ color: v === '미지정' ? C.err : C.ink2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">적용 샘플링 플랜</div>
            <div className="flex rounded-[9px] px-2 py-2.5" style={{ background: C.navy }}>
              {banner.map(([k, v], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < banner.length - 1 ? '1px solid rgba(255,255,255,.14)' : 'none' }}>
                  <div className="font-mono text-[17px] font-extrabold" style={{ color: i === 2 ? '#7fe3da' : i === 3 ? '#ff9b8e' : '#fff' }}>{v}</div>
                  <div className="mt-0.5 text-[8.5px] text-white/55">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-center text-[9px] text-ink3">{cur.insp === '전수' ? '전수검사' : `검사수준 ${cur.level} · AQL ${cur.aql.toFixed(2)} · 로트 ${cur.qty.toLocaleString()}`}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">검사 항목 ({cur.items.length})</div>
            <div className="flex flex-col gap-1.5">
              {cur.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5" style={{ background: C.panelAlt }}>
                  <span className="w-[26px] shrink-0 text-[9px] font-bold" style={{ color: it.t === '계량' ? C.blue : C.teal }}>{it.t}</span>
                  <span className="shrink-0 text-[11px] font-bold text-ink">{it.n}</span>
                  <span className={`ml-auto text-right text-[10px] text-ink3 ${it.t === '계량' ? 'font-mono' : ''}`}>{it.s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 px-4 py-3.5">
            <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>검사 실적 등록 →</button>
            <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">보류</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
