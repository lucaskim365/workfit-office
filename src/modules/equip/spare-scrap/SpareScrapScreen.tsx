import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';

interface Row { no: string; code: string; name: string; cat: string; unit: string; qty: number; book: number; recover: number; reason: string; idle: number; reqDate: string; reqBy: string; state: string; appr: string }
const SCRAP_ROWS: Row[] = [
  { no: 'DS-2606-007', code: 'SP-PMP-DM', name: '다이어프램 펌프', cat: '기구부품', unit: 'EA', qty: 3, book: 420000, recover: 45000, reason: '장기미사용', idle: 98, reqDate: '06-09', reqBy: '김설비', state: '승인대기', appr: '–' },
  { no: 'DS-2606-006', code: 'SP-RFMN-30', name: 'RF 매칭 네트워크', cat: '전장부품', unit: 'EA', qty: 1, book: 3200000, recover: 280000, reason: '단종(EOL)', idle: 80, reqDate: '06-08', reqBy: '이정비', state: '승인대기', appr: '–' },
  { no: 'DS-2606-005', code: 'SP-GSK-OLD', name: '구형 가스켓 세트', cat: '소모성', unit: 'SET', qty: 40, book: 38000, recover: 0, reason: '사양변경', idle: 140, reqDate: '06-05', reqBy: '김자재', state: '승인완료', appr: '박팀장' },
  { no: 'DS-2606-004', code: 'SP-BRG-OLD', name: '구형 스핀들 베어링', cat: '정밀부품', unit: 'EA', qty: 2, book: 510000, recover: 60000, reason: '단종(EOL)', idle: 210, reqDate: '06-03', reqBy: '김설비', state: '폐기완료', appr: '박팀장' },
  { no: 'DS-2606-003', code: 'SP-VLV-DM', name: '손상 공압 밸브', cat: '기구부품', unit: 'EA', qty: 4, book: 165000, recover: 12000, reason: '손상/파손', idle: 30, reqDate: '06-02', reqBy: '이정비', state: '반려', appr: '박팀장' },
  { no: '–', code: 'SP-SEN-OLD', name: '구형 온도센서', cat: '전장부품', unit: 'EA', qty: 6, book: 72000, recover: 5000, reason: '장기미사용', idle: 175, reqDate: '–', reqBy: '–', state: '불용지정', appr: '–' },
  { no: '–', code: 'SP-CBL-LAN', name: '폐 LAN 하네스', cat: '전장부품', unit: 'EA', qty: 12, book: 28000, recover: 8000, reason: '사양변경', idle: 120, reqDate: '–', reqBy: '–', state: '불용지정', appr: '–' },
];
const RSN: Record<string, string> = { 장기미사용: C.amber, '단종(EOL)': C.ink2, '손상/파손': C.err, 사양변경: C.blue, 중복: C.ink3 };
const stTone = (s: string): Tone => (s === '폐기완료' ? 'mute' : s === '승인완료' ? 'ok' : s === '승인대기' ? 'warn' : s === '반려' ? 'err' : 'info');
const won = (n: number) => n.toLocaleString('ko-KR');

const FLOW = ['불용지정', '폐기요청', '승인대기', '승인완료', '폐기완료'];
const flowIndex = (s: string) => (s === '반려' ? 2 : FLOW.indexOf(s));

/** 폐기 및 불용품 관리 — 와이어프레임 spare-scrap.jsx 정본. */
export default function SpareScrapScreen() {
  const [sel, setSel] = useState('SP-PMP-DM');
  const [filter, setFilter] = useState('전체');
  const shown = SCRAP_ROWS.filter((r) => filter === '전체' || r.state === filter);
  const cur = SCRAP_ROWS.find((r) => r.code === sel) || SCRAP_ROWS[0];
  const curIdx = flowIndex(cur.state);
  const rejected = cur.state === '반려';

  const cntObsolete = SCRAP_ROWS.filter((r) => r.state === '불용지정').length;
  const cntWait = SCRAP_ROWS.filter((r) => r.state === '승인대기').length;
  const cntApproved = SCRAP_ROWS.filter((r) => r.state === '승인완료').length;
  const scrapAmt = SCRAP_ROWS.filter((r) => r.state === '폐기완료').reduce((s, r) => s + r.book * r.qty, 0);
  const recoverAmt = SCRAP_ROWS.filter((r) => r.state !== '반려').reduce((s, r) => s + r.recover * r.qty, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">폐기 및 불용품 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 예비품·스페어 파트 / 폐기 및 불용품 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '불용품 지정', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['불용 지정', '' + cntObsolete, '건', C.blue], ['승인 대기', '' + cntWait, '건', C.warn], ['승인 완료(폐기예정)', '' + cntApproved, '건', C.ok],
        ['당월 폐기금액', (scrapAmt / 1e6).toFixed(2), 'M₩', C.ink], ['예상 회수가치', (recoverAmt / 1e3).toFixed(0), 'K₩', C.teal],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_330px]">
        {/* 목록 */}
        <Card
          title="불용 / 폐기 목록"
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {['전체', '불용지정', '승인대기', '승인완료', '폐기완료', '반려'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="rounded-[7px] px-2.5 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${filter === f ? C.teal : C.borderHi}`, background: filter === f ? C.teal : '#fff', color: filter === f ? '#fff' : C.ink2 }}>{f}</button>
              ))}
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['예비품', 'text-left'], ['불용 사유', 'text-center'], ['수량', 'text-right'], ['장부금액(₩)', 'text-right'], ['회수가치(₩)', 'text-right'], ['처리상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const on = r.code === sel;
                return (
                  <tr key={r.code} onClick={() => setSel(r.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{r.name}</div>
                      <div className="mt-px font-mono text-[9.5px] text-ink3">{r.code} · {r.no} · 정체 {r.idle}일</div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><span className="rounded-md px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ color: RSN[r.reason], background: `${RSN[r.reason]}18` }}>{r.reason}</span></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink2">{r.qty}<span className="text-[9px] font-normal text-ink3"> {r.unit}</span></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink">{won(r.book * r.qty)}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono" style={{ color: r.recover ? C.teal : C.ink3 }}>{r.recover ? won(r.recover * r.qty) : '–'}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(r.state)}>{r.state}</Pill></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={6} className="border-b border-border px-3 py-8 text-center text-ink3">해당 상태의 항목이 없습니다.</td></tr>}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[10.5px] text-ink3">{shown.length}건</span>
            <span className="text-[11px] text-ink3">장부금액 합계 <b className="font-mono text-ink">{won(shown.reduce((s, r) => s + r.book * r.qty, 0))} ₩</b></span>
          </div>
        </Card>

        {/* 처리 패널 */}
        <Card title="처리 내역" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.no}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span>
              <Pill tone={stTone(cur.state)}>{cur.state}</Pill>
            </div>
            <div className="font-mono text-[10.5px] text-ink3">{cur.code} · {cur.cat}</div>
          </div>

          {/* 승인 흐름 */}
          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">처리 흐름</div>
            <div className="flex items-start">
              {FLOW.map((step, i) => {
                const done = i < curIdx, here = i === curIdx;
                const c = rejected && here ? C.err : done ? C.teal : here ? C.navy : C.borderHi;
                return (
                  <div key={step} className="relative flex flex-1 flex-col items-center">
                    {i > 0 && <div className="absolute top-[9px] right-1/2 h-0.5 w-full" style={{ background: i <= curIdx ? C.teal : C.border }} />}
                    <div className="z-[1] flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: done || here ? c : '#fff', border: `2px solid ${c}` }}>{done ? '✓' : rejected && here ? '✕' : ''}</div>
                    <span className="mt-1.5 text-center text-[8.5px] leading-tight" style={{ fontWeight: here ? 800 : 600, color: here ? (rejected ? C.err : C.navy) : done ? C.ink2 : C.ink3 }}>{step}</span>
                  </div>
                );
              })}
            </div>
            {rejected && <div className="mt-2.5 rounded-[7px] px-2.5 py-1.5 text-[10px] font-bold" style={{ color: C.err, background: '#fdecea' }}>⚠ 반려됨 — 손상 경위 재확인 후 재상신 필요</div>}
          </div>

          {/* 상세 */}
          <div className="border-b border-border px-4 py-3.5">
            <div className="flex flex-col gap-2">
              {([['불용 사유', cur.reason, false], ['수량', `${cur.qty} ${cur.unit}`, false], ['정체 일수', `${cur.idle}일`, false], ['장부금액', `${won(cur.book * cur.qty)} ₩`, true], ['회수가치', cur.recover ? `${won(cur.recover * cur.qty)} ₩` : '없음', false], ['요청자 / 일자', cur.reqBy === '–' ? '미요청' : `${cur.reqBy} · ${cur.reqDate}`, false], ['승인자', cur.appr, false]] as const).map(([k, v, hi]) => (
                <div key={k} className="flex items-baseline justify-between">
                  <span className="text-[11px] text-ink3">{k}</span>
                  <span className={/\d/.test('' + v) ? 'font-mono' : ''} style={{ fontSize: hi ? 14 : 11.5, fontWeight: hi ? 800 : 700, color: hi ? C.ink : C.ink2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 액션 */}
          <div className="flex flex-col gap-2 px-4 py-3.5">
            {cur.state === '불용지정' && <button className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: C.navy }}>폐기 승인 요청</button>}
            {cur.state === '승인대기' && (
              <div className="flex gap-2">
                <button className="flex-1 rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: C.teal }}>승인</button>
                <button className="flex-1 rounded-[9px] border bg-panel py-3 text-[13px] font-extrabold" style={{ borderColor: C.err, color: C.err }}>반려</button>
              </div>
            )}
            {cur.state === '승인완료' && <button className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: C.navy }}>폐기 완료 처리</button>}
            {cur.state === '반려' && <button className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: C.navy }}>재상신</button>}
            {cur.state === '폐기완료' && <div className="w-full rounded-[9px] py-2.5 text-center text-[12px] font-extrabold text-ink3" style={{ background: C.bgDeep }}>폐기 완료 — 재고 차감됨</div>}
            <button className="w-full rounded-[9px] border border-border-hi bg-panel py-2.5 text-[12px] font-bold text-ink2">폐기 명세서 출력</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
