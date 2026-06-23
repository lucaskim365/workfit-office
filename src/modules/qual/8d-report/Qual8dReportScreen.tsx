import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';

const D8_ST: Record<string, Tone> = { 작성중: 'warn', 검토: 'info', 발행: 'ok', 고객승인: 'ok' };
const D8_DISC = ['팀 구성', '문제 정의', '봉쇄 조치(임시)', '근본 원인', '시정조치 선정', '시정조치 실행', '재발 방지', '완료·치하'];

interface D8 { no: string; voc: string; ncr: string; title: string; cust: string; owner: string; date: string; status: string; step: number; body: string[] }
const D8_LIST: D8[] = [
  { no: '8D-260620-002', voc: 'VOC-260621-007', ncr: 'NCR-260620-011', title: '기어 G-22T 치면 소음 클레임', cust: '현대모비스', owner: '박품질', date: '2026-06-21', status: '작성중', step: 5, body: ['품질(박품질·리더)·생산(김생산)·기술(정기술)·영업(한영업) 4인 CFT 구성. 회의 주기 일 1회.', '아산 조립라인 기어 치합 시 소음 발생, 35EA 반품. (5W2H) 06/20 고객 라인, 치합 마찰음, 발생률 약 2.3%.', '동일 LOT(L2605-0820) 출하분 전량 회수·격리. 재고 100% 소음 선별검사 실시, 양품만 재출하.', '호빙 가공 후 치면 조도 관리 미흡 + 열처리 경도 산포. (특성요인도·5-Why) 작업표준에 치면 조도 기준 누락.', '치면 연마 공정 추가(Ra0.8 관리), 작업표준서 개정, 호빙 공정 SPC 관리항목 도입.', '', '', ''] },
  { no: '8D-260619-001', voc: 'VOC-260618-004', ncr: 'NCR-260619-009', title: '샤프트 D-40 진원도 불량', cust: '현대모비스', owner: '박품질', date: '2026-06-20', status: '발행', step: 8, body: ['품질(박품질)·생산(김생산)·기술(정기술) 3인 CFT 구성.', '진원도 0.035mm(규격 ≤0.02) 60EA 발생. 고객 입고검사 적발.', '반품 60EA 전량 재선별. 동일 설비 가공분 100% 진원도 재검.', '연삭기 척 클램프 마모로 척킹 편심 발생. 척 정기점검에 클램프 마모 측정 누락.', '척 클램프 교체, 연삭기 일상점검에 클램프 마모 항목 추가.', '클램프 교체 및 60EA 재연삭 완료(회수 58EA). 점검표 개정 적용.', '척 클램프 마모 한계 표준화, 전 연삭기 수평전개. 후속 3LOT 진원도 모니터링 정상.', '재발 0건(2주). CFT 해단 및 사례 공유. 작업자 교육 완료.'] },
  { no: '8D-260615-003', voc: '—', ncr: 'NCR-260615-004', title: '식별·LOT 표시 누락 (내부감사)', cust: '내부', owner: '한품질', date: '2026-06-18', status: '고객승인', step: 8, body: ['품질·물류 2인 구성.', '3라인 LOT 식별표 미부착 다수 적발(내부감사).', '미표시 재공품 전수 식별표 부착.', '식별표 수작업 출력으로 누락 빈번.', '공정완료→라벨 자동발행 인터페이스 구축.', '인터페이스 구축 완료 및 적용.', '전 라인 자동라벨 수평전개.', '재발 0건. 감사 부적합 종결.'] },
  { no: '8D-260621-004', voc: 'VOC-260620-006', ncr: '—', title: '하우징 C-Type 포장 파손', cust: 'LG전자', owner: '한영업', date: '2026-06-21', status: '검토', step: 3, body: ['영업·품질·물류 3인 구성.', '납품 박스 파손으로 표면 스크래치 우려. 200EA.', '해당 LOT 재검사 및 포장 보강 후 재납품.', '', '', '', '', ''] },
];

/** 8D Report 발행·관리 — 와이어프레임 qual-8d-report.jsx 정본. */
export default function Qual8dReportScreen() {
  const [sel, setSel] = useState('8D-260620-002');
  const [tab, setTab] = useState('전체');
  const cur = D8_LIST.find((d) => d.no === sel) || D8_LIST[0];
  const rows = D8_LIST.filter((d) => tab === '전체' || (tab === '진행중' ? d.status === '작성중' || d.status === '검토' : d.status === '발행' || d.status === '고객승인'));

  const writing = D8_LIST.filter((d) => d.status === '작성중' || d.status === '검토').length;
  const issued = D8_LIST.filter((d) => d.status === '발행' || d.status === '고객승인').length;
  const approved = D8_LIST.filter((d) => d.status === '고객승인').length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">8D Report 발행·관리</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 추적·사후관리 / 8D Report 발행·관리</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '8D 발행', variant: 'primary' }, { icon: 'upload', label: '고객 전송', accent: 'excel' }, 'download']} />
      </div>

      <KpiGrid cols={4} items={[
        ['작성·검토중', '' + writing, '건', C.warn],
        ['발행 완료', '' + issued, '건', C.ok],
        ['고객 승인', '' + approved, '건', C.teal],
        ['평균 작성', '3.2', '일', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.25fr_1.4fr]">
        {/* 목록 */}
        <Card title="8D 보고서 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '진행중', '발행']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['8D / 제목', 'text-left'], ['고객', 'text-left'], ['진척', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => {
                const on = d.no === sel;
                return (
                  <tr key={d.no} onClick={() => setSel(d.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10px] font-bold" style={{ color: on ? C.teal : C.ink }}>{d.no}</div>
                      <div className="mt-0.5 text-[11px] font-bold leading-snug text-ink">{d.title}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-[10.5px]">{d.cust}<div className="text-[9px] text-ink3">{d.owner}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="mb-0.5 font-mono text-[10px] font-extrabold" style={{ color: d.step >= 8 ? C.ok : C.ink }}>D{Math.min(d.step + (d.step < 8 ? 1 : 0), 8)}/8</div>
                      <div className="mx-auto h-[5px] w-[44px] rounded-[3px]" style={{ background: C.bgDeep }}><div className="h-full rounded-[3px]" style={{ width: `${(d.step / 8) * 100}%`, background: d.step >= 8 ? C.ok : C.teal }} /></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={D8_ST[d.status]} solid={d.status === '고객승인'}>{d.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 문서 */}
        <Card title="8D 보고서" bodyClassName="p-0" action={<Pill tone={D8_ST[cur.status]} solid={cur.status === '고객승인'}>{cur.status}</Pill>}>
          <div className="px-4 py-3.5" style={{ borderBottom: `2px solid ${C.navy}`, background: C.panelAlt }}>
            <div className="flex items-baseline justify-between"><span className="text-[14px] font-extrabold" style={{ color: C.navy }}>8D 문제해결 보고서</span><span className="font-mono text-[9.5px] text-ink3">{cur.no}</span></div>
            <div className="mt-1 text-[12px] font-bold text-ink">{cur.title}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-[9.5px] text-ink3">
              <span>고객 <b className="text-ink2">{cur.cust}</b></span>
              <span>담당 <b className="text-ink2">{cur.owner}</b></span>
              <span>발행 <b className="font-mono text-ink2">{cur.date}</b></span>
              {cur.voc !== '—' && <span className="font-mono" style={{ color: C.blue }}>{cur.voc}</span>}
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1 border-b border-border px-4 py-3">
            {D8_DISC.map((_, i) => {
              const done = i < cur.step;
              const active = i === cur.step;
              return <div key={i} className="flex h-[22px] items-center justify-center rounded-[5px] text-[9px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? C.navy : '#fff', border: done || active ? 'none' : `1px solid ${C.borderHi}` }}>{done ? '✓' : 'D' + (i + 1)}</div>;
            })}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {D8_DISC.map((title, i) => {
              const filled = cur.body[i] && cur.body[i].length > 0;
              const active = i === cur.step;
              return (
                <div key={i} className="flex gap-3 px-4 py-3" style={{ borderBottom: i < 7 ? `1px solid ${C.border}` : 'none', background: active ? '#fbfcfe' : '#fff' }}>
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold" style={{ color: filled ? '#fff' : active ? C.navy : C.ink3, background: filled ? C.ok : active ? C.blueSoft : C.panelAlt, border: active && !filled ? `1.5px solid ${C.navy}` : 'none' }}>D{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="text-[11.5px] font-extrabold text-ink">{title}</span>
                      {filled ? <Pill tone="ok">완료</Pill> : active ? <Pill tone="warn">작성중</Pill> : <Pill tone="mute">대기</Pill>}
                    </div>
                    {filled ? <div className="text-[10px] leading-relaxed text-ink2">{cur.body[i]}</div> : <div className="text-[10px] italic text-ink3">{active ? '내용 작성 필요' : '이전 단계 완료 후 진행'}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 border-t border-border px-4 py-3.5">
            <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white disabled:cursor-not-allowed" disabled={cur.step < 8} style={{ background: cur.step >= 8 ? C.navy : C.borderHi }}>{cur.status === '고객승인' ? '승인 완료됨' : cur.step >= 8 ? '8D 발행·고객 전송 →' : `D${cur.step + 1} 작성 진행`}</button>
            <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">PDF</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
