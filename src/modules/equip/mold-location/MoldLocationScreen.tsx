import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';
import { useMoldLocations } from '@/features/moldLocation/useMoldLocations';

interface Tx { no: string; date: string; type: string; code: string; name: string; from: string; to: string; reason: string; who: string }
const LOC_TX: Tx[] = [
  { no: 'ML-2606-031', date: '06-10 13:20', type: '출고', code: 'MD-INJ-102', name: '센서 커버 금형', from: '금형창고 1-A-04', to: '사출 05호기', reason: '생산 대출', who: '김설비' },
  { no: 'ML-2606-030', date: '06-10 09:10', type: '반납', code: 'MD-INJ-103', name: '하우징 캡 금형', from: '사출 02호기', to: '금형창고 1-C-02', reason: '생산 종료 반납', who: '김설비' },
  { no: 'ML-2606-029', date: '06-07 15:40', type: '반출', code: 'MD-PRS-211', name: '터미널 단자 금형', from: '금형창고 2-B-02', to: '동양프레스(외주)', reason: '외주 수리', who: '박정비' },
  { no: 'ML-2606-028', date: '06-01 08:30', type: '출고', code: 'MD-PRS-210', name: '브래킷 프레스 금형', from: '금형창고 2-B-01', to: '프레스 01호기', reason: '생산 대출', who: '박정비' },
  { no: 'ML-2606-027', date: '05-22 10:05', type: '출고', code: 'MD-INJ-101', name: '커넥터 하우징 금형', from: '금형창고 1-A-03', to: '사출 03호기', reason: '생산 대출', who: '김설비' },
];
const LOC_CAT: Record<string, Tone> = { 사출금형: 'info', 프레스금형: 'warn', 지그: 'ok', 게이지: 'mute' };
const stTone = (s: string): Tone => (s === '보관중' ? 'ok' : s === '대출중' ? 'info' : s === '외부수리' ? 'err' : 'warn');
const txTone = (t: string): Tone => (t === '반납' ? 'ok' : t === '출고' ? 'info' : 'warn');

/** 금형 입·출고 / 위치 관리 — 와이어프레임 mold-location.jsx 정본. */
export default function MoldLocationScreen() {
  const { data: rows = [], isLoading } = useMoldLocations();
  const [view, setView] = useState<'현재 위치' | '입출고 이력'>('현재 위치');
  const [mode, setMode] = useState<'출고' | '반납' | '반출'>('출고');
  const [moldCode, setMoldCode] = useState('MD-INJ-103');
  const mold = rows.find((m) => m.code === moldCode) || rows[0];

  const inStorage = rows.filter((m) => m.state === '보관중').length;
  const onLoan = rows.filter((m) => m.state === '대출중').length;
  const external = rows.filter((m) => m.state === '외부수리').length;
  const moving = rows.filter((m) => m.state === '이동중').length;
  const modeColor = mode === '반납' ? C.teal : mode === '반출' ? C.err : C.blue;

  if (!mold) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '금형 자산이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">금형 입·출고 / 위치 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 금형 및 치공구 관리 / 금형 입·출고·위치 관리</p>
        </div>
        <ActionBar actions={['refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['총 자산', '' + rows.length, '점', C.ink], ['보관중', '' + inStorage, '점', C.ok], ['현장 대출중', '' + onLoan, '점', C.blue],
        ['외부 반출', '' + external, '점', C.err], ['이동중', '' + moving, '점', C.warn],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_330px]">
        {/* 토글 테이블 */}
        <Card
          title={view === '현재 위치' ? '금형 위치 / 점유 현황' : '입·출고 이력'}
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {(['현재 위치', '입출고 이력'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className="rounded-[7px] px-3 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${view === v ? C.teal : C.borderHi}`, background: view === v ? C.teal : '#fff', color: view === v ? '#fff' : C.ink2 }}>{v}</button>
              ))}
            </div>
          }
        >
          {view === '현재 위치' ? (
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {[['금형 / 자산', 'text-left'], ['분류', 'text-center'], ['지정 위치', 'text-center'], ['현재 위치 / 점유', 'text-left'], ['상태', 'text-center']].map(([h, al]) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.code} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{m.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{m.code}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={LOC_CAT[m.cat]}>{m.cat}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] text-ink3">{m.home}</td>
                    <td className="border-b border-border px-3 py-2.5"><div className="font-bold" style={{ color: m.state === '보관중' ? C.ink2 : C.ink }}>{m.cur}</div><div className="mt-px text-[9.5px] text-ink3">{m.holder} · {m.since}~</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(m.state)}>{m.state}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {[['전표 / 일시', 'text-left'], ['구분', 'text-center'], ['금형', 'text-left'], ['이동 (From → To)', 'text-left'], ['사유 / 담당', 'text-left']].map(([h, al]) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LOC_TX.map((t, i) => (
                  <tr key={t.no} className="align-top" style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={txTone(t.type)}>{t.type}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{t.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{t.code}</div></td>
                    <td className="border-b border-border px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                        <span className="text-ink3">{t.from}</span><span className="font-extrabold" style={{ color: C.teal }}>→</span><span className="font-bold text-ink">{t.to}</span>
                      </div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-ink2">{t.reason}<div className="mt-px text-[9.5px] text-ink3">{t.who}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* 등록 폼 */}
        <Card title="입·출고 등록">
          <div className="mb-4 flex overflow-hidden rounded-[9px] border border-border-hi">
            {([['출고', '대출', C.blue], ['반납', '입고', C.teal], ['반출', '외주', C.err]] as const).map(([m, sub, c], i) => {
              const on = mode === m;
              return (
                <button key={m} onClick={() => setMode(m)} className="flex-1 py-2 text-[12px] font-extrabold leading-tight" style={{ borderRight: i < 2 ? `1px solid ${C.borderHi}` : 'none', background: on ? c : '#fff', color: on ? '#fff' : C.ink3 }}>{m}<div className="text-[8.5px] font-semibold opacity-85">{sub}</div></button>
              );
            })}
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">금형 / 치공구</label>
            <div className="flex max-h-[168px] flex-col gap-1.5 overflow-y-auto">
              {rows.map((m) => {
                const on = m.code === moldCode;
                return (
                  <button key={m.code} onClick={() => setMoldCode(m.code)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left" style={{ border: `1.5px solid ${on ? C.teal : C.border}`, background: on ? C.tealSoft : '#fff' }}>
                    <span className="rounded-[5px] px-1.5 py-0.5 font-mono text-[8.5px] font-bold" style={{ color: on ? C.teal : C.blue, background: on ? '#fff' : C.bgDeep }}>{m.code}</span>
                    <span className="flex-1 text-[11px] font-bold text-ink">{m.name}</span>
                    <Pill tone={stTone(m.state)}>{m.state}</Pill>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between rounded-[9px] px-3.5 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[11px] font-semibold text-ink3">현재 위치</span>
            <span className="font-mono text-[12px] font-extrabold text-ink">{mold.cur}</span>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">{mode === '반납' ? '반납 위치(창고)' : mode === '반출' ? '반출처(업체)' : '대상 설비 / 라인'}</label>
            <span className="flex w-full items-center justify-between rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold text-ink">{mode === '반납' ? mold.home : mode === '반출' ? '동양프레스(외주)' : '설비 선택'} <span className="text-[8px] text-ink3">▾</span></span>
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">사유 / 작업번호</label>
            <div className="flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 text-[12.5px] font-medium text-ink3">{mode === '반출' ? 'MR-2606-XXX (수리)' : 'WO-2606-XXX (작업지시)'}</div>
          </div>

          <button className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: modeColor }}>{mode} 등록</button>
        </Card>
      </div>
    </div>
  );
}
