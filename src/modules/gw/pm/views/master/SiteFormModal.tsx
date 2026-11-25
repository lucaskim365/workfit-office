import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { addDays, diffDays, isDone, todayStr } from '@/domain/pm/rules';
import { addMonths } from '@/domain/pm/site';
import { INDUSTRIES, alignPre, nextProjectKey, prePast, projectCheck } from '@/domain/pm/master';
import { pmProjectSchema, type PmProject } from '@/domain/pm/schema';
import type { PmDerived, usePmMutations, usePmSiteMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';

/**
 * 사업 등록 · 정보 수정 (데모 siteForm 2919) — 데모 칸 그대로 (새 칸 없음).
 * ① 정부사업 정보 ② 도입기업 정보 ③ 사업비 · 공장 현황(사업비는 금액 — pm.manage 만) ④ 업무 목록 만들기(새로 등록할 때).
 * 데모와 다른 점: '생산 라인을 설비 점유 스케줄러에 등록'(자원 예약 — 데모에서 안 쓰는 화면)은 없음. 금액은 만원으로 넣고 원으로 저장.
 */
const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
type V = Omit<PmProject, 'budget' | 'subsidy' | 'warrantyM'> & { budget: string; subsidy: string; warrantyM: string; tpl: string; keepPeople: boolean };

function F({ label, req, full, bad, help, children }: { label: string; req?: boolean; full?: boolean; bad?: boolean; help?: string; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      <span>{label}{req && <span className="text-danger"> *</span>}</span>
      <div className={bad ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
      {help && <small className="font-normal text-ink3">{help}</small>}
    </label>
  );
}
const Sec = ({ children, help }: { children: ReactNode; help?: string }) => (
  <div className="mt-2 border-b border-border pb-1 text-[12px] font-bold text-navy sm:col-span-2">{children}{help && <small className="ml-2 font-normal text-ink3">{help}</small>}</div>
);
/** 생산 라인 · 설비 목록 (type:'list') — 한 줄에 하나 */
function ListInput({ value, onChange, ph }: { value: string[]; onChange: (v: string[]) => void; ph: string }) {
  return <textarea className={`${inp} min-h-[56px]`} value={value.join('\n')} placeholder={`${ph} (한 줄에 하나)`} onChange={(e) => onChange(e.target.value.split('\n').map((x) => x.trimStart()))} />;
}
const man = (won: number | null) => (won == null ? '' : String(Math.round(won / 10000)));
const won = (m: string) => (m.trim() === '' ? null : Math.round(+m * 10000));

export function SiteFormModal({ s, presetTpl, d, people, mut, smut, money, shortOf, onDone, onClose }: {
  s: PmProject | null;
  /** 템플릿 화면에서 '이 템플릿으로 새 사업' (preset.tpl) */
  presetTpl?: string;
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  smut: ReturnType<typeof usePmSiteMutations>;
  money: boolean;
  shortOf: (id: string) => string;
  onDone: (msg: string, id?: string) => void;
  onClose: () => void;
}) {
  const { snap } = d;
  const isNew = !s;
  const today = todayStr();
  const [v, setV] = useState<V>(() => {
    if (s) return { ...s, budget: man(s.budget), subsidy: man(s.subsidy), warrantyM: s.warrantyM == null ? '' : String(s.warrantyM), lines: [...s.lines], equip: [...s.equip], tpl: '', keepPeople: false };
    const base = pmProjectSchema.parse({ id: nextProjectKey(snap.projects, snap.tasks), supplier: '워크핏 주식회사', pmName: people.labelOf(people.me), pmUserId: people.me, start: today, end: addDays(today, 270) });
    return { ...base, budget: '', subsidy: '', warrantyM: '', tpl: presetTpl ?? 'std', keepPeople: false };
  });
  const [endTouched, setEndTouched] = useState(false);
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof V>(k: K, x: V[K]) => setV((o) => ({ ...o, [k]: x }));
  const bad = (f: string) => err?.[1] === f;
  const orgs = (ty: string) => snap.orgs.filter((o) => o.type === ty).map((o) => o.name);
  const bizList = useMemo(() => [...new Set([...snap.codes.filter((c) => c.group === 'biz').map((c) => c.name), v.biz].filter(Boolean))], [snap.codes, v.biz]);
  const tracks = [...new Set(snap.codes.filter((c) => c.group === 'biz').map((c) => c.track).filter(Boolean))];
  const tpl = snap.templates.find((t) => t.id === presetTpl);
  const showBid = !isNew && (!!s.bidRes || today < s.start);

  const save = async () => {
    const budget = money ? won(v.budget) : s?.budget ?? null;
    const subsidy = money ? won(v.subsidy) : s?.subsidy ?? null;
    const e = projectCheck({ ...v, budget, subsidy }, isNew, (id) => snap.projects.some((x) => x.id === id) || snap.tasks.some((t) => t.projectId === id));
    if (e) { setErr(e); return; }
    if (v.warrantyM !== '' && !(+v.warrantyM >= 0 && +v.warrantyM <= 60)) { setErr(['하자보증 기간은 0~60개월로 넣어 주세요', 'warrantyM']); return; }
    const { tpl: tplId, keepPeople, ...rest } = v;
    const pmUserId = people.idByName(rest.pmName) || (rest.pmName === people.labelOf(rest.pmUserId) ? rest.pmUserId : '');
    const next = pmProjectSchema.parse({ ...rest, budget, subsidy, warrantyM: v.warrantyM === '' ? null : +v.warrantyM, pmUserId, lines: rest.lines.map((x) => x.trim()).filter(Boolean), equip: rest.equip.map((x) => x.trim()).filter(Boolean), company: rest.company.trim() });
    const L = (t: { id: string; status: string; actualPct: number }) => isDone(d.liveMap.get(t.id) ?? { status: t.status as '계획', pct: t.actualPct });
    if (!isNew) {
      const oldBid = [s.annDue, s.evalDate, s.start].join();
      const bidRes = next.bidRes;
      await mut.updateProject.mutateAsync({ ...next, bidRes: s.bidRes, bidAt: s.bidAt });
      if (showBid && bidRes !== s.bidRes) await smut.setBidResult.mutateAsync({ projectId: s.id, v: bidRes });
      // 공고 마감 · 선정평가 · 협약일이 바뀌면 안 끝난 협약 이전 업무 날짜를 맞출지 (alignPre)
      if (oldBid !== [next.annDue, next.evalDate, next.start].join() && today < next.start) {
        const items = alignPre(next, snap.tasks, L);
        if (items.length && confirm('공고 마감 · 선정평가 · 협약일이 바뀌었습니다. 아직 안 끝난 협약 이전 업무 일정을 새 날짜에 맞출까요?')) await mut.setTaskDates.mutateAsync({ items, note: '협약 이전 일정을 공고 마감 · 선정평가일에 맞춤' });
      }
      const ext = s.end && next.end > s.end ? ` · 협약 종료일이 ${diffDays(s.end, next.end)}일 늦춰졌습니다 — ${addMonths(s.end, 3) <= next.end ? '협약변경 승인' : '사업관리시스템 등록'} 대상입니다. 사업별 화면 '협약변경 기록'에 남겨 주세요` : '';
      onDone(`${next.company} 정보가 수정되었습니다${ext}`, s.id);
      onClose();
      return;
    }
    const n = await mut.addProject.mutateAsync({ p: next, tpl: tplId, keepPeople });
    if (n) {
      // 새로 만든 업무 (등록 직후 스냅숏엔 아직 없음 → 저장소에서 다시 읽음)
      const { pmStore } = await import('@/data/pm/pm.store');
      const ts = (await pmStore().snapshot()).tasks.filter((t) => t.projectId === next.id);
      if (next.annDue || next.evalDate) { const items = alignPre(next, ts, (t) => t.status === '완료'); if (items.length) await mut.setTaskDates.mutateAsync({ items, note: '협약 이전 일정을 공고 마감 · 선정평가일에 맞춤' }); }
      const past = prePast(next, (await pmStore().snapshot()).tasks, (t) => t.status === '완료', today);
      if (past.length) {
        const nm = [...new Set(past.map((t) => (t.name.match(/^\[([^\]]+)\]/) ?? [])[1]).filter(Boolean))];
        if (confirm(`협약 이전 업무 ${past.length}건은 날짜가 이미 지났습니다.\n(${nm.join(', ')})\n\n이미 한 일이면 [확인]을 눌러 완료로 표시합니다. 아직 안 했으면 [취소] — 지연으로 남습니다.`)) await mut.completeTasks.mutateAsync({ ids: past.map((t) => t.id), note: '협약 이전 지난 업무 (등록 시 확인)' });
      }
    }
    onDone(`${next.company} 등록 완료${n ? ` · 업무 ${n}건 생성` : tplId === 'std' ? ` · '${next.biz}' 표준 업무가 기준정보에 없어 업무 목록을 만들지 못했습니다 — 기준정보에서 표준을 만들거나 업무 목록에서 직접 추가하세요` : ' · 업무 목록에서 업무를 추가하세요'}`, next.id);
    onClose();
  };
  const del = async () => {
    if (!s) return;
    const n = snap.tasks.filter((t) => t.projectId === s.id).length;
    if (!confirm(`'${shortOf(s.id)}' 사업을 삭제할까요?\n업무 ${n}건, 관련 이슈 · CR · 액션 아이템이 함께 삭제됩니다.`)) return;
    try { await mut.removeProject.mutateAsync(s.id); } catch (e) { setErr([(e as Error).message, '']); return; }
    onDone(`${s.company} 삭제됨`);
    onClose();
  };
  const dl = (id: string, xs: string[]) => <datalist id={id}>{xs.map((x) => <option key={x} value={x} />)}</datalist>;

  return (
    <Modal open onClose={onClose} width={860} title={isNew ? '신규 사업 등록' : `사업 정보 수정 — ${shortOf(s.id)}`}
      footer={(
        <div className="flex w-full items-center gap-2">
          {!isNew && <Button variant="secondary" onClick={() => void del()}>삭제</Button>}
          <span className="flex-1 text-right text-[12px] font-bold text-danger" role="alert">{err?.[0]}</span>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={() => void save()}>{isNew ? '등록' : '저장'}</Button>
        </div>
      )}>
      <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">
        {isNew ? <>새 사업을 추가합니다. <b>표준 업무 목록</b>을 고르면 단계 · 업무 · 산출물이 협약 시작일 기준으로 자동 생성됩니다.</> : <><b>정부사업 정보</b>는 통합관제 값이고, <b>도입기업 · 사업비 · 공장 현황</b>은 사업계획서 · 협약서를 보고 입력하세요.</>}
      </p>
      {dl('pm-dl-co', orgs('도입기업'))}{dl('pm-dl-sup', orgs('공급기업'))}{dl('pm-dl-org', orgs('운영기관'))}{dl('pm-dl-track', tracks)}{dl('pm-dl-pm', people.people.map((u) => u.label))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Sec help="통합관제 시트 항목">① 정부사업 정보</Sec>
        <F label="사업키" req bad={bad('id')} help={isNew ? '예: P14 (자동 추천)' : '사업키는 바꿀 수 없습니다'}><input className={inp} value={v.id} readOnly={!isNew} onChange={(e) => set('id', e.target.value.trim())} /></F>
        <F label="도입 · 참여기업" req bad={bad('company')}><input className={inp} list="pm-dl-co" value={v.company} placeholder="예: ㈜OO정밀" onChange={(e) => set('company', e.target.value)} /></F>
        <F label="사업구분" req bad={bad('biz')} help="목록에 없으면 [기준정보 › 코드 › 사업구분 · 트랙]에서 먼저 추가하세요">
          <select className={inp} value={v.biz} onChange={(e) => set('biz', e.target.value)}><option value="">— 고르세요 —</option>{bizList.map((b) => <option key={b}>{b}</option>)}</select>
        </F>
        <F label="트랙"><input className={inp} list="pm-dl-track" value={v.track} placeholder="예: 가, 나, 다" onChange={(e) => set('track', e.target.value)} /></F>
        <F label="공급기업"><input className={inp} list="pm-dl-sup" value={v.supplier} placeholder="예: 워크핏 주식회사" onChange={(e) => set('supplier', e.target.value)} /></F>
        <F label="과제번호"><input className={inp} value={v.bizNo} placeholder="예: SF26170000" onChange={(e) => set('bizNo', e.target.value)} /></F>
        <F label="운영기관"><input className={inp} list="pm-dl-org" value={v.org} placeholder="예: 이노비즈협회, 경남TP" onChange={(e) => set('org', e.target.value)} /></F>
        <F label="PM" help="그룹웨어 사용자를 고르면 알림 · 승인 대기가 그 사람에게 갑니다"><input className={inp} list="pm-dl-pm" value={v.pmName} placeholder="예: 박명규 부장" onChange={(e) => set('pmName', e.target.value)} /></F>
        <F label="협약 시작일" req bad={bad('start')} help="수주 중이면 예상 협약일">
          <input type="date" className={inp} value={v.start} onChange={(e) => { const x = e.target.value; setV((o) => ({ ...o, start: x, end: isNew && !endTouched && x ? addDays(x, 270) : o.end })); }} />
        </F>
        <F label="협약 종료일" req bad={bad('end')} help={isNew ? '시작일을 바꾸면 시작일 + 270일로 따라 바뀝니다 (직접 고치면 그대로)' : undefined}>
          <input type="date" className={inp} value={v.end} onChange={(e) => { setEndTouched(true); set('end', e.target.value); }} />
        </F>
        {showBid && (
          <F label="선정 결과" help="탈락이면 현황 · 알림 · 업무 목록에서 빠집니다">
            <select className={inp} value={v.bidRes} onChange={(e) => set('bidRes', e.target.value as V['bidRes'])}><option value="">결과 전</option><option>선정</option><option>탈락</option></select>
          </F>
        )}
        <F label="공고 마감일" help="수주 단계 — 사업계획서 신청 마감"><input type="date" className={inp} value={v.annDue} onChange={(e) => set('annDue', e.target.value)} /></F>
        <F label="선정평가일" help="발표 · 현장평가 날짜"><input type="date" className={inp} value={v.evalDate} onChange={(e) => set('evalDate', e.target.value)} /></F>
        <F label="하자보증 기간 (개월)" bad={bad('warrantyM')} help="협약 종료일(구축완료)부터 · 보통 12개월"><input type="number" min={0} max={60} className={inp} value={v.warrantyM} onChange={(e) => set('warrantyM', e.target.value)} /></F>
        <F label="상태 요약" full><input className={inp} value={v.summary} placeholder="예: 개발 진행중 / 계획대비 소폭지연" onChange={(e) => set('summary', e.target.value)} /></F>

        <Sec help="사업계획서 기준">② 도입기업 정보</Sec>
        <F label="사업자등록번호" bad={bad('bizRegNo')}><input className={inp} value={v.bizRegNo} placeholder="000-00-00000" onChange={(e) => set('bizRegNo', e.target.value)} /></F>
        <F label="업종"><select className={inp} value={v.industry} onChange={(e) => set('industry', e.target.value)}>{[...new Set([...INDUSTRIES, v.industry])].map((x) => <option key={x} value={x}>{x || '미입력'}</option>)}</select></F>
        <F label="대표자"><input className={inp} value={v.ceo} onChange={(e) => set('ceo', e.target.value)} /></F>
        <F label="소재지"><input className={inp} value={v.region} placeholder="예: 경남 창원시 OO로 12" onChange={(e) => set('region', e.target.value)} /></F>
        <F label="현장 담당자"><input className={inp} value={v.contactName} placeholder="예: 홍길동 과장" onChange={(e) => set('contactName', e.target.value)} /></F>
        <F label="담당자 연락처"><input type="tel" className={inp} value={v.contactPhone} placeholder="010-0000-0000" onChange={(e) => set('contactPhone', e.target.value)} /></F>
        <F label="담당자 이메일" bad={bad('contactEmail')}><input type="email" className={inp} value={v.contactEmail} placeholder="name@company.com" onChange={(e) => set('contactEmail', e.target.value)} /></F>

        <Sec>③ 사업비 · 공장 현황</Sec>
        {money ? (
          <>
            <F label="총 사업비 (만원)"><input type="number" min={0} className={inp} value={v.budget} onChange={(e) => set('budget', e.target.value)} /></F>
            <F label="정부 지원금 (만원)" bad={bad('subsidy')}><input type="number" min={0} className={inp} value={v.subsidy} onChange={(e) => set('subsidy', e.target.value)} /></F>
          </>
        ) : <p className="text-[11.5px] text-ink3 sm:col-span-2">총 사업비 · 정부 지원금은 금액이라 프로젝트 관리(PMS) 관리 권한이 있는 사람만 보고 고칩니다.</p>}
        <F label="생산 라인"><ListInput value={v.lines} onChange={(x) => set('lines', x)} ph="예: 포장 1라인" /></F>
        <F label="설비 · PLC · 시스템"><ListInput value={v.equip} onChange={(x) => set('equip', x)} ph="예: Siemens S7-1500 ×3, 기존 ERP(영림원)" /></F>
        <F label="메모" full><textarea className={`${inp} min-h-[56px]`} value={v.note} onChange={(e) => set('note', e.target.value)} /></F>

        {isNew && (
          <>
            <Sec>④ 업무 목록 만들기</Sec>
            <F label="업무 목록 만들기" full help="기준정보의 표준 업무(사업구분 › 단계 순서)를 협약 시작일 기준으로 만듭니다. 표준은 [기준정보]에서 고칩니다">
              <select className={inp} value={v.tpl} onChange={(e) => set('tpl', e.target.value)}>
                <option value="std">기준정보 표준 업무 목록 자동 생성</option>
                {tpl && <option value={tpl.id}>{tpl.name} 복사 — {shortOf(tpl.baseId)} 사업 업무 {snap.tasks.filter((t) => t.projectId === tpl.baseId).length}개</option>}
                <option value="">만들지 않음 (업무 직접 추가)</option>
              </select>
            </F>
            {v.tpl && v.tpl !== 'std' && <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={v.keepPeople} onChange={(e) => set('keepPeople', e.target.checked)} />템플릿의 담당자도 복사</label>}
          </>
        )}
      </div>
    </Modal>
  );
}
