import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Minus, Search } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { AUTHZ_AREAS, PERMISSIONS } from '@/domain/authz/permissions';
import { canUseAdminConsole, resolveGrants, type Grant } from '@/domain/authz/engine';
import { useAuthzDraft } from '@/features/authz/useAuthzDraft';
import { adminPath } from '@/app/shell/screens';
import { Loading, PageHead } from './parts';

type Tab = 'work' | 'admin';

export default function PeopleScreen() {
  const { ready, roles, assignments, authzOrg, activeUsers } = useAuthzDraft();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('work');
  const [onlyMine, setOnlyMine] = useState(true);

  const sorted = useMemo(() => [...activeUsers].sort((a, b) => a.dept.localeCompare(b.dept, 'ko') || a.name.localeCompare(b.name, 'ko')), [activeUsers]);
  const selected = sorted.find((u) => u.id === params.get('user')) ?? sorted[0] ?? null;
  const result = useMemo(() => (selected ? resolveGrants(selected, roles, assignments, authzOrg) : null), [selected, roles, assignments, authzOrg]);

  if (!ready || !selected || !result) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHead title="사람별 권한" path="권한 / 사람별 권한" desc="한 사람이 받은 역할과 실제로 쓸 수 있는 권한을 봅니다" />
        <Loading />
      </div>
    );
  }

  const kw = q.trim();
  const list = sorted.filter((u) => !kw || u.name.includes(kw) || u.dept.includes(kw) || u.position.includes(kw));
  const deptName = (id: string) => authzOrg.depts.find((d) => d.id === id)?.name ?? '';
  const scopeLabel = (g: Grant) => {
    if (g.all) return '전사';
    const names = [...g.deptIds].map(deptName).filter(Boolean);
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}` : names.join(', ');
  };
  const consoleOk = canUseAdminConsole(result);
  const areas = AUTHZ_AREAS.filter((a) => (tab === 'admin') === a.id.startsWith('admin'));
  const countIn = (admin: boolean) => PERMISSIONS.filter((p) => !!p.adminConsole === admin && result.grants.has(p.key)).length;

  return (
    <div className="flex flex-col gap-3.5">
      <PageHead title="사람별 권한" path="권한 / 사람별 권한" desc="한 사람이 받은 역할과 실제로 쓸 수 있는 권한을 봅니다" />
      <div className="grid grid-cols-[280px_minmax(0,1fr)] items-start gap-3.5">
        {/* 사람 목록 */}
        <div className="flex flex-col rounded-[10px] border border-border bg-panel shadow-[0_1px_2px_rgba(23,34,65,0.04)]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search size={13} className="text-ink3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·부서·직급 검색" className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink3" />
          </div>
          <ul className="m-0 max-h-[calc(100vh/var(--font-scale,1)-230px)] list-none overflow-y-auto p-0 py-1">
            {list.map((u) => {
              const on = u.id === selected.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setParams({ user: u.id })}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
                    style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}
                  >
                    <span className={`text-[12.5px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{u.name}</span>
                    <span className="truncate text-[11px] text-ink3">
                      {u.dept} · {u.position}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          {/* 사람 + 받은 역할 */}
          <Card
            title={
              <span className="flex items-center gap-2">
                {selected.name}
                <span className="text-[12px] font-medium text-ink3">
                  {selected.dept} · {selected.position}
                </span>
              </span>
            }
            action={
              <div className="flex items-center gap-1.5">
                {result.isSuperAdmin && <Pill tone="info">최고 관리자</Pill>}
                <Pill tone={consoleOk ? 'ok' : 'mute'}>{consoleOk ? '관리자 콘솔 사용' : '관리자 콘솔 없음'}</Pill>
              </div>
            }
            bodyClassName="p-0"
          >
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-[10.5px] text-ink2">
                  <th className="w-[200px] border-b border-border bg-panel-alt px-5 py-2 font-bold">받은 역할</th>
                  <th className="border-b border-border bg-panel-alt px-3 py-2 font-bold">받은 이유</th>
                </tr>
              </thead>
              <tbody>
                {result.roles.map(({ role, reasons }) => (
                  <tr key={role.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-5 py-2.5">
                      <button type="button" onClick={() => navigate(`${adminPath('/base/authz/roles')}?role=${role.id}`)} className="font-bold text-ink hover:text-teal">
                        {role.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-ink2">{reasons.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 권한 결과 */}
          <Card
            title="쓸 수 있는 권한"
            bodyClassName="p-0"
            action={
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-ink2">
                  <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-[var(--color-teal)]" />
                  받은 권한만
                </label>
                <div className="flex rounded-lg border border-border p-0.5 text-[11.5px] font-bold">
                  {(
                    [
                      ['work', '업무 권한', countIn(false)],
                      ['admin', '관리자 권한', countIn(true)],
                    ] as const
                  ).map(([id, label, n]) => (
                    <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-md px-3 py-1 transition-colors ${tab === id ? 'bg-teal text-white' : 'text-ink3 hover:text-ink'}`}>
                      {label} <span className="tabular-nums opacity-80">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {areas.map((area) => {
              const perms = PERMISSIONS.filter((p) => p.area === area.id && (!onlyMine || result.grants.has(p.key)));
              if (perms.length === 0) return null;
              return (
                <section key={area.id} className="border-t border-border first:border-t-0">
                  <div className="bg-panel-alt/60 px-5 py-2 text-[12px] font-extrabold text-navy">{area.name}</div>
                  <ul className="m-0 list-none p-0">
                    {perms.map((p) => {
                      const g = result.grants.get(p.key);
                      return (
                        <li key={p.key} className="flex items-center gap-3 border-t border-border/60 px-5 py-2.5 first:border-t-0">
                          <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${g ? 'bg-ok/15 text-ok' : 'bg-ink3/10 text-ink3'}`}>{g ? <Check size={11} strokeWidth={3} /> : <Minus size={11} />}</span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[12.5px] font-bold ${g ? 'text-ink' : 'text-ink3'}`}>{p.name}</span>
                            {g && <span className="block truncate text-[11px] text-ink3">{[...new Set(g.via.map((v) => v.roleName))].join(', ')}</span>}
                          </span>
                          {g && p.scoped && <span className="shrink-0 text-[11.5px] font-semibold text-ink2">범위 · {scopeLabel(g)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {areas.every((a) => PERMISSIONS.every((p) => p.area !== a.id || (onlyMine && !result.grants.has(p.key)))) && (
              <div className="px-5 py-10 text-center text-[12.5px] text-ink3">받은 {tab === 'admin' ? '관리자' : '업무'} 권한이 없습니다.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
