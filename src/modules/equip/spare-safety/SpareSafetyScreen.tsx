import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';

interface Row { code: string; name: string; cat: string; unit: string; price: number; stock: number; safe: number; opt: number; lead: number; maker: string; eqs: string[]; po: string; lastReq: string; state: string }
const SAFE_ROWS: Row[] = [
  { code: 'SP-FIL-IM', name: '이온소스 필라멘트', cat: '소모성', unit: 'EA', price: 680000, stock: 0, safe: 3, opt: 6, lead: 28, maker: 'AMAT', eqs: ['Implant 02호기'], po: '미발주', lastReq: '–', state: '결품' },
  { code: 'SP-PAD-IC', name: '연마 패드', cat: '소모성', unit: 'EA', price: 210000, stock: 4, safe: 10, opt: 24, lead: 7, maker: 'DuPont', eqs: ['CMP 02호기'], po: '미발주', lastReq: '–', state: '부족' },
  { code: 'SP-MB-200', name: '캐리어 멤브레인', cat: '소모성', unit: 'EA', price: 480000, stock: 6, safe: 8, opt: 12, lead: 14, maker: 'AMAT', eqs: ['CMP 02호기', 'CMP 03호기'], po: '발주중', lastReq: '06-09', state: '부족' },
  { code: 'SP-SEN-PT', name: '백금 측온센서(Pt100)', cat: '전장부품', unit: 'EA', price: 88000, stock: 3, safe: 5, opt: 10, lead: 12, maker: 'WIKA', eqs: ['Thermal 05호기'], po: '미발주', lastReq: '–', state: '부족' },
  { code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', cat: '전장부품', unit: 'EA', price: 1850000, stock: 2, safe: 2, opt: 3, lead: 30, maker: 'ASM', eqs: ['Thermal 05호기'], po: '입고예정', lastReq: '06-07', state: '주의' },
  { code: 'SP-RFMN-30', name: 'RF 매칭 네트워크', cat: '전장부품', unit: 'EA', price: 3200000, stock: 1, safe: 1, opt: 2, lead: 45, maker: 'Adv. Energy', eqs: ['Etch 01호기'], po: '미발주', lastReq: '–', state: '주의' },
];
const stTone = (s: string): Tone => (s === '정상' ? 'ok' : s === '결품' ? 'err' : 'warn');
const poTone = (p: string): Tone => (p === '입고예정' ? 'ok' : p === '발주중' ? 'info' : 'mute');
const won = (n: number) => n.toLocaleString('ko-KR');
const sevRank = (r: Row) => (r.state === '결품' ? 0 : r.state === '부족' ? 1 : 2) + (r.po === '미발주' ? 0 : 0.5);

function SafeBar({ stock, safe, opt }: { stock: number; safe: number; opt: number }) {
  const max = Math.max(opt * 1.15, stock, safe, 1);
  const c = stock === 0 ? C.err : stock < safe ? C.warn : C.teal;
  return (
    <div className="relative h-2 min-w-[90px] rounded" style={{ background: C.bgDeep }}>
      <div className="absolute inset-0 rounded" style={{ width: `${Math.min((stock / max) * 100, 100)}%`, background: c }} />
      <div className="absolute -top-0.5 -bottom-0.5 w-0.5" style={{ left: `${(safe / max) * 100}%`, background: C.err }} title="안전재고" />
      <div className="absolute -top-0.5 -bottom-0.5 w-0.5" style={{ left: `${Math.min((opt / max) * 100, 100)}%`, background: C.ink3 }} title="적정재고" />
    </div>
  );
}

/** 안전재고 미달 알림 — 와이어프레임 spare-safety.jsx 정본. */
export default function SpareSafetyScreen() {
  const [sel, setSel] = useState('SP-FIL-IM');
  const [filter, setFilter] = useState('전체');
  const rows = [...SAFE_ROWS].sort((a, b) => sevRank(a) - sevRank(b));
  const shown = rows.filter((r) => filter === '전체' || (filter === '미발주' ? r.po === '미발주' : r.state === filter));
  const cur = SAFE_ROWS.find((r) => r.code === sel) || SAFE_ROWS[0];
  const reorderQty = Math.max(cur.opt - cur.stock, 0);
  const reorderAmt = reorderQty * cur.price;
  const shortQty = Math.max(cur.safe - cur.stock, 0);

  const cntOut = SAFE_ROWS.filter((r) => r.stock === 0).length;
  const cntNoPo = SAFE_ROWS.filter((r) => r.po === '미발주').length;
  const cntPo = SAFE_ROWS.filter((r) => r.po !== '미발주').length;
  const estTotal = SAFE_ROWS.filter((r) => r.po === '미발주').reduce((s, r) => s + Math.max(r.opt - r.stock, 0) * r.price, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">안전재고 미달 알림</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 예비품·스페어 파트 / 안전재고 미달 알림</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '일괄 발주요청', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['미달 품목', '' + SAFE_ROWS.length, '종', C.warn], ['결품', '' + cntOut, '종', C.err], ['미발주(조치필요)', '' + cntNoPo, '종', C.err],
        ['발주 진행중', '' + cntPo, '종', C.blue], ['예상 발주금액', (estTotal / 1e6).toFixed(2), 'M₩', C.ink],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_320px]">
        {/* 미달 목록 */}
        <Card
          title="미달 알림 목록"
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {['전체', '결품', '부족', '주의', '미발주'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="rounded-[7px] px-3 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${filter === f ? C.teal : C.borderHi}`, background: filter === f ? C.teal : '#fff', color: filter === f ? '#fff' : C.ink2 }}>{f}</button>
              ))}
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['예비품', 'text-left'], ['재고 수준', 'text-left'], ['부족', 'text-right'], ['리드타임', 'text-right'], ['발주상태', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const on = r.code === sel;
                const sh = Math.max(r.safe - r.stock, 0);
                return (
                  <tr key={r.code} onClick={() => setSel(r.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="flex items-center gap-1.5">
                        {r.stock === 0 && <span className="text-[12px]">⛔</span>}
                        <div>
                          <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{r.name}</div>
                          <div className="mt-px font-mono text-[9.5px] text-ink3">{r.code} · {r.eqs[0]}{r.eqs.length > 1 ? ` 외 ${r.eqs.length - 1}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5">
                      <SafeBar stock={r.stock} safe={r.safe} opt={r.opt} />
                      <div className="mt-1 font-mono text-[9px] text-ink3">현 {r.stock} / 안전 {r.safe} / 적정 {r.opt}</div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold" style={{ color: r.stock === 0 ? C.err : C.warn }}>−{sh}<span className="text-[9px] font-normal text-ink3"> {r.unit}</span></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{r.lead}일</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={poTone(r.po)}>{r.po}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(r.state)}>{r.state}</Pill></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={6} className="border-b border-border px-3 py-8 text-center text-ink3">해당 조건의 미달 품목이 없습니다.</td></tr>}
            </tbody>
          </table>
        </Card>

        {/* 발주 권고 */}
        <Card title="발주 권고" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.code}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: cur.stock === 0 ? '#fdecea' : C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span>
              <Pill tone={stTone(cur.state)}>{cur.state}</Pill>
            </div>
            <div className="text-[10.5px] text-ink3">{cur.maker} · {cur.eqs.join(', ')}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex">
              {([['현재고', cur.stock, cur.stock === 0 ? C.err : C.warn], ['안전', cur.safe, C.ink2], ['적정', cur.opt, C.ink2]] as const).map(([k, v, c], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <div className="text-[22px] font-extrabold tabular-nums" style={{ color: c }}>{v}</div>
                  <div className="text-[9.5px] text-ink3">{k} ({cur.unit})</div>
                </div>
              ))}
            </div>
            <SafeBar stock={cur.stock} safe={cur.safe} opt={cur.opt} />
            <div className="mt-1.5 flex justify-between text-[9.5px] text-ink3">
              <span>안전재고 부족 <b style={{ color: C.warn }}>{shortQty}{cur.unit}</b></span>
              <span>리드타임 <b className="text-ink2">{cur.lead}일</b></span>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">권장 발주 (적정재고 기준)</div>
            <div className="flex flex-col gap-2">
              {([['권장 발주량', `${reorderQty} ${cur.unit}`, true], ['단가', `${won(cur.price)} ₩`, false], ['예상 발주금액', `${won(reorderAmt)} ₩`, true], ['예상 입고', `+${cur.lead}일`, false], ['최근 요청', cur.lastReq, false]] as const).map(([k, v, hi]) => (
                <div key={k} className="flex items-baseline justify-between">
                  <span className="text-[11px] text-ink3">{k}</span>
                  <span className="font-mono" style={{ fontSize: hi ? 14 : 12, fontWeight: hi ? 800 : 600, color: hi ? C.ink : C.ink2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 px-4 py-3.5">
            {cur.po === '미발주' ? (
              <button className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: C.navy }}>발주 요청 등록</button>
            ) : (
              <div className="w-full rounded-[9px] py-2.5 text-center text-[12px] font-extrabold" style={{ background: cur.po === '입고예정' ? C.tealSoft : '#e7eefc', color: cur.po === '입고예정' ? C.teal : C.blue }}>
                {cur.po === '입고예정' ? '입고 예정 — 발주 완료' : '발주 진행중'} ({cur.lastReq})
              </div>
            )}
            <button className="w-full rounded-[9px] border border-border-hi bg-panel py-2.5 text-[12px] font-bold text-ink2">마스터 / 입출고 이력 보기</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
