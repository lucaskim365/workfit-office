import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';

const CAPA_ST: Record<string, Tone> = { 진행: 'warn', 지연: 'err', 검증: 'info', 종결: 'ok' };
const CAPA_SRC: Record<string, string> = { NCR: C.teal, '고객 클레임': C.err, '내부 감사': C.blue, '반복 불량': '#8a5cf6' };
const CAPA_8D = ['D1 팀구성', 'D2 문제정의', 'D3 봉쇄조치', 'D4 근본원인', 'D5 시정선정', 'D6 시정실행', 'D7 재발방지', 'D8 완료'];
const actTone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행' ? 'warn' : 'mute');

interface Capa { no: string; type: string; src: string; ref: string; title: string; owner: string; team: string; due: string; status: string; step: number; problem: string; root: string; actions: [string, string, string, string, string][]; verify: string }
const CAPA_LIST: Capa[] = [
  { no: 'CAPA-260621-003', type: '시정', src: '고객 클레임', ref: 'NCR-260620-011', title: '기어 G-22T 치면 소음 클레임', owner: '박품질', team: '품질·생산·기술', due: '2026-06-28', status: '진행', step: 5, problem: '고객(현대모비스) 라인 조립 중 기어 치합 소음 발생. 35EA 반품 접수.', root: '호빙 가공 후 치면 조도 관리 미흡 + 열처리 경도 산포로 치합 마찰 소음 발생. (5-Why) 작업표준에 치면 조도 기준이 누락되어 있었음.', actions: [['시정', '치면 연마 공정 추가 · 조도 Ra0.8 관리', '정기술', '06-25', '진행'], ['시정', '반품품 35EA 전수 재선별', '이작업', '06-23', '완료'], ['예방', '작업표준서 치면 조도 기준 반영', '박품질', '06-27', '대기'], ['예방', '호빙 공정 SPC 관리항목 추가', '김생산', '06-28', '대기']], verify: '예정 (D8)' },
  { no: 'CAPA-260620-002', type: '예방', src: '반복 불량', ref: 'D-DIM-OS', title: 'CNC 외경 과대 반복 발생 (3개월 5건)', owner: '정기술', team: '기술·생산', due: '2026-06-30', status: '지연', step: 4, problem: '최근 3개월 CNC 가공 외경 과대 불량 5건 반복. 공구 마모 주기 관리 부재 추정.', root: '절삭공구 교체 주기가 작업자 경험에 의존 → 마모 한계 초과 사용으로 치수 산포 확대. (5-Why) 공구 수명 관리 시스템 부재.', actions: [['시정', '해당 공구 즉시 교체 및 초물 재검', '김작업', '06-20', '완료'], ['예방', '공구 수명 카운터 도입(타수 기반 알람)', '정기술', '06-30', '진행'], ['예방', '공구 교체 주기 표준화 및 점검표 비치', '김생산', '06-28', '지연']], verify: '예정 (D8)' },
  { no: 'CAPA-260619-001', type: '시정', src: 'NCR', ref: 'NCR-260619-009', title: '샤프트 진원도 불량 시정', owner: '박품질', team: '품질·생산', due: '2026-06-25', status: '검증', step: 7, problem: '샤프트 D-40 진원도 0.035mm(규격 ≤0.02) 60EA 발생. 연삭 척킹 편심 추정.', root: '연삭기 척 클램프 마모로 편심 발생. (5-Why) 척 정기점검 항목에 클램프 마모 측정 누락.', actions: [['시정', '척 클램프 교체 및 진원도 재검', '이작업', '06-19', '완료'], ['시정', '재작업 60EA 재연삭', '김작업', '06-20', '완료'], ['예방', '연삭기 일상점검에 클램프 마모 항목 추가', '박품질', '06-24', '완료']], verify: '진행중 — 후속 3LOT 모니터링' },
  { no: 'CAPA-260615-004', type: '예방', src: '내부 감사', ref: 'AUDIT-2606-02', title: '식별·LOT 표시 누락 시스템 개선', owner: '한품질', team: '품질·물류', due: '2026-06-18', status: '종결', step: 8, problem: '내부 품질감사 중 3라인 LOT 식별표 미부착 다수 적발.', root: '식별표 출력이 수작업이라 누락 빈번. (5-Why) 공정 완료 시 자동 라벨 발행 연동 부재.', actions: [['시정', '미표시 재공품 전수 식별표 부착', '이작업', '06-16', '완료'], ['예방', '공정완료 → 라벨 자동발행 인터페이스 구축', '한품질', '06-18', '완료']], verify: '유효 — 재발 0건 (2주 모니터링)' },
];

/** 시정 및 예방 조치(CAPA) — 와이어프레임 qual-capa.jsx 정본. */
export default function QualCapaScreen() {
  const [sel, setSel] = useState('CAPA-260621-003');
  const [tab, setTab] = useState('전체');
  const cur = CAPA_LIST.find((c) => c.no === sel) || CAPA_LIST[0];
  const rows = CAPA_LIST.filter((c) => tab === '전체' || (tab === '미종결' ? c.status !== '종결' : c.status === '종결'));

  const open = CAPA_LIST.filter((c) => c.status !== '종결').length;
  const delayed = CAPA_LIST.filter((c) => c.status === '지연').length;
  const closed = CAPA_LIST.filter((c) => c.status === '종결').length;
  const actDone = CAPA_LIST.flatMap((c) => c.actions).filter((a) => a[4] === '완료').length;
  const actTotal = CAPA_LIST.flatMap((c) => c.actions).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">시정 및 예방 조치(CAPA)</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 부적합·불량 관리 / 시정 및 예방 조치(CAPA)</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: 'CAPA 등록', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['진행중 CAPA', '' + open, '건', C.warn],
        ['기한 지연', '' + delayed, '건', C.err],
        ['금월 종결', '' + closed, '건', C.ok],
        ['조치 완료율', Math.round((actDone / actTotal) * 100) + '%', '', C.blue],
        ['평균 처리', '6.8', '일', C.ink],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1.25fr]">
        {/* 목록 */}
        <Card title="CAPA 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '미종결', '종결']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['CAPA / 발생원', 'text-left'], ['제목 / 담당', 'text-left'], ['8D', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => {
                const on = c.no === sel;
                return (
                  <tr key={c.no} onClick={() => setSel(c.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10px] font-bold" style={{ color: on ? C.teal : C.ink }}>{c.no}</div>
                      <div className="mt-1"><span className="rounded-[5px] px-1.5 py-px text-[9px] font-bold" style={{ color: CAPA_SRC[c.src], border: `1px solid ${CAPA_SRC[c.src]}44` }}>{c.src}</span></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold leading-snug text-ink">{c.title}</div><div className="mt-0.5 text-[9.5px] text-ink3">{c.owner} · {c.type}조치</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="mb-0.5 font-mono text-[10.5px] font-extrabold" style={{ color: c.step >= 8 ? C.ok : C.ink }}>{c.step}/8</div>
                      <div className="mx-auto h-[5px] w-[46px] rounded-[3px]" style={{ background: C.bgDeep }}><div className="h-full rounded-[3px]" style={{ width: `${(c.step / 8) * 100}%`, background: c.status === '지연' ? C.err : c.step >= 8 ? C.ok : C.teal }} /></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={CAPA_ST[c.status]} solid={c.status === '종결'}>{c.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="CAPA 상세" bodyClassName="p-0" action={<Pill tone={CAPA_ST[cur.status]} solid={cur.status === '종결'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center gap-2"><Pill tone={cur.type === '시정' ? 'warn' : 'info'}>{cur.type}조치</Pill><span className="text-[9px] font-bold" style={{ color: CAPA_SRC[cur.src] }}>{cur.src} · {cur.ref}</span></div>
            <div className="text-[13.5px] font-extrabold leading-snug text-ink">{cur.title}</div>
            <div className="mt-0.5 font-mono text-[10px] text-ink3">{cur.no} · 담당 {cur.owner} · 팀 {cur.team} · 기한 {cur.due}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">8D 진행 단계</div>
            <div className="grid grid-cols-8 gap-1">
              {CAPA_8D.map((d, i) => {
                const done = i < cur.step;
                const active = i === cur.step;
                const c = done ? C.ok : active ? (cur.status === '지연' ? C.err : C.navy) : C.borderHi;
                return (
                  <div key={i} className="text-center">
                    <div className="flex h-[26px] items-center justify-center rounded-md text-[10px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? c : '#fff', border: done || active ? 'none' : `1px solid ${C.borderHi}` }}>{done ? '✓' : 'D' + (i + 1)}</div>
                    <div className="mt-0.5 whitespace-nowrap text-[7px]" style={{ color: active ? C.ink : C.ink3, fontWeight: active ? 700 : 500 }}>{d.split(' ')[1]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-1.5 text-[10px] font-bold text-ink3">문제 정의 (D2)</div>
            <div className="mb-2.5 text-[10.5px] leading-relaxed text-ink2">{cur.problem}</div>
            <div className="mb-1.5 text-[10px] font-bold text-ink3">근본 원인 (D4)</div>
            <div className="rounded-[7px] px-2.5 py-2 text-[10.5px] leading-relaxed text-ink2" style={{ background: C.panelAlt, borderLeft: `3px solid ${C.warn}` }}>{cur.root}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">조치 항목 (D5~D7) · {cur.actions.length}</div>
            <div className="flex flex-col gap-1.5">
              {cur.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-[7px] px-2.5 py-2" style={{ background: C.panelAlt }}>
                  <span className="shrink-0 rounded px-1.5 py-px text-[8.5px] font-extrabold" style={{ color: a[0] === '시정' ? C.warn : C.blue, border: `1px solid ${(a[0] === '시정' ? C.warn : C.blue)}55` }}>{a[0]}</span>
                  <div className="min-w-0 flex-1"><div className="text-[10.5px] font-bold leading-snug text-ink">{a[1]}</div><div className="mt-px text-[9px] text-ink3">{a[2]} · ~{a[3]}</div></div>
                  <Pill tone={actTone(a[4])} solid={a[4] === '지연'}>{a[4]}</Pill>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between rounded-[9px] px-3.5 py-2.5" style={{ background: cur.status === '종결' ? C.tealSoft : C.panelAlt }}>
              <div>
                <div className="mb-0.5 text-[9.5px] text-ink3">효과성 검증 (D8)</div>
                <div className="text-[11px] font-bold" style={{ color: cur.status === '종결' ? C.ok : C.ink2 }}>{cur.verify}</div>
              </div>
              <span className="text-[18px]">{cur.status === '종결' ? '✓' : '◷'}</span>
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: cur.status === '종결' ? C.borderHi : C.navy }}>{cur.status === '종결' ? '종결 완료됨' : cur.status === '검증' ? '효과성 검증·종결 →' : '조치 진행 업데이트'}</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">8D 리포트</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
