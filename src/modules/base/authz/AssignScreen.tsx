import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Pill } from '@/shared/ui/Pill';
import { PERMISSION_BY_KEY } from '@/domain/authz/permissions';
import type { AuthAssignment, AuthRole, AuthScopeType, AuthTargetType } from '@/domain/authz/types';
import { SCOPE_TYPE_LABEL, TARGET_TYPE_LABEL } from '@/domain/authz/types';
import { matchAssignment, type AuthzOrg } from '@/domain/authz/engine';
import { useAuthzActions, useAuthzDraft } from '@/features/authz/useAuthzDraft';
import { NotMigrated, useAuthzNotice, Loading, PageHead, RoleList, TARGET_ICON, matchedUsers, roleHasScoped, roleUserCount, scopeText, targetText } from './parts';

/** 부서를 트리 순서로 펼친 목록(깊이 포함) */
function deptTree(org: AuthzOrg) {
  const out: { id: string; name: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const d of org.depts.filter((x) => (x.parentId ?? null) === parent)) {
      out.push({ id: d.id, name: d.name, depth });
      walk(d.id, depth + 1);
    }
  };
  walk(null, 0);
  // 부모가 없는(끊긴) 부서도 빠지지 않게
  for (const d of org.depts) if (!out.some((x) => x.id === d.id)) out.push({ id: d.id, name: d.name, depth: 0 });
  return out;
}

function Box({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <span className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded-[4px] border ${on ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel'} ${dim ? 'opacity-50' : ''}`}>
      {on && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-[11.5px] font-bold">
      {options.map(([id, label]) => (
        <button key={id} type="button" onClick={() => onChange(id)} className={`rounded-md px-3 py-1 transition-colors ${value === id ? 'bg-teal text-white' : 'text-ink3 hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function AssignScreen() {
  const { ready, roles, assignments, org, authzOrg, activeUsers } = useAuthzDraft();
  const actions = useAuthzActions();
  const notice = useAuthzNotice();
  const [params, setParams] = useSearchParams();
  const assignable = roles.filter((r) => r.kind !== 'base');
  const selectedId = params.get('role') ?? assignable.find((r) => r.kind === 'custom')?.id ?? assignable[0]?.id ?? null;
  const role = roles.find((r) => r.id === selectedId) ?? null;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AuthAssignment | null>(null);

  const countOf = (r: AuthRole) => roleUserCount(r, assignments, activeUsers, authzOrg);

  if (ready && roles.length === 0) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHead title="역할 지정" path="권한 / 역할 지정" desc="" />
        <NotMigrated />
      </div>
    );
  }
  if (!ready || !role) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHead title="역할 지정" path="권한 / 역할 지정" desc="역할을 누구에게, 어느 범위로 줄지 정합니다" />
        <Loading />
      </div>
    );
  }

  const mine = assignments.filter((a) => a.roleId === role.id);
  const scoped = roleHasScoped(role);
  // 해당 직원과 이유
  const people = activeUsers
    .map((u) => ({ u, reasons: mine.map((a) => matchAssignment(a, u, authzOrg)).filter((x): x is string => Boolean(x)) }))
    .filter((x) => x.reasons.length > 0);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHead
        title="역할 지정"
        path="권한 / 역할 지정"
        desc="역할을 누구에게, 어느 범위로 줄지 정합니다"
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <span className="inline-flex items-center gap-1">
              <Plus size={13} />
              대상 추가
            </span>
          </Button>
        }
      />
      <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-3.5">
        <RoleList roles={assignable} selectedId={role.id} onSelect={(id) => setParams({ role: id })} countOf={countOf} />

        <div className="flex min-w-0 flex-col gap-3.5">
          <Card
            title={
              <span>
                {role.name} <span className="ml-1 text-[12px] font-semibold text-ink3">지정 {mine.length}건</span>
              </span>
            }
            bodyClassName="p-0"
          >
            {mine.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12.5px] text-ink3">
                아직 대상이 없습니다. 오른쪽 위 <b className="text-ink2">대상 추가</b>로 사람·부서·직급을 지정하세요.
              </div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="text-left text-[10.5px] text-ink2">
                    <th className="border-b border-border bg-panel-alt px-5 py-2.5 font-bold">대상</th>
                    <th className="border-b border-border bg-panel-alt px-3 py-2.5 font-bold whitespace-nowrap">종류</th>
                    <th className="border-b border-border bg-panel-alt px-3 py-2.5 text-right font-bold whitespace-nowrap">해당 직원</th>
                    <th className="border-b border-border bg-panel-alt px-3 py-2.5 font-bold">범위</th>
                    <th className="w-[84px] border-b border-border bg-panel-alt px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {mine.map((a) => {
                    const Icon = TARGET_ICON[a.targetType];
                    const t = targetText(a, authzOrg, org.users);
                    return (
                      <tr key={a.id} className="group border-b border-border/60 last:border-b-0 hover:bg-panel-alt/50">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel-alt text-ink2">
                              <Icon size={14} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-bold text-ink">{t.main}</span>
                              <span className="block truncate text-[11px] text-ink3">{t.sub}</span>
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-ink2">{TARGET_TYPE_LABEL[a.targetType]}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink2">{matchedUsers(a, activeUsers, authzOrg).length}명</td>
                        <td className="px-3 py-2.5 text-ink2">{scoped ? scopeText(a, authzOrg) : <span className="text-ink3">해당 없음</span>}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                            <button type="button" title="바꾸기" onClick={() => setEditing(a)} className="grid h-7 w-7 place-items-center rounded-md text-ink2 hover:bg-ink3/10">
                              <Pencil size={13} />
                            </button>
                            <button type="button" title="빼기" onClick={() => notice.run(() => actions.removeAssignment(a.id), () => actions.removeAssignment(a.id, { confirmSelf: true }))} className="grid h-7 w-7 place-items-center rounded-md text-danger hover:bg-danger/10">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card
            title={
              <span>
                해당 직원 <span className="ml-1 text-[12px] font-semibold tabular-nums text-ink3">{people.length}명</span>
              </span>
            }
            bodyClassName="p-0"
          >
            {people.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12.5px] text-ink3">지금 이 역할을 받는 직원이 없습니다.</div>
            ) : (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] p-0">
                {people.map(({ u, reasons }) => (
                  <li key={u.id} className="flex items-center gap-2.5 border-b border-border/60 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-ink">
                        {u.name} <span className="font-medium text-ink3">{u.position}</span>
                      </span>
                      <span className="block truncate text-[11px] text-ink3">
                        {u.dept} · {reasons.join(', ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {notice.node}
      <TargetDialog
        open={adding || Boolean(editing)}
        onSave={(drafts) => {
          const ed = editing;
          const close = () => {
            setAdding(false);
            setEditing(null);
          };
          if (ed) {
            const next = { ...drafts[0], id: ed.id, regBy: ed.regBy, regAt: ed.regAt };
            void notice.run(async () => { await actions.updateAssignment(next); close(); }, async () => { await actions.updateAssignment(next, { confirmSelf: true }); close(); });
          } else {
            void notice.run(async () => { await actions.addAssignments(drafts); close(); });
          }
        }}
        pending={actions.pending}
        role={role}
        editing={editing}
        authzOrg={authzOrg}
        activeUsers={activeUsers}
        existing={mine}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

type OrgT = ReturnType<typeof useAuthzDraft>['org'];

function TargetDialog({
  open,
  role,
  editing,
  authzOrg,
  activeUsers,
  existing,
  onClose,
  onSave,
  pending,
}: {
  open: boolean;
  role: AuthRole;
  editing: AuthAssignment | null;
  authzOrg: AuthzOrg;
  activeUsers: OrgT['users'];
  existing: AuthAssignment[];
  onClose: () => void;
  onSave: (drafts: Omit<AuthAssignment, 'id'>[]) => void;
  pending: boolean;
}) {
  const [type, setType] = useState<AuthTargetType>('USER');
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [targetSub, setTargetSub] = useState(true);
  const [positionMode, setPositionMode] = useState<'EQ' | 'GTE'>('EQ');
  const [scopeType, setScopeType] = useState<AuthScopeType>('ALL');
  const [scopeIds, setScopeIds] = useState<Set<string>>(new Set());
  const [scopeSub, setScopeSub] = useState(true);
  const scoped = roleHasScoped(role);
  const tree = useMemo(() => deptTree(authzOrg), [authzOrg]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    if (editing) {
      setType(editing.targetType);
      setIds(new Set(editing.targetId ? [editing.targetId] : []));
      setTargetSub(editing.targetSub);
      setPositionMode(editing.positionMode);
      setScopeType(editing.scopeType);
      setScopeIds(new Set(editing.scopeDeptIds));
      setScopeSub(editing.scopeSub);
    } else {
      setType('USER');
      setIds(new Set());
      setTargetSub(true);
      setPositionMode('EQ');
      setScopeType('ALL');
      setScopeIds(new Set());
      setScopeSub(true);
    }
  }, [open, editing]);

  const toggleIn = (s: Set<string>, id: string, single = false) => {
    const n = new Set(single ? [] : s);
    if (s.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  const already = (id: string) => existing.some((a) => a.id !== editing?.id && a.targetType === type && a.targetId === id);
  const drafts: Omit<AuthAssignment, 'id'>[] = (type === 'DEPT_HEAD' ? [''] : [...ids]).map((targetId) => ({
    roleId: role.id,
    targetType: type,
    targetId,
    targetSub,
    positionMode,
    scopeType: scoped ? scopeType : 'ALL',
    scopeDeptIds: scoped && scopeType === 'DEPTS' ? [...scopeIds] : [],
    scopeSub,
  }));
  const reach = new Set<string>();
  for (const d of drafts) for (const u of matchedUsers({ ...d, id: '' }, activeUsers, authzOrg)) reach.add(u.id);
  const valid = (type === 'DEPT_HEAD' || ids.size > 0) && (!scoped || scopeType !== 'DEPTS' || scopeIds.size > 0);

  const save = () => onSave(drafts);

  const kw = q.trim();
  const users = activeUsers.filter((u) => !kw || u.name.includes(kw) || u.dept.includes(kw) || u.position.includes(kw));
  const positions = [...authzOrg.positions].sort((a, b) => a.rank - b.rank);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `${role.name} — 지정 바꾸기` : `${role.name} — 대상 추가`}
      width={600}
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-[12px] text-ink2">
            해당 직원 <b className="tabular-nums text-ink">{reach.size}</b>명
          </span>
          <div className="flex gap-2">
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" disabled={!valid || pending} onClick={save}>
              {editing ? '바꾸기' : '추가'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 대상 */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold text-navy">누구에게</span>
            {!editing && (
              <Seg
                value={type}
                onChange={(v) => {
                  setType(v);
                  setIds(new Set());
                }}
                options={(['USER', 'DEPT', 'POSITION', 'DEPT_HEAD'] as AuthTargetType[]).map((t) => [t, TARGET_TYPE_LABEL[t]])}
              />
            )}
          </div>

          {type === 'USER' && (
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search size={13} className="text-ink3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·부서·직급 검색" className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink3" disabled={Boolean(editing)} />
              </div>
              <ul className="m-0 max-h-[220px] list-none overflow-y-auto p-1">
                {users.map((u) => {
                  const dis = already(u.id) || (Boolean(editing) && !ids.has(u.id));
                  return (
                    <li key={u.id}>
                      <button type="button" disabled={dis} onClick={() => setIds(toggleIn(ids, u.id))} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-panel-alt disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent">
                        <Box on={ids.has(u.id) || already(u.id)} />
                        <span className="text-[12.5px] font-bold text-ink">{u.name}</span>
                        <span className="truncate text-[11px] text-ink3">
                          {u.dept} · {u.position}
                        </span>
                        {already(u.id) && <span className="ml-auto shrink-0 text-[10.5px] text-ink3">이미 지정됨</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {type === 'DEPT' && (
            <>
              <div className="rounded-lg border border-border">
                <ul className="m-0 max-h-[220px] list-none overflow-y-auto p-1">
                  {tree.map((d) => {
                    const dis = already(d.id) || (Boolean(editing) && !ids.has(d.id));
                    return (
                      <li key={d.id}>
                        <button type="button" disabled={dis} onClick={() => setIds(toggleIn(ids, d.id))} className="flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2.5 text-left hover:bg-panel-alt disabled:cursor-default disabled:opacity-40" style={{ paddingLeft: 10 + d.depth * 16 }}>
                          <Box on={ids.has(d.id) || already(d.id)} />
                          <span className="text-[12.5px] font-semibold text-ink">{d.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink2">
                <input type="checkbox" className="sr-only" checked={targetSub} onChange={(e) => setTargetSub(e.target.checked)} />
                <Box on={targetSub} />
                하위 부서 사람도 포함
              </label>
            </>
          )}

          {type === 'POSITION' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {positions.map((p) => {
                  const on = ids.has(p.id);
                  const dis = already(p.id) || (Boolean(editing) && !on);
                  return (
                    <button key={p.id} type="button" disabled={dis} onClick={() => setIds(toggleIn(ids, p.id, positionMode === 'GTE'))} className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors disabled:opacity-40 ${on ? 'border-teal bg-teal text-white' : 'border-border text-ink2 hover:border-border-hi'}`}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <Seg
                value={positionMode}
                onChange={(v) => {
                  setPositionMode(v);
                  if (v === 'GTE' && ids.size > 1) setIds(new Set([...ids].slice(0, 1)));
                }}
                options={[
                  ['EQ', '고른 직급만'],
                  ['GTE', '고른 직급 이상'],
                ]}
              />
            </>
          )}

          {type === 'DEPT_HEAD' && <div className="rounded-lg bg-panel-alt px-3.5 py-3 text-[12.5px] text-ink2">조직도에서 부서장으로 지정된 모든 사람이 받습니다. 부서장이 바뀌면 자동으로 따라갑니다.</div>}
        </section>

        {/* 범위 */}
        {scoped && (
          <section className="flex flex-col gap-2.5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold text-navy">어느 범위로</span>
              <Seg value={scopeType} onChange={setScopeType} options={(['ALL', 'OWN_DEPT', 'DEPTS'] as AuthScopeType[]).map((s) => [s, SCOPE_TYPE_LABEL[s]])} />
            </div>
            <p className="m-0 text-[11.5px] text-ink3">
              {scopeType === 'ALL' && '전사 직원에 대해 권한을 씁니다.'}
              {scopeType === 'OWN_DEPT' && '받는 사람마다 자기 소속 부서(겸직·부서장 부서 포함) 직원에 대해서만 씁니다.'}
              {scopeType === 'DEPTS' && '고른 조직의 직원에 대해서만 씁니다.'}
            </p>
            {scopeType === 'DEPTS' && (
              <div className="rounded-lg border border-border">
                <ul className="m-0 max-h-[180px] list-none overflow-y-auto p-1">
                  {tree.map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => setScopeIds(toggleIn(scopeIds, d.id))} className="flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2.5 text-left hover:bg-panel-alt" style={{ paddingLeft: 10 + d.depth * 16 }}>
                        <Box on={scopeIds.has(d.id)} />
                        <span className="text-[12.5px] font-semibold text-ink">{d.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scopeType !== 'ALL' && (
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink2">
                <input type="checkbox" className="sr-only" checked={scopeSub} onChange={(e) => setScopeSub(e.target.checked)} />
                <Box on={scopeSub} />
                하위 부서도 범위에 포함
              </label>
            )}
            <div className="flex flex-wrap gap-1">
              {role.permissions.map((k) => (
                <ScopedPill key={k} k={k} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function ScopedPill({ k }: { k: string }) {
  const p = PERMISSION_BY_KEY.get(k);
  if (!p?.scoped) return null;
  return <Pill tone="info">{p.name}</Pill>;
}

