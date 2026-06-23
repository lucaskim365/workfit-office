import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, Sel, FilterCard, FilterField, ChipTabs, SearchBox } from '../_qual';

const PRIO_TONE: Record<string, Tone> = { 긴급: 'err', 일반: 'mute' };
const ST_TONE: Record<string, Tone> = { 대기: 'info', 검사중: 'warn', 보류: 'mute' };
const dueColor = (d: string) => (d === '지연' ? C.err : d === 'D-Day' || d === 'D-1' ? C.warn : C.ink2);

interface ItemRow { n: string; t: string; s: string }
interface Lot { so: string; date: string; code: string; name: string; cust: string; dest: string; qty: number; unit: string; lot: string; insp: string; letter: string; n: number; ac: number; re: number; level: string; aql: number; prio: string; ship: string; due: string; wait: number; status: string; pic: string; coa: boolean; pqc: string; items: ItemRow[]; req: string[] }
const OQ_LOTS: Lot[] = [
  { so: 'SO-260621-018', date: '06-21 09:10', code: 'FG-BRK-A', name: '브래킷 ASSY-A', cust: '현대모비스', dest: '아산 1공장', qty: 1200, unit: 'EA', lot: 'L2606-1013', insp: '샘플링', letter: 'J', n: 80, ac: 2, re: 3, level: 'II', aql: 1.0, prio: '긴급', ship: '06-22 14:00', due: 'D-1', wait: 4.1, status: '대기', pic: '미지정', coa: true, pqc: '합격', items: [{ n: '외관 (전수)', t: '계수', s: '스크래치·이물 無' }, { n: '외경(O.D)', t: '계량', s: '25.00 ±0.05 mm' }, { n: '체결 토크', t: '계량', s: '12.0 ±1.5 N·m' }], req: ['전수 외관검사', 'COA 동봉', '고객 라벨 양식'] },
  { so: 'SO-260621-015', date: '06-21 08:40', code: 'FG-HSG-C', name: '하우징 C-Type', cust: 'LG전자', dest: '창원 물류', qty: 5000, unit: 'EA', lot: 'L2606-1008', insp: '샘플링', letter: 'L', n: 200, ac: 5, re: 6, level: 'II', aql: 1.5, prio: '일반', ship: '06-23 10:00', due: 'D-2', wait: 4.6, status: '대기', pic: '미지정', coa: true, pqc: '합격', items: [{ n: '중량', t: '계량', s: '50.0 ±2.0 g' }, { n: '외관', t: '계수', s: '웰드라인·변형 無' }, { n: '색상', t: '계수', s: '한계견본 내' }], req: ['COA 동봉', 'RoHS 성적서'] },
  { so: 'SO-260620-031', date: '06-20 16:20', code: 'FG-GER-22', name: '기어 G-22T', cust: '한국델파이', dest: '대구공장', qty: 1500, unit: 'EA', lot: 'L2606-0931', insp: '샘플링', letter: 'H', n: 50, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '일반', ship: '06-21 16:00', due: 'D-Day', wait: 21.5, status: '검사중', pic: '이검사', coa: true, pqc: '합격', items: [{ n: '치형(M)', t: '계량', s: '1.50 ±0.01 mm' }, { n: 'PCD', t: '계량', s: '33.00 ±0.05 mm' }, { n: '치면 손상', t: '계수', s: '손상 無' }], req: ['초·중·종물 성적서', 'COA 동봉'] },
  { so: 'SO-260620-028', date: '06-20 14:05', code: 'FG-CVR-B', name: '커버 플레이트 B', cust: '만도', dest: '평택공장', qty: 3000, unit: 'EA', lot: 'L2606-1011', insp: '전수', letter: '—', n: 3000, ac: 0, re: 1, level: '—', aql: 0, prio: '긴급', ship: '06-21 13:00', due: '지연', wait: 23.0, status: '보류', pic: '이검사', coa: false, pqc: '조건부', items: [{ n: '두께(t)', t: '계량', s: '2.00 ±0.05 mm' }, { n: '평면도', t: '계량', s: '≤0.10 mm' }, { n: '버·크랙', t: '계수', s: '버·크랙 無' }], req: ['전수검사', '고객 입회검사 요청'] },
  { so: 'SO-260620-022', date: '06-20 11:15', code: 'FG-SFT-D', name: '샤프트 D-40', cust: '현대모비스', dest: '아산 2공장', qty: 800, unit: 'EA', lot: 'L2606-1006', insp: '샘플링', letter: 'G', n: 32, ac: 1, re: 2, level: 'II', aql: 1.0, prio: '일반', ship: '06-22 09:00', due: 'D-1', wait: 26.0, status: '대기', pic: '미지정', coa: true, pqc: '합격', items: [{ n: '축경(Ø)', t: '계량', s: '40.00 ±0.03 mm' }, { n: '진원도', t: '계량', s: '≤0.02 mm' }, { n: '표면 거칠기', t: '계량', s: '≤1.6 Ra' }], req: ['COA 동봉', '재질성적서(밀시트)'] },
  { so: 'SO-260619-040', date: '06-19 17:30', code: 'FG-BRK-A', name: '브래킷 ASSY-A', cust: 'LG마그나', dest: '인천공장', qty: 600, unit: 'EA', lot: 'L2606-0939', insp: '샘플링', letter: 'F', n: 20, ac: 0, re: 1, level: 'II', aql: 0.65, prio: '일반', ship: '06-24 10:00', due: 'D-3', wait: 39.5, status: '대기', pic: '미지정', coa: true, pqc: '합격', items: [{ n: '외관', t: '계수', s: '스크래치 無' }, { n: '외경(O.D)', t: '계량', s: '25.00 ±0.05 mm' }], req: ['COA 동봉', 'PPAP 레벨3'] },
];

/** 출하검사 대기 현황 — 와이어프레임 qual-oqc-wait.jsx 정본. */
export default function QualOqcWaitScreen() {
  const [sel, setSel] = useState('SO-260621-018');
  const [tab, setTab] = useState('전체');
  const [q, setQ] = useState('');
  let rows = OQ_LOTS.filter((l) => tab === '전체' || l.status === tab);
  if (q) rows = rows.filter((l) => l.name.includes(q) || l.cust.includes(q) || l.code.toLowerCase().includes(q.toLowerCase()) || l.so.toLowerCase().includes(q.toLowerCase()));
  const cur = OQ_LOTS.find((l) => l.so === sel) || OQ_LOTS[0];

  const cnt = (s: string) => OQ_LOTS.filter((l) => l.status === s).length;
  const urgent = OQ_LOTS.filter((l) => l.due === '지연' || l.due === 'D-Day' || l.due === 'D-1').length;
  const shipQty = OQ_LOTS.filter((l) => l.due === 'D-Day' || l.due === 'D-1').reduce((s, l) => s + l.qty, 0);

  const banner = cur.insp === '전수'
    ? [['검사', '전수'], ['시료수', cur.n.toLocaleString()], ['Ac', '0'], ['Re', '1']]
    : [['시료문자', cur.letter], ['시료수 n', '' + cur.n], ['합격 Ac', '' + cur.ac], ['불합격 Re', '' + cur.re]];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">출하검사 대기 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 출하검사(OQC) / 출하검사 대기 현황</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '검사 착수', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['검사 대기', '' + cnt('대기'), 'LOT', C.ink],
        ['검사 진행중', '' + cnt('검사중'), 'LOT', C.warn],
        ['납기 임박·지연', '' + urgent, 'LOT', C.err],
        ['보류', '' + cnt('보류'), 'LOT', C.ink3],
        ['금일 출하 예정', shipQty.toLocaleString(), 'EA', C.blue],
      ]} />

      <FilterCard>
        {[['거래처', '전체'], ['검사구분', '전체']].map(([k, v]) => <FilterField key={k} label={k}><Sel value={v} w={80} /></FilterField>)}
        <SearchBox value={q} onChange={setQ} placeholder="출하지시·제품·거래처" w={160} />
        <span className="ml-auto text-[10.5px] text-ink3">기준일 2026-06-21 09:00</span>
      </FilterCard>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.9fr_1fr]">
        {/* 목록 */}
        <Card title="출하검사 대기 LOT 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '대기', '검사중', '보류']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['출하지시 / 일시', 'text-left'], ['제품', 'text-left'], ['거래처 / 납품처', 'text-left'], ['수량', 'text-right'], ['검사', 'text-center'], ['출하 납기', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => {
                const on = l.so === sel;
                return (
                  <tr key={l.so} onClick={() => setSel(l.so)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{l.so}</div>
                      <div className="mt-px text-[9px] text-ink3">{l.date}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{l.name}</div><div className="mt-px font-mono text-[9px] text-ink3">{l.code} · {l.lot}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="text-[11px] font-bold text-ink2">{l.cust}</div><div className="text-[9px] text-ink3">{l.dest}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold text-ink">{l.qty.toLocaleString()}<span className="text-[9px] font-normal text-ink3"> {l.unit}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={l.insp === '전수' ? 'info' : 'mute'}>{l.insp}</Pill><div className="mt-0.5 font-mono text-[9px] text-ink3">n={l.n.toLocaleString()}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><div className="font-mono text-[9.5px] text-ink2">{l.ship.split(' ')[0]}</div><div className="text-[9.5px] font-extrabold" style={{ color: dueColor(l.due) }}>{l.due}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={ST_TONE[l.status]}>{l.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* LOT 상세 */}
        <Card title="출하 LOT 상세" bodyClassName="p-0" action={<Pill tone={ST_TONE[cur.status]}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><Pill tone={PRIO_TONE[cur.prio]}>{cur.prio}</Pill></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.code} · {cur.so} · LOT {cur.lot}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">출하 정보</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['거래처', cur.cust], ['납품처', cur.dest], ['출하수량', cur.qty.toLocaleString() + ' ' + cur.unit], ['검사 담당', cur.pic], ['출하 예정', cur.ship], ['납기', cur.due]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-right text-[11px] font-bold ${/^[\d]/.test('' + v) ? 'font-mono' : ''}`} style={{ color: v === '미지정' ? C.err : k === '납기' ? dueColor(cur.due) : C.ink2 }}>{v}</span>
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
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">고객 요구사항</div>
            <div className="flex flex-wrap gap-1.5">
              {cur.req.map((r, i) => <span key={i} className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ color: C.blue, background: C.blueSoft }}>{r}</span>)}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex gap-2">
              <div className="flex flex-1 items-center justify-between rounded-lg px-3 py-2.5" style={{ background: cur.pqc === '합격' ? C.tealSoft : '#fef6ec' }}>
                <span className="text-[10px] text-ink3">공정검사 결과</span>
                <span className="text-[11.5px] font-extrabold" style={{ color: cur.pqc === '합격' ? C.ok : C.warn }}>{cur.pqc}</span>
              </div>
              <div className="flex flex-1 items-center justify-between rounded-lg px-3 py-2.5" style={{ background: C.panelAlt }}>
                <span className="text-[10px] text-ink3">COA 발행</span>
                <span className="text-[11.5px] font-extrabold" style={{ color: cur.coa ? C.ink : C.ink3 }}>{cur.coa ? '필요' : '불요'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>출하검사 착수 →</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">보류</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
