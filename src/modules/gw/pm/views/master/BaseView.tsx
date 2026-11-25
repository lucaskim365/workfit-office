import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import type { PmOrg, PmProject } from '@/domain/pm/schema';
import { CodeTab, GenTab, LinkTab, OrgTab, UserTab } from './BaseTabs';
import { TaskFormModal } from '../wbs/TaskFormModal';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmAccess } from '@/features/pm/usePmAccess';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint, ProjectTag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';

/**
 * 기준정보 › 사업 · 인력 · 코드 (데모 pBase 3708) — 탭: 사업 · 사업 › 단계 › 업무 · 업무 목록 생성 · 기업 · 기관 · 인력 · 코드.
 * 처음엔 사업 · 업무 목록에서 자동으로 만들고(ensureMaster), 이름을 바꾸면 쓰는 곳도 같이, 쓰는 곳이 있으면 못 지움.
 * 주소 `?site=new` = 사업 등록 창, `?site=P2` = 그 사업 수정 창 (검색 '사업 등록' · 다른 화면 버튼).
 * 고치기는 프로젝트 관리(PMS) 관리 권한(pm.manage)이 있어야 함 (설계 3.4). 인력 = 그룹웨어 사용자(읽기만).
 */
export type BaseTab = 'site' | 'link' | 'gen' | 'org' | 'user' | 'code';
const th = 'px-3 py-2 text-left text-[11.5px] font-bold text-ink3 whitespace-nowrap';
const td = 'px-3 py-2 align-middle';
export const hasV = (x: unknown) => !(x === '' || x == null || (Array.isArray(x) && !x.length));

/** 빈 정보 현황 (missBar) — 칸마다 '채운 수 / 전체', 누르면 그 칸이 빈 곳만 */
export function MissBar<T>({ all, fields, what, on, onPick }: { all: readonly T[]; fields: ReadonlyArray<readonly [string, string, (x: T) => boolean]>; what: string; on: string; onPick: (id: string) => void }) {
  if (!all.length) return null;
  const cur = fields.find((f) => f[0] === on);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px]">
      <span className="mr-1 font-bold text-ink2">빈 정보</span>
      {fields.map(([id, l, ok]) => {
        const n = all.filter(ok).length;
        const full = n === all.length;
        return (
          <button key={id} type="button" disabled={full} onClick={() => onPick(on === id ? '' : id)} title={full ? '모두 채워짐' : `${l} 빈 ${what} ${all.length - n}곳 · 누르면 빈 곳만 보기`}
            className={`rounded-full border px-2.5 py-0.5 ${full ? 'border-ok/30 bg-ok/10 text-ok' : on === id ? 'border-navy bg-blue-soft text-ink' : 'border-border-hi bg-panel text-ink2 hover:border-teal'}`}>
            {full ? '✓ ' : ''}{l} <b>{n}/{all.length}</b>
          </button>
        );
      })}
      {cur ? <span className="text-ink2">{cur[1]} 빈 곳만 보는 중 <Button size="sm" variant="secondary" onClick={() => onPick('')}>전체 보기</Button></span> : <span className="text-[11px] text-ink3">누르면 빈 곳만 · 줄을 눌러 채우기</span>}
    </div>
  );
}

export function BaseView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const access = usePmAccess();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<BaseTab>('site');
  const [q, setQ] = useState('');
  const [miss, setMiss] = useState('');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [orgEdit, setOrgEdit] = useState<PmOrg | 'new' | null>(null);
  const [newTask, setNewTask] = useState<{ projectId: string; stage: string } | null>(null);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });

  // ?site=new · ?site=P2 → 사업 창 (읽고 나면 주소에서 지움)
  const siteP = params.get('site') ?? '';
  const ready = !!d && !access.loading;
  useEffect(() => {
    if (!ready || !siteP) return;
    if (access.manage) modals.openSite(siteP === 'new' ? null : siteP);
    const n = new URLSearchParams(params); n.delete('site'); setParams(n, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteP, ready]);

  if (!d) return <EmptyHint title="기준정보를 불러오는 중입니다" />;
  const { snap } = d;
  const codesN = snap.codes.length;
  const tabs: ReadonlyArray<readonly [BaseTab, string, number | '']> = [
    ['site', '사업', snap.projects.length], ['link', '사업 › 단계 › 업무', ''], ['gen', '업무 목록 생성', ''],
    ['org', '기업 · 기관', snap.orgs.length], ['user', '인력', people.people.length], ['code', '코드', codesN],
  ];
  const noManage = '사업 · 기준정보를 고치려면 프로젝트 관리(PMS) 관리 권한이 필요합니다';
  const add: Partial<Record<BaseTab, ReactNode>> = {
    site: <Button onClick={() => modals.openSite(null)} disabled={!access.manage} title={access.manage ? undefined : noManage}>+ 사업 등록</Button>,
    org: <Button onClick={() => setOrgEdit('new')} disabled={!access.manage} title={access.manage ? undefined : noManage}>+ 기업 · 기관 등록</Button>,
  };
  const bq = (...xs: string[]) => { const s = q.trim().toLowerCase(); return !s || xs.join(' ').toLowerCase().includes(s); };
  const say = (t: string, bad?: boolean) => setMsg({ t, bad });
  const tp = { d, mut, people, manage: access.manage, shortOf, say, openTask: modals.openTask };

  return (
    <div className="space-y-4">
      <ScreenHead title="사업 · 인력 · 코드" desc="통합 업무 목록에서 뽑은 사업 · 기업 · 기관 · 인력 · 코드를 관리합니다. 이름을 바꾸면 쓰는 곳도 함께 바뀌고, 쓰는 곳이 있으면 지울 수 없습니다.">
        {add[tab]}
      </ScreenHead>
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map(([k, l, n]) => (
          <Button key={k} size="sm" variant={tab === k ? 'primary' : 'secondary'} onClick={() => { setTab(k); setQ(''); setMiss(''); setMsg(null); }}>{l} {n !== '' && <span className="ml-0.5 opacity-75">{n}</span>}</Button>
        ))}
        <span className="flex-1" />
        {!['code', 'link', 'gen'].includes(tab) && <input className="w-[200px] rounded border border-border bg-panel px-2 py-1 text-[12px]" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색" />}
      </div>
      {!access.manage && !access.loading && <p className="text-[11.5px] text-ink3">※ {noManage} — 지금은 보기만 됩니다.</p>}

      {tab === 'site' && <SiteTab projects={snap.projects} taskN={(id) => snap.tasks.filter((t) => t.projectId === id).length} money={access.money} manage={access.manage} bq={bq} miss={miss} setMiss={setMiss} shortOf={shortOf} onEdit={(id) => modals.openSite(id)} />}
      {msg && <div className={`rounded-lg border px-3 py-2 text-[12px] font-bold ${msg.bad ? 'border-danger/30 bg-danger/10 text-danger' : 'border-ok/30 bg-ok/10 text-ok'}`}>{msg.t}</div>}
      {tab === 'link' && <LinkTab {...tp} onNewTask={(projectId, stage) => setNewTask({ projectId, stage })} />}
      {tab === 'gen' && <GenTab {...tp} onGoLink={() => setTab('link')} />}
      {tab === 'org' && <OrgTab {...tp} q={bq} editing={orgEdit} setEditing={setOrgEdit} />}
      {tab === 'user' && <UserTab {...tp} q={bq} />}
      {tab === 'code' && <CodeTab {...tp} />}
      {newTask && <TaskFormModal mode={{ kind: 'new', projectId: newTask.projectId, stage: newTask.stage }} d={d} people={people} mut={mut} shortOf={shortOf} onClose={() => setNewTask(null)} onSaved={(id) => { setNewTask(null); if (id) setMsg({ t: `업무 ${id.split('|')[1]} 추가` }); }} />}
      <p className="text-[11px] text-ink3">출처: {snap.sourceVersion} · 사업을 등록하거나 업무 목록에 새 이름이 생기면 여기에 자동으로 추가됩니다.</p>
      {modals.node}
    </div>
  );
}

const SITE_MISS = [['bizRegNo', '사업자번호'], ['industry', '업종'], ['region', '소재지'], ['ceo', '대표자'], ['contactName', '현장 담당자'], ['budget', '총 사업비'], ['subsidy', '정부 지원금'], ['lines', '생산 라인'], ['equip', '설비 현황']] as const;
const ymd = (s: string) => (s ? s.slice(2).replace(/-/g, '.') : '-');

function SiteTab({ projects, taskN, money, manage, bq, miss, setMiss, shortOf, onEdit }: {
  projects: readonly PmProject[]; taskN: (id: string) => number; money: boolean; manage: boolean; bq: (...xs: string[]) => boolean;
  miss: string; setMiss: (v: string) => void; shortOf: (id: string) => string; onEdit: (id: string) => void;
}) {
  // 사업비 칸은 금액 — pm.manage 만
  const fields = SITE_MISS.filter(([k]) => money || (k !== 'budget' && k !== 'subsidy')).map(([k, l]) => [k, l, (p: PmProject) => hasV(p[k])] as const);
  const sorted = [...projects].sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, '')));
  const cur = fields.find((f) => f[0] === miss);
  const list = sorted.filter((p) => bq(p.id, p.company, p.biz, p.supplier, p.org, p.pmName, p.bizNo)).filter((p) => !cur || !cur[2](p));
  const dash = <span className="text-ink3">-</span>;
  return (
    <>
      <MissBar all={sorted} fields={fields} what="사업" on={miss} onPick={setMiss} />
      <section className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr>
            <th className={th}>사업키</th><th className={th}>트랙</th><th className={th}>사업구분</th><th className={th}>도입기업</th><th className={th}>공급기업</th><th className={th}>과제번호</th><th className={th}>운영기관</th><th className={th}>PM</th><th className={th}>협약 기간</th><th className={`${th} text-right`}>업무</th><th className={th} />
          </tr></thead>
          <tbody>
            {list.length ? list.map((p) => (
              <tr key={p.id} onClick={manage ? () => onEdit(p.id) : undefined} className={`border-b border-border last:border-b-0 ${manage ? 'cursor-pointer hover:bg-panel-alt' : ''}`}>
                <td className={td}><ProjectTag>{shortOf(p.id)}</ProjectTag> <span className="text-[11px] text-ink3">{p.id}</span></td>
                <td className={td}>{p.track || dash}</td>
                <td className={`${td} whitespace-nowrap`}>{p.biz || dash}</td>
                <td className={td}><b>{p.company}</b></td>
                <td className={`${td} whitespace-nowrap`}>{p.supplier || dash}</td>
                <td className={`${td} tabular-nums`}>{p.bizNo || dash}</td>
                <td className={td}>{p.org || dash}</td>
                <td className={`${td} whitespace-nowrap`}>{p.pmName || dash}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`} title={`${p.start || '-'} ~ ${p.end || '-'}`}>{ymd(p.start)} ~ {ymd(p.end)}</td>
                <td className={`${td} text-right tabular-nums`}>{taskN(p.id)}</td>
                <td className={td}>{manage && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onEdit(p.id); }}>수정</Button>}</td>
              </tr>
            )) : <tr><td colSpan={11}><EmptyHint title="조건에 맞는 사업이 없습니다" /></td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
