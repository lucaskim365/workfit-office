import { useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { diffDays, isDone, leftText, monthDay } from '@/domain/pm/rules';
import {
  AGR_KINDS, agrJudge, agrWarn, asIssues, dday, dlEff, dlLeftText, fnSt, govItems, govRec, govWbsCheck, isPre, planSum, preSteps,
  SITE_STAGES, stageBuckets, stageKeyTasks, warrantyEnd, type FnLink, type FnState, type GovWbsState, type SiteCtx, type SiteStage, type SiteUpdate,
} from '@/domain/pm/site';
import type { PmAgreementChange, PmTask } from '@/domain/pm/schema';
import { EmptyHint, Tag } from '../wbs/parts';
import { DocSeg } from '../doc/parts';
import type { DocSt, DocState } from '@/domain/pm/doc';
import { CardHead } from './parts';

/**
 * 사업별 화면 카드 (데모 flowCard · bidCard · afterCard · 사업 개요 · updCard · agrCard · govWbsCard · 계획서 약속 기능 진척).
 * 아직 옮기지 않은 화면으로 가는 버튼은 보이게 두고 꺼 둠 — 제목에 몇 단계에서 켜는지 (§5.3.2).
 */

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-border bg-panel shadow-sm ${className}`}>{children}</section>
);
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const FN_TONE: Record<FnState, 'ok' | 'bad' | 'run' | 'plain' | 'warn'> = { 완료: 'ok', 지연: 'bad', '진행 중': 'run', '시작 전': 'plain', '연결 없음': 'warn', 기존: 'plain' };
/** 만원 (won) — 1억 이상은 '4.0억원' */
const won = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(n % 10000 ? 1 : 0)}억원` : `${n.toLocaleString()}만원`);
/** 천원 → 만원 (chon) */
const chon = (v: number) => Math.round(v) / 10;
const fmtN = (v: number | string) => (v === '' || v == null ? '-' : (+v).toLocaleString(undefined, { maximumFractionDigits: 2 }));

/** 사업 흐름 5단계 + 지금 단계 주요 업무 (flowCard) */
export function FlowCard({ c, st, nameOf, onOpenTask, onGoWbs, docOf, onSetDoc, onGoDoc }: {
  c: SiteCtx;
  st: SiteStage;
  nameOf: (id: string) => string;
  onOpenTask: (id: string) => void;
  onGoWbs: () => void;
  /** 산출물 상태 (4단계 docOf) · 상태 바꾸기 (docSet3) · 산출물 화면 (inspDoc) */
  docOf: (t: PmTask) => DocState;
  onSetDoc: (taskId: string, v: DocSt) => void;
  onGoDoc: () => void;
}) {
  const SB = stageBuckets(c, (t) => docOf(t).st === '제출완료');
  const cb = SB[st.i];
  const [gate, setGate] = useState(false);
  const nx = st.next;
  const key = stageKeyTasks(c, cb);
  const shown = key.slice(0, 5);
  const gateMiss = SB.slice(0, st.i).reduce((a, b) => a + (b.on - b.od), 0);
  const gOpen = gateMiss > 0 && gate;
  const missList = gOpen ? SB.slice(0, st.i).flatMap((b, j) => b.L.filter((t) => t.output && !isPre(t) && docOf(t).st !== '제출완료').map((t) => [t, j] as const)) : [];
  const who = (t: PmTask) => (t.assigneeIds[0] ? nameOf(t.assigneeIds[0]) : '');
  return (
    <Card>
      <div className="px-4 pb-3 pt-4">
        <div className="grid grid-cols-5 gap-2">
          {SITE_STAGES.map((s, j) => {
            const b = SB[j];
            const isCur = j === st.i;
            const past = j < st.i;
            return (
              <div key={s.n} className="text-center" title={s.hint}>
                <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 text-[12px] font-bold ${past ? 'border-blue bg-blue text-white' : isCur ? (st.bad ? 'border-danger bg-panel text-danger' : 'border-blue bg-panel text-blue') : 'border-border-hi bg-panel text-ink3'}`}>{past ? '✓' : j + 1}</div>
                <div className={`mt-1 text-[12.5px] font-bold ${isCur ? 'text-ink' : 'text-ink2'}`}>{s.n}</div>
                {isCur && st.sub ? <div className={`text-[11px] font-bold ${st.bad ? 'text-danger' : 'text-blue'}`}>{st.sub}</div> : <div className="text-[11px] text-ink3">{st.per[j] || ' '}</div>}
                {b.n > 0 && (
                  <div className="mx-auto mt-1.5 max-w-[160px]" title={`이 단계 업무 ${b.n}건 · 평균 진도율 ${b.p}%${b.on ? ` · 산출물 제출 ${b.od}/${b.on}` : ''}`}>
                    <div className="h-1.5 overflow-hidden rounded-full bg-panel-alt"><i className={`block h-full ${b.p >= 100 ? 'bg-ok' : b.late && j <= st.i ? 'bg-danger' : 'bg-blue'}`} style={{ width: `${b.p}%` }} /></div>
                    <div className="mt-0.5 flex justify-center gap-1.5 text-[10.5px] text-ink3">
                      <b className="text-ink2">{b.p}%</b><span>업무 {b.n}</span>
                      {b.on > 0 && (j < st.i && b.od < b.on
                        ? <button type="button" className="font-bold text-danger underline" onClick={() => setGate((x) => !x)}>산출물 미제출 {b.on - b.od} ▾</button>
                        : <span className={b.od === b.on ? 'text-ok' : ''}>산출물 {b.od}/{b.on}</span>)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2.5 text-[12px]">
          <span className="text-ink3">지금 단계</span><b className="text-ink">{st.n}</b><span className="text-ink3">— {SITE_STAGES[st.i].hint}</span>
          <span className="flex-1" />
          {nx && (
            <>
              <span className="text-ink3">다음 관문</span>
              <b className={dlEff(nx) < c.today ? 'text-danger' : 'text-ink'} title={nx.t}>{trunc(nx.t, 28)}</b>
              <span className={dlEff(nx) < c.today ? 'text-danger' : 'text-ink3'} title={nx.inner ? '서류를 내는 일은 기한 7일 전을 내부 마감으로 봅니다 (기한 목록과 같은 기준)' : ''}>{dlLeftText(nx, c.today)}</span>
            </>
          )}
        </div>
        {st.i !== 4 && (
          <div className="mt-2.5">
            <div className="flex flex-wrap items-center gap-2 pb-1.5 text-[12px]">
              <b className="text-ink">{gOpen ? '지난 단계 미제출 산출물' : `${st.n} 단계 주요 업무`}</b>
              {!gOpen && <span className="text-[11px] text-ink3">늦은 일 · 마일스톤 · 마감 가까운 순</span>}
              {gateMiss > 0 && <Button size="sm" variant={gOpen ? 'primary' : 'secondary'} onClick={() => setGate((x) => !x)}>지난 단계 산출물 미제출 {gateMiss}건 {gOpen ? '▴' : '▾'}</Button>}
              <span className="flex-1" />
              {!gOpen && key.length > shown.length && <span className="text-[11px] text-ink3">외 {key.length - shown.length}건</span>}
              {!gOpen && <Button size="sm" variant="secondary" onClick={onGoWbs}>업무 목록에서 보기 →</Button>}
            </div>
            {gOpen ? (
              <>
                <div className="pb-1 text-[11px] text-ink3">지난 단계에서 아직 제출 안 된 산출물입니다. 오른쪽에서 바로 상태를 바꿀 수 있어요.</div>
                {missList.map(([t, j]) => (
                  <div key={t.id} className="flex w-full items-center gap-2 border-b border-border py-1.5 text-[12px] last:border-b-0">
                    <Tag>{SITE_STAGES[j].n}</Tag>
                    <button type="button" onClick={() => onOpenTask(t.id)} title="업무 보기" className="min-w-0 flex-1 truncate text-left hover:underline">📄 {t.output} <span className="text-ink3">{t.code} · {t.name}</span></button>
                    {who(t) ? <span className="text-ink2">{who(t)}</span> : <Tag tone="warn">담당 없음</Tag>}
                    <span className="w-[54px] text-right leading-tight"><b>{t.end ? monthDay(t.end) : '-'}</b> <small className="text-ink3">마감</small></span>
                    <DocSeg st={docOf(t).st} onSet={(v) => onSetDoc(t.id, v)} />
                  </div>
                ))}
                <div className="pt-1.5 text-right"><Button size="sm" variant="secondary" onClick={onGoDoc}>산출물 화면 전체 보기 →</Button></div>
              </>
            ) : shown.length ? shown.map((t) => {
              const lt = !!t.end && t.end < c.today;
              const w = who(t);
              return (
                <button key={t.id} type="button" onClick={() => onOpenTask(t.id)} className="flex w-full items-center gap-3 border-b border-border py-1.5 text-left text-[12px] last:border-b-0 hover:bg-panel-alt">
                  <b className={`w-[42px] flex-none text-right ${lt ? 'text-danger' : 'text-ink2'}`}>{c.live(t).pct || 0}%</b>
                  <span className="min-w-0 flex-1 truncate text-ink">{t.milestone && <span className="text-amber">◆ </span>}{t.name}{t.output && <small className="ml-1.5 text-ink3">{t.output}</small>}</span>
                  {w ? <span className="flex-none text-ink2">{w}</span> : <Tag tone="warn">담당 없음</Tag>}
                  <span className={`w-[90px] flex-none text-right ${lt ? 'text-danger' : t.end && diffDays(c.today, t.end) <= 7 ? 'text-amber' : 'text-ink3'}`}><b>{t.end ? monthDay(t.end) : '-'}</b> <small>{t.end ? leftText(t.end, c.today) : ''}</small></span>
                </button>
              );
            }) : <div className="py-2 text-[11.5px] text-ink3">{cb.n ? '이 단계 업무를 모두 끝냈습니다' : '업무 목록에 이 단계 업무가 없습니다 (업무 종료일로 단계를 나눕니다)'}</div>}
          </div>
        )}
      </div>
    </Card>
  );
}

/** 수주 진행 (bidCard) — 협약 이전 업무 단계 + 선정 결과 */
export function BidCard({ c, nameOf, onBidRes }: { c: SiteCtx; nameOf: (id: string) => string; onBidRes: (v: '' | '선정' | '탈락') => void }) {
  const s = c.p;
  const P = preSteps(c);
  const done = P.filter((g) => g.st === '완료').length;
  const dates: Array<[string, string]> = [['공고 마감', s.annDue], ['선정평가', s.evalDate], ['협약 시작 (예정)', s.start]];
  const at = s.bidAt;
  return (
    <Card>
      <CardHead title="수주 진행">
        <span className="text-[11.5px] text-ink3">협약 이전 단계 {done} / {P.length}</span>
        <span className="flex-1" />
        {dates.map(([l, d], i) => (
          <span key={l} className="text-[11.5px] text-ink2">{i > 0 && <span className="text-ink3"> · </span>}{l} {d ? <b className={d < c.today ? 'text-danger' : ''}>{monthDay(d)} ({dday(d, c.today)})</b> : <span className="text-ink3">미입력</span>}</span>
        ))}
      </CardHead>
      <div className={`flex flex-wrap items-center gap-2 px-4 py-2 text-[12px] ${s.bidRes === '탈락' ? 'bg-amber-soft' : s.bidRes ? 'bg-ok/10' : 'bg-blue-soft'}`}>
        {s.bidRes ? (
          <>
            <span className="flex-1"><b>{s.bidRes}</b>{at?.date ? ` · ${monthDay(at.date)} 기록${at.by ? ` · ${nameOf(at.by)}` : ''}` : ''}
              {s.bidRes === '탈락' ? ' — 통합 사업 현황 · 알림 · 내 업무 · 진행률 갱신 · 팀 현황에서 빠졌습니다. 이 화면과 업무 목록에서는 그대로 볼 수 있습니다' : ' — 협약일이 정해지면 사업 정보에서 협약 시작 · 종료일을 맞춰 주세요'}</span>
            <Button size="sm" variant="secondary" onClick={() => onBidRes('')}>결과 지우기</Button>
          </>
        ) : (
          <>
            <span className="flex-1">선정 결과가 나오면 기록하세요{s.evalDate && s.evalDate < c.today && <b> (선정평가 {monthDay(s.evalDate)} 끝남)</b>}</span>
            <Button size="sm" onClick={() => onBidRes('선정')}>선정</Button>
            <Button size="sm" variant="secondary" onClick={() => onBidRes('탈락')}>탈락</Button>
          </>
        )}
      </div>
      <table className="w-full text-[12px]">
        <thead><tr className="border-b border-border text-left text-[11px] text-ink3"><th className="px-4 py-1.5">단계</th><th>기간</th><th>업무</th><th>상태</th></tr></thead>
        <tbody>
          {P.length ? P.map((g) => {
            const left = g.ts.filter((t) => !isDone(c.live(t))).map((t) => t.name.replace(/^\[[^\]]+\]\s*/, ''));
            return (
              <tr key={g.id} className="border-b border-border">
                <td className="px-4 py-1.5 font-bold">{g.nm}</td>
                <td className="whitespace-nowrap text-ink2">{g.a ? `${monthDay(g.a)}~${monthDay(g.z)}` : '-'}</td>
                <td>{g.n} / {g.ts.length} 완료{left.length > 0 && <span className="text-ink3" title={left.join(', ')}> · 남은 일: {trunc(left.join(', '), 40)}</span>}</td>
                <td><Tag tone={FN_TONE[g.st as FnState] ?? 'plain'}>{g.st}</Tag></td>
              </tr>
            );
          }) : <tr><td colSpan={4} className="px-4 py-3 text-ink3">협약 이전 업무가 없습니다 — 표준 업무 양식(템플릿)을 적용하면 생깁니다</td></tr>}
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-ink3">※ 협약 이전 업무 기준입니다. 마지막 '착수 인수인계(영업→PM)'까지 끝내고 협약 시작일이 되면 착수 단계로 넘어갑니다. 공고 마감일 · 선정평가일은 사업 정보에서 넣습니다 (사업 정보 수정은 6단계).</p>
    </Card>
  );
}

/** 사후관리 (afterCard) — 하자보증 · 인수인계 · 집중AS · 하자/AS 요청(= 협약 종료 뒤 이슈) */
export function AfterCard({ c, nameOf, onAsAdd }: { c: SiteCtx; nameOf: (id: string) => string; onAsAdd: () => void }) {
  const s = c.p;
  const we = warrantyEnd(s);
  const L = asIssues(c);
  const open = L.filter((i) => i.status !== '해결');
  const G = govItems(c);
  const tot = we ? diffDays(s.end, we) : 0;
  const el = we ? Math.max(0, Math.min(tot, diffDays(s.end, c.today))) : 0;
  const row = (id: string, nm: string) => {
    const g = G?.find((x) => x.id === id);
    if (!g) return null;
    return (
      <tr className="border-b border-border"><td className="px-4 py-1.5 font-bold">{nm}</td><td>{g.t}</td><td className="whitespace-nowrap">{g.due ? `${monthDay(g.due)} · ${dday(g.due, c.today)}` : '-'}</td>
        <td>{govRec(c, g) ? <Tag tone="ok">완료</Tag> : <Tag tone={g.due && g.due < c.today ? 'bad' : 'warn'}>남음</Tag>}</td></tr>
    );
  };
  return (
    <Card>
      <CardHead title="사후관리">
        <span className="text-[11.5px] text-ink3">{we ? `하자보증 ${s.warrantyM}개월 · ${s.end} ~ ${we}` : '하자보증 기간 미입력 — 사업 정보에서 넣습니다 (6단계)'}</span>
        <span className="flex-1" />
        {we && (
          <span className="flex min-w-[180px] items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-alt"><i className="block h-full bg-blue" style={{ width: `${tot ? (el / tot) * 100 : 100}%` }} /></span>
            <b className={`text-[11.5px] ${we < c.today ? 'text-ink3' : diffDays(c.today, we) <= 30 ? 'text-danger' : ''}`}>{we < c.today ? '보증 끝' : dday(we, c.today)}</b>
          </span>
        )}
      </CardHead>
      <table className="w-full text-[12px]">
        <tbody>
          {row('g_handover', '인수인계 · 기술임치')}
          {row('g_as', '집중AS')}
          <tr><td className="px-4 py-1.5 font-bold">하자 · AS 요청</td>
            <td>{L.length ? <>처리 중 <b className={open.length ? 'text-danger' : ''}>{open.length}</b> · 해결 {L.length - open.length}</> : <span className="text-ink3">접수된 요청 없음</span>}
              {open.slice(0, 5).map((i) => <div key={i.id}>· {trunc(i.title, 40)} <span className="text-ink3">{monthDay(i.date)} · {nameOf(i.ownerId)} · {i.status}</span></div>)}</td>
            <td /><td><Button size="sm" onClick={onAsAdd} title="이 사업으로 이슈를 등록합니다 (협약 종료 뒤 이슈 = 하자 · AS 요청)">+ 하자 · AS 접수</Button></td></tr>
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-ink3">※ 협약 종료일({monthDay(s.end)}) 이후 이 사업으로 등록한 이슈를 하자 · AS 요청으로 셉니다. 하자보증은 협약 종료일부터 계산합니다.</p>
    </Card>
  );
}

/** 사업 개요 (pSiteSum info) — 사업 정보 + 계획서 내장 데이터 */
export function InfoCard({ c, short, onKpi, money, manage, onEdit, onMoney }: { c: SiteCtx; short: string; onKpi: () => void; money: boolean; manage: boolean; onEdit: () => void; onMoney: () => void }) {
  const s = c.p;
  const p = c.plan;
  const kv = (k: ReactNode, v: ReactNode, title?: string) => (
    <><span className="text-ink3" title={title}>{k}</span><span className="min-w-0 text-ink">{v}</span></>
  );
  const missTag = <Tag tone="warn">미입력</Tag>;
  const buyer = [s.ceo && `대표 ${s.ceo}`, s.industry, s.region].filter(Boolean).join(' · ');
  return (
    <Card>
      <CardHead title="사업 개요">
        <span className="flex-1" />
        <Button size="sm" variant="secondary" disabled={!manage} title={manage ? '협약 기간 · PM · 도입기업 · 현장 담당자 · 사업비를 고칩니다' : '사업 정보 수정은 프로젝트 관리(PMS) 관리 권한이 필요합니다'} onClick={onEdit}>정보 수정</Button>
        <Button size="sm" variant="secondary" disabled title="계획서 PDF 원본 보관은 파일 저장소를 연결하는 7단계에서 켭니다. 계획서 내용(기능 목록 · 성과지표)은 이미 들어 있습니다">{p ? '계획서 PDF 등록' : '계획서 등록'} (7단계)</Button>
        {p ? <Tag tone="ok" title={p.file ?? ''}>계획서 {p.ver ?? ''}</Tag> : <Tag>사업계획서 미등록</Tag>}
      </CardHead>
      <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 px-4 py-3 text-[12px]">
        {kv('사업', <>{s.company} · {s.biz || '-'} <span className="text-[11px] text-ink3">{s.bizNo}</span></>)}
        {kv('운영기관 · PM', `${s.org || '-'} · ${s.pmName || '-'}`)}
        {kv('공급기업', s.supplier || '-')}
        {kv('도입기업 정보', <>{buyer || <Tag tone="warn" title="사업 정보 › 도입기업 정보">대표 · 업종 · 소재지 미입력</Tag>}{s.bizRegNo && <span className="ml-1 text-[11px] text-ink3">{s.bizRegNo}</span>}</>, '대표자 · 업종 · 소재지 · 사업자번호 (업체 이름은 위 \'사업\' 줄)')}
        {kv('현장 담당자', <>{s.contactName || missTag}{(s.contactPhone || s.contactEmail) && <span className="ml-1 text-[11px] text-ink3">{[s.contactPhone, s.contactEmail].filter(Boolean).join(' · ')}</span>}</>)}
        {p ? (
          <>
            {kv('목표 수준', p.level?.[1] ? <>{p.level[0] || '-'} → <b>{p.level[1]}</b></> : '-')}
            {money && kv('사업비', <span className="inline-flex flex-wrap items-center gap-1.5"><span>{planSum(p) ? <>{won(chon(planSum(p)))} <span className="text-[11px] text-ink3">(정부 {won(chon(planSum(p, 2)))})</span></> : s.budget ? <>{won(Math.round(s.budget / 10000))}{s.subsidy ? <span className="text-[11px] text-ink3"> (정부 {won(Math.round(s.subsidy / 10000))})</span> : null}</> : '-'}</span><Button size="sm" variant="secondary" onClick={onMoney} title="사업 · 손익에서 이 사업의 매출 · 이익 보기">수익 보기 ›</Button></span>)}
            {kv('구축 목표', (p.goal ?? []).length ? <div>{p.goal!.map((g) => <div key={g}>· {g}</div>)}</div> : '-')}
            {kv('성과지표', (p.kpis ?? []).length ? (
              <div>{p.kpis!.map((x) => <div key={x.name}>· {x.name} <span>{fmtN(x.base)} → <b>{fmtN(x.target)}</b> {x.unit ?? ''}</span></div>)}
                <Button size="sm" variant="secondary" onClick={onKpi} title="구축 후 실측값을 기록하고 목표 달성도를 봅니다 (최종평가 대비)">실측 기록 ›</Button></div>
            ) : '-')}
          </>
        ) : kv('사업계획서', <span className="text-ink3">이 사업은 계획서 내용이 들어 있지 않습니다. 계획서 등록(PDF에서 기능 목록 · 성과지표 읽기)은 파일 저장소를 연결하는 7단계에서 켭니다.</span>)}
      </div>
      <span className="sr-only">{short}</span>
    </Card>
  );
}

/** 최근 업데이트 (updCard) — 주간 특이사항 · 점검 결과 · 협약변경. [이번 주 특이사항 쓰기] = 주간 진행률 화면 (wcGo) */
export function UpdatesCard({ L, nameOf, noteNow, onWrite }: { L: SiteUpdate[]; nameOf: (id: string) => string; noteNow: boolean; onWrite: () => void }) {
  const btn = <Button size="sm" variant={noteNow ? 'secondary' : 'primary'} onClick={onWrite} title="주간 진행률 화면의 특이사항 칸">{noteNow ? '이번 주 특이사항 고치기' : '이번 주 특이사항 쓰기'}</Button>;
  if (!L.length) {
    return <Card><CardHead title="최근 업데이트"><span className="flex-1" /><span className="text-[11px] text-ink3">0건 · 주간 특이사항 · 점검 결과 · 협약변경이 쌓입니다</span>{btn}</CardHead></Card>;
  }
  return (
    <Card>
      <CardHead title="최근 업데이트"><span className="flex-1" /><span className="text-[11px] text-ink3">{L.length}건</span>{btn}</CardHead>
      <div className="max-h-[190px] overflow-y-auto px-4 py-1.5">
        {L.map((x, i) => (
          <div key={i} className="flex items-start gap-2 border-b border-border py-1.5 text-[12px] last:border-b-0">
            <b className="w-[38px] flex-none">{monthDay(x.d)}</b><Tag>{x.tag}</Tag>
            <span className="min-w-0 flex-1" title={x.txt}>{trunc(x.txt, 90)}</span>
            {x.who && <span className="whitespace-nowrap text-[11px] text-ink3">{nameOf(x.who)}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** 협약변경 기록 (agrCard) */
export function AgreementCard({ c, onNew, onEdit }: { c: SiteCtx; onNew: () => void; onEdit: (x: PmAgreementChange) => void }) {
  const L = [...c.agr].reverse();
  const w = agrWarn(c);
  const rule = '3개월 이상 기간 연장 · 범위 · 금액 · KPI · 공급기업 변경은 승인, 3개월 미만 연장 · 투입인력 변경 등은 등록 (세부관리기준 24조)';
  if (!L.length && !w) {
    return <Card><CardHead title="협약변경 기록"><span className="flex-1" /><span className="text-[11px] text-ink3" title={rule}>0건 · 기간 연장 · 인력 · 장비 변경이 생기면 기록</span><Button size="sm" variant="secondary" onClick={onNew}>+ 변경 기록</Button></CardHead></Card>;
  }
  return (
    <Card>
      <CardHead title="협약변경 기록"><span className="flex-1" /><span className="text-[11px] text-ink3">{L.length}건</span><Button size="sm" variant="secondary" onClick={onNew}>+ 변경 기록</Button></CardHead>
      <div className="px-4 py-2">
        {w && (
          <div className={`mb-2 rounded-lg border px-3 py-2 text-[12px] ${w.kind === '승인' ? 'border-danger/30 bg-danger/10' : 'border-amber/30 bg-amber-soft'}`}>
            업무 목록이 협약 종료일보다 <b>{w.days}일</b> 늦게 끝납니다 ({trunc(w.t.name, 18)} {monthDay(w.end)}).{' '}
            {w.over6 ? '6개월을 넘어 연장할 수 없습니다 — 일정을 당겨야 합니다' : w.kind === '승인' ? <>3개월 이상 → <b>협약변경 승인 필요</b> (H/W 조달 사유만)</> : <>3개월 미만 → <b>사업관리시스템 등록 필요</b></>}
          </div>
        )}
        <div className="max-h-[190px] overflow-y-auto">
          {L.length ? (
            <table className="w-full table-fixed text-[12px]">
              <colgroup><col className="w-[56px]" /><col className="w-[52px]" /><col /><col className="w-[78px]" /></colgroup>
              <thead><tr className="border-b border-border text-left text-[11px] text-ink3"><th className="py-1">날짜</th><th>판정</th><th>변경 내용</th><th>상태</th></tr></thead>
              <tbody>
                {L.map((x) => {
                  const j = agrJudge(x.kind, x.from, x.to);
                  const ok = x.st === '승인' || x.st === '등록 완료';
                  return (
                    <tr key={x.id} className="cursor-pointer border-b border-border hover:bg-panel-alt" onClick={() => onEdit(x)} title={x.why || '눌러서 고치기'}>
                      <td className="py-1.5">{monthDay(x.date)}</td><td><Tag tone={j === '승인' ? 'bad' : 'plain'}>{j}</Tag></td>
                      <td className="truncate">{AGR_KINDS.find((y) => y[0] === x.kind)?.[1] ?? ''}{x.kind === 'ext' && x.to ? ` → ${monthDay(x.to)}` : ''}{x.text ? ` · ${x.text}` : ''}</td>
                      <td><Tag tone={x.st === '반려' ? 'bad' : ok ? 'ok' : 'warn'}>{x.st}</Tag></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border-hi p-3.5 text-center">
              <div className="text-[12px] text-ink2">아직 기록된 협약변경이 없습니다</div>
              <div className="text-[11px] text-ink3">기간 연장 · 투입인력 · 장비 · 주소 변경 등이 생기면 여기에 남기세요</div>
              <Button size="sm" variant="secondary" onClick={onNew}>+ 첫 변경 기록</Button>
            </div>
          )}
        </div>
        <p className="pt-2 text-[11px] text-ink3">※ {rule}. 기간 연장을 '승인' 또는 '등록 완료'로 저장하면 협약 종료일이 바뀌고 관리기준 기한도 다시 계산됩니다.</p>
      </div>
    </Card>
  );
}

/** 관리기준 필수 TASK (govWbsCard) — 정부사업만 */
export function GovWbsCard({ c, onLink, onDate }: { c: SiteCtx; onLink: (id: string) => void; onDate: (id: string) => void }) {
  const L = govWbsCheck(c);
  const [all, setAll] = useState(false);
  if (!L) return null;
  const ST: Record<GovWbsState, [string, string, 'ok' | 'warn' | 'run' | 'bad']> = { ok: ['bg-ok', '연결됨', 'ok'], nodate: ['bg-amber', '날짜 없음', 'warn'], post: ['bg-blue', '종료 후 일', 'run'], none: ['bg-danger', '없음', 'bad'] };
  const bad = L.filter((x) => x.st === 'none' || x.st === 'nodate').length;
  const rows = all ? L : L.filter((x) => x.st === 'none' || x.st === 'nodate');
  const nOk = L.filter((x) => x.st === 'ok').length;
  const nPost = L.filter((x) => x.st === 'post').length;
  return (
    <Card>
      <CardHead title="관리기준 필수 TASK"><span className="flex-1" />{bad ? <Tag tone="warn">확인 필요 {bad}</Tag> : <Tag tone="ok">모두 연결됨</Tag>}</CardHead>
      <div className="px-4 py-1.5">
        {rows.map((x) => (
          <div key={x.id} className="flex items-center gap-2 border-b border-border py-1.5 text-[12px]">
            <span className={`h-2 w-2 flex-none rounded-full ${ST[x.st][0]}`} />
            <b className="w-[110px] flex-none text-ink" title={x.t}>{x.short}</b>
            <span className={`min-w-0 flex-1 truncate ${x.ts.length ? 'text-ink2' : 'text-ink3'}`} title={x.ts.map((t) => `${t.code} ${t.name}${t.end ? '' : ' (날짜 없음)'}`).join('\n')}>
              {x.ts.length ? x.ts.map((t) => `업무 ${t.code} ${t.name}`).join(' · ') : x.st === 'post' ? '협약 종료 뒤의 일 — 기한 목록에서 관리' : '업무 목록에 이 일을 하는 업무가 없음'}
            </span>
            {x.man && <span className="flex-none text-[11px] text-ink3" title="직접 연결함">직접</span>}
            <Tag tone={ST[x.st][2]}>{ST[x.st][1]}</Tag>
            {x.ts.length > 0 && <Button size="sm" variant={x.st === 'nodate' ? 'primary' : 'secondary'} onClick={() => onDate(x.id)}>{x.st === 'nodate' ? '날짜 넣기' : '일정'}</Button>}
            <Button size="sm" variant="secondary" onClick={() => onLink(x.id)}>바꾸기</Button>
          </div>
        ))}
        <div className="flex items-center gap-2 py-2 text-[11.5px]">
          <span className="text-ink3">{all ? `전체 ${L.length}개` : `${bad ? '나머지 ' : ''}연결됨 ${nOk}개${nPost ? ` · 종료 후 일 ${nPost}개` : ''}${bad ? '' : ' — 빠진 업무 없음'}`}</span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={() => setAll((v) => !v)}>{all ? '문제 있는 것만' : `${L.length}개 모두 보기`}</Button>
        </div>
        {all && <p className="pb-2 text-[11px] text-ink3">※ 업무 이름 · 산출물로 자동 연결합니다. 틀리면 [바꾸기]에서 직접 고르세요. [일정]에서 연결된 업무의 날짜를 바로 고칠 수 있고, 중간점검 기한은 이 일정을 따라갑니다. 연결된 업무가 완료되면 착수계 · 중간점검 · 완료보고 기한도 자동으로 완료됩니다.</p>}
      </div>
    </Card>
  );
}

/** 계획서 약속 기능 진척 (fnCard) — 메뉴별 타일, 누르면 기능 목록 */
export function FnCard({ c, fl, nameOf, onOpenTask }: { c: SiteCtx; fl: FnLink[] | null; nameOf: (id: string) => string; onOpenTask: (id: string) => void }) {
  const [mode, setMode] = useState<'dev' | 'bad' | 'all'>('dev');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [openAll, setOpenAll] = useState(false);
  if (!fl) {
    return (
      <Card><CardHead title="계획서 약속 기능 진척" />
        <p className="px-4 py-3 text-[12px] text-ink3">이 사업은 사업계획서 기능 목록이 들어 있지 않습니다. 계획서 등록(PDF에서 기능 목록 읽기)은 파일 저장소를 연결하는 7단계에서 켭니다. 등록하면 기능을 업무와 자동으로 연결합니다.</p>
      </Card>
    );
  }
  const st = (f: FnLink) => fnSt(c, f);
  const dev = fl.filter((f) => f.kind !== '기존');
  const isBad = (f: FnLink) => ['지연', '연결 없음'].includes(st(f));
  const rows = fl.filter((f) => mode === 'all' || (mode === 'bad' ? isBad(f) : f.kind !== '기존'));
  const groups: Array<{ mod: string; L: FnLink[] }> = [];
  for (const f of rows) { let g = groups.find((x) => x.mod === f.mod); if (!g) groups.push((g = { mod: f.mod, L: [] })); g.L.push(f); }
  const allOpen = mode === 'bad' || openAll;
  const isOpen = (m: string) => allOpen || open.has(m);
  const tog = (m: string) => setOpen((s) => { const n = new Set(s); if (n.has(m)) n.delete(m); else n.add(m); return n; });
  const WORST: FnState[] = ['지연', '연결 없음', '진행 중', '시작 전', '완료', '기존'];
  const info = (g: { L: FnLink[] }) => {
    const sts = g.L.map(st);
    const ts = g.L.map((f) => f.t).filter((t): t is PmTask => !!t);
    return {
      cnt: (v: FnState) => sts.filter((x) => x === v).length, ts,
      ap: ts.length ? Math.round(ts.reduce((a, t) => a + (c.live(t).pct || 0), 0) / ts.length) : 0,
      worst: WORST.find((v) => sts.includes(v)) ?? '기존',
      a: ts.map((t) => t.start).filter(Boolean).sort()[0], z: ts.map((t) => t.end).filter(Boolean).sort().pop(),
    };
  };
  const norm = (x: string) => x.replace(/\s/g, '');
  const tab = (v: typeof mode, l: string) => <Button size="sm" variant={mode === v ? 'primary' : 'secondary'} onClick={() => setMode(v)}>{l}</Button>;
  return (
    <Card>
      <CardHead title="계획서 약속 기능 진척">
        <span className="text-[11px] text-ink3">메뉴를 누르면 기능별로 펼쳐집니다</span>
        <span className="flex-1" />
        {tab('dev', `추가 · 변경 ${dev.length}`)}{tab('bad', `지연 · 연결 없음 ${dev.filter(isBad).length}`)}{tab('all', `기존 포함 ${fl.length}`)}
        {mode !== 'bad' && <Button size="sm" variant="secondary" onClick={() => { setOpenAll((v) => !v); setOpen(new Set()); }}>{openAll ? '모두 접기' : '모두 펼치기'}</Button>}
      </CardHead>
      <div className="px-4 py-3">
        {groups.length ? (
          <>
            {mode !== 'bad' && (
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((g) => {
                  const x = info(g);
                  const w = x.worst;
                  const edge = w === '지연' ? 'border-l-danger' : w === '완료' ? 'border-l-ok' : w === '연결 없음' ? 'border-l-amber' : 'border-l-border-hi';
                  return (
                    <button key={g.mod} type="button" onClick={() => tog(g.mod)} title={`눌러서 기능 ${g.L.length}개 ${isOpen(g.mod) ? '접기' : '펼쳐 보기'}`}
                      className={`rounded-lg border border-l-4 bg-panel px-3 py-2.5 text-left ${edge} ${isOpen(g.mod) ? 'border-teal' : 'border-border hover:border-teal'}`}>
                      <span className="flex items-center gap-2"><b className="flex-1 text-[12.5px] text-ink">{g.mod}</b><Tag tone={FN_TONE[w]}>{w === '완료' ? '모두 완료' : w}</Tag></span>
                      <span className="mt-1.5 flex items-center gap-2"><b className="w-[40px] text-[14px] text-ink">{x.ts.length ? `${x.ap}%` : '-'}</b><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-alt"><i className="block h-full bg-blue" style={{ width: `${x.ap}%` }} /></span></span>
                      <span className="mt-1 flex text-[11px] text-ink3">기능 {g.L.length} · 완료 {x.cnt('완료')}{x.cnt('지연') > 0 && <em className="not-italic text-danger"> · 지연 {x.cnt('지연')}</em>}{x.cnt('연결 없음') > 0 && ` · 연결 없음 ${x.cnt('연결 없음')}`}<span className="flex-1" />{x.a ? `${monthDay(x.a)}~${monthDay(x.z ?? '')}` : ''}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {groups.filter((g) => isOpen(g.mod)).map((g) => (
              <div key={g.mod} className="mt-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 border-b border-border bg-panel-alt px-3 py-1.5 text-[12px]"><b>{g.mod}</b><span className="text-[11px] text-ink3">기능 {g.L.length}개 · 줄을 누르면 연결된 업무가 열립니다</span><span className="flex-1" />{!allOpen && <Button size="sm" variant="secondary" onClick={() => tog(g.mod)}>접기 ▴</Button>}</div>
                {g.L.map((f, i) => {
                  const s = st(f);
                  const t = f.t;
                  const ap = t ? Math.round(c.live(t).pct || 0) : 0;
                  const body = (
                    <>
                      <span className="flex w-[220px] flex-none items-center gap-1.5"><b className="truncate">{f.name}</b><Tag tone={f.kind === '추가' ? 'run' : f.kind === '변경' ? 'warn' : 'plain'}>{f.kind}</Tag></span>
                      <span className="min-w-0 flex-1 truncate text-ink2">{t ? <>{t.code}{norm(t.name).includes(norm(f.name)) ? '' : ` ${trunc(t.name, 26)}`}</> : <span className="text-ink3">업무 연결 없음</span>}</span>
                      <span className="w-[80px] flex-none text-ink2">{t?.assigneeIds[0] ? nameOf(t.assigneeIds[0]) : ''}</span>
                      <span className="w-[86px] flex-none text-ink3">{t?.start ? `${monthDay(t.start)}~${monthDay(t.end)}` : ''}</span>
                      <span className="flex w-[90px] flex-none items-center gap-1">{t && <><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-alt"><i className="block h-full bg-blue" style={{ width: `${ap}%` }} /></span><b>{ap}%</b></>}</span>
                      <Tag tone={FN_TONE[s]}>{s}</Tag>
                    </>
                  );
                  const cls = 'flex w-full items-center gap-2 border-b border-border px-3 py-1.5 text-left text-[12px] last:border-b-0';
                  return t
                    ? <button key={i} type="button" className={`${cls} hover:bg-panel-alt`} title={`${t.code} ${t.name}`} onClick={() => onOpenTask(t.id)}>{body}</button>
                    : <div key={i} className={cls}>{body}</div>;
                })}
              </div>
            ))}
          </>
        ) : <EmptyHint title="해당하는 기능이 없습니다" />}
        <p className="pt-3 text-[11px] text-ink3">※ 사업계획서 'Application 시스템 기능 설명' 표의 기능을 이름이 비슷한 단위 기능 업무(번호가 5.16.1처럼 세 단계 이상)와 자동으로 연결했습니다. 진행률 · 상태는 그 업무 기준입니다. 기존 기능은 패키지 그대로라 개발 대상이 아닙니다.</p>
      </div>
    </Card>
  );
}

