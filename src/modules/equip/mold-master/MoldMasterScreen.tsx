import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';

const MOLD_CAT: Record<string, Tone> = { 사출금형: 'info', 프레스금형: 'warn', '지그/Fixture': 'ok', '게이지/검구': 'mute', 절삭공구: 'mute' };
interface Mold { code: string; name: string; cat: string; asset: string; maker: string; cav: number; loc: string; shot: number; life: number; item: string; eqs: string[]; lastChk: string; repairs: number; state: string }
const MOLDS: Mold[] = [
  { code: 'MD-INJ-101', name: '커넥터 하우징 금형', cat: '사출금형', asset: 'A2023-0451', maker: '한국정밀금형', cav: 8, loc: '금형창고 1-A-03', shot: 412000, life: 500000, item: 'CN-HSG-08P', eqs: ['사출 03호기'], lastChk: '06-05', repairs: 3, state: '사용중' },
  { code: 'MD-INJ-102', name: '센서 커버 금형', cat: '사출금형', asset: 'A2022-0388', maker: '대성몰드', cav: 4, loc: '금형창고 1-A-04', shot: 188000, life: 400000, item: 'SN-CVR-04', eqs: ['사출 05호기'], lastChk: '06-08', repairs: 1, state: '사용중' },
  { code: 'MD-PRS-210', name: '브래킷 프레스 금형', cat: '프레스금형', asset: 'A2021-0212', maker: '동양프레스', cav: 2, loc: '금형창고 2-B-01', shot: 940000, life: 1000000, item: 'BR-MNT-2T', eqs: ['프레스 01호기'], lastChk: '05-30', repairs: 6, state: '수명임박' },
  { code: 'MD-PRS-211', name: '터미널 단자 금형', cat: '프레스금형', asset: 'A2020-0150', maker: '동양프레스', cav: 16, loc: '금형창고 2-B-02', shot: 1480000, life: 1500000, item: 'TM-PIN-16', eqs: ['프레스 02호기'], lastChk: '04-20', repairs: 9, state: '수리중' },
  { code: 'JG-WLD-051', name: '용접 고정 지그', cat: '지그/Fixture', asset: 'A2023-0502', maker: '정밀지그', cav: 0, loc: '치공구실 J-01', shot: 0, life: 0, item: 'ASSY-FRM-A', eqs: ['용접 02호기'], lastChk: '06-10', repairs: 0, state: '사용중' },
  { code: 'GG-PLG-014', name: '플러그 게이지 세트', cat: '게이지/검구', asset: 'A2024-0033', maker: 'Mitutoyo', cav: 0, loc: '계측실 G-04', shot: 0, life: 0, item: '–', eqs: ['수입검사실'], lastChk: '06-01', repairs: 0, state: '보관' },
  { code: 'MD-INJ-103', name: '하우징 캡 금형', cat: '사출금형', asset: 'A2019-0078', maker: '한국정밀금형', cav: 6, loc: '금형창고 1-C-02', shot: 980000, life: 1000000, item: 'HS-CAP-06', eqs: ['사출 02호기'], lastChk: '03-15', repairs: 11, state: '폐기예정' },
  { code: 'CT-END-220', name: '엔드밀 공구 세트', cat: '절삭공구', asset: 'A2024-0119', maker: 'Sandvik', cav: 0, loc: '공구실 C-07', shot: 0, life: 0, item: '–', eqs: ['CNC 04호기'], lastChk: '06-09', repairs: 0, state: '사용중' },
];
const stTone = (s: string): Tone => (s === '사용중' ? 'ok' : s === '보관' ? 'info' : s === '수명임박' ? 'warn' : s === '수리중' ? 'warn' : 'err');
const num = (n: number) => n.toLocaleString('ko-KR');
const lifePct = (m: Mold) => (m.life ? Math.round((m.shot / m.life) * 100) : null);

function LifeBar({ pct }: { pct: number }) {
  const c = pct >= 95 ? C.err : pct >= 85 ? C.warn : C.teal;
  return (
    <div className="relative h-2.5 rounded-[5px]" style={{ background: C.bgDeep }}>
      <div className="absolute inset-0 rounded-[5px]" style={{ width: `${Math.min(pct, 100)}%`, background: c }} />
      <div className="absolute -top-[3px] -bottom-[3px] w-0.5" style={{ left: '85%', background: C.warn }} title="교체 권고선(85%)" />
    </div>
  );
}

/** 금형 / 치공구 마스터 — 와이어프레임 mold-master.jsx 정본. */
export default function MoldMasterScreen() {
  const [sel, setSel] = useState('MD-PRS-210');
  const [q, setQ] = useState('');
  const cur = MOLDS.find((m) => m.code === sel) || MOLDS[0];
  const rows = MOLDS.filter((m) => !q || m.name.includes(q) || m.code.toLowerCase().includes(q.toLowerCase()) || m.asset.toLowerCase().includes(q.toLowerCase()));
  const pct = lifePct(cur);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">금형 / 치공구 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 금형 및 치공구 관리 / 금형·치공구 마스터</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '자산 등록', variant: 'primary' }, 'save', 'upload', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['총 보유 자산', '' + MOLDS.length, '점', C.ink],
        ['사용중', '' + MOLDS.filter((m) => m.state === '사용중').length, '점', C.ok],
        ['수리중', '' + MOLDS.filter((m) => m.state === '수리중').length, '점', C.warn],
        ['수명 임박(85%+)', '' + MOLDS.filter((m) => { const p = lifePct(m); return p != null && p >= 85 && m.state !== '폐기예정'; }).length, '점', C.warn],
        ['폐기 예정', '' + MOLDS.filter((m) => m.state === '폐기예정').length, '점', C.err],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        {/* 목록 */}
        <Card
          title="금형 / 치공구 목록"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-3 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-ink">전체 분류 <span className="text-[8px] text-ink3">▾</span></span>
              <div className="flex items-center gap-1.5 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5">
                <span className="text-[11px] text-ink3">⌕</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="자산번호·품번·품명" className="w-[120px] bg-transparent text-[11px] text-ink outline-none" />
              </div>
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['자산번호 / 품명', 'text-left'], ['분류', 'text-center'], ['수명(타수)', 'text-left'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const on = m.code === sel;
                const p = lifePct(m);
                return (
                  <tr key={m.code} onClick={() => setSel(m.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{m.name}</div>
                      <div className="mt-px font-mono text-[9.5px] text-ink3">{m.asset} · {m.code}</div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={MOLD_CAT[m.cat]}>{m.cat}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5">
                      {p != null ? (
                        <div className="min-w-[120px]">
                          <LifeBar pct={p} />
                          <div className="mt-1 font-mono text-[9px] text-ink3">{num(m.shot)} / {num(m.life)} · <b style={{ color: p >= 85 ? C.warn : C.ink2 }}>{p}%</b></div>
                        </div>
                      ) : <span className="text-[10px] text-ink3">수명관리 미적용 (점검주기 기반)</span>}
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(m.state)}>{m.state}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="자산 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.asset}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-ink">{cur.name}</span>
              <span className="flex gap-1.5"><Pill tone={MOLD_CAT[cur.cat]}>{cur.cat}</Pill><Pill tone={stTone(cur.state)}>{cur.state}</Pill></span>
            </div>
            <div className="font-mono text-[11px] text-ink3">{cur.code} · {cur.maker}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">기본 정보</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['제조사', cur.maker], ['캐비티', cur.cav ? cur.cav + ' Cav' : '–'], ['보관위치', cur.loc], ['적용 품목', cur.item], ['최근 점검', cur.lastChk], ['누적 수리', cur.repairs + '회']].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-right text-[11.5px] font-bold text-ink2 ${/\d/.test('' + v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">수명 (Shot) 현황</div>
            {pct != null ? (
              <>
                <div className="mb-2.5 flex">
                  {([['누적 타수', num(cur.shot), C.ink], ['보증 수명', num(cur.life), C.ink2], ['잔여', num(cur.life - cur.shot), pct >= 85 ? C.warn : C.teal]] as const).map(([k, v, c], i) => (
                    <div key={k} className="flex-1 text-center" style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                      <div className="font-mono text-[16px] font-extrabold tabular-nums" style={{ color: c }}>{v}</div>
                      <div className="text-[9.5px] text-ink3">{k}</div>
                    </div>
                  ))}
                </div>
                <LifeBar pct={pct} />
                <div className="mt-1.5 flex justify-between text-[9.5px] text-ink3">
                  <span>소진율 <b style={{ color: pct >= 85 ? C.warn : C.ink2 }}>{pct}%</b></span>
                  <span>교체 권고선 85%</span>
                </div>
                {pct >= 85 && (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: pct >= 95 ? '#fdecea' : '#fef6ec', border: `1px solid ${pct >= 95 ? C.err : C.warn}` }}>
                    <span className="text-[12px]">{pct >= 95 ? '⛔' : '⚠'}</span>
                    <span className="text-[10.5px] font-bold" style={{ color: pct >= 95 ? C.err : '#b5731f' }}>{pct >= 95 ? '수명 한계 도달 — 사용 중단 및 교체 필요' : `교체 권고선 초과 — 정비 점검 권고 (잔여 ${num(cur.life - cur.shot)} 타)`}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg px-3.5 py-3 text-center text-[11px] text-ink3" style={{ background: C.panelAlt }}>타수 기반 수명관리 미적용 자산<br /><span className="text-[10px]">점검 주기 / 교정 주기로 관리</span></div>
            )}
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">적용 설비 / 라인</div>
            <div className="flex flex-wrap gap-1.5">
              {cur.eqs.map((e, i) => <span key={i} className="rounded-md px-2.5 py-1 text-[10.5px] font-semibold text-ink2" style={{ background: C.bgDeep }}>{e}</span>)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
