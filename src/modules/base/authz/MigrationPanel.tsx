import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Pill';
import { useAuth } from '@/app/auth/AuthProvider';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import { usePermission } from '@/features/auth/usePermission';
import type { RoleGroup } from '@/domain/roleGroup/schema';
import { planMigration, type MigrationRow } from '@/domain/authz/migrate';
import type { LegacyOrg, LegacyUser } from '@/domain/authz/legacyEval';
import { PERMISSION_BY_KEY } from '@/domain/authz/permissions';
import { authzRepo } from '@/data/authz/authz.repo';
import { systemLogRepo } from '@/data/systemLog/systemLog.repo';
import { AUTHZ_ASSIGNMENTS_KEY, AUTHZ_ROLES_KEY, type OrgForAuthz } from '@/features/authz/useAuthzDraft';

const names = (keys: string[]) => keys.map((k) => PERMISSION_BY_KEY.get(k)?.name ?? k).join(', ');

export function toLegacyOrg(org: OrgForAuthz): LegacyOrg {
  return {
    depts: org.depts.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, headUserId: d.headUserId })),
    positions: org.positions.map((p) => ({ id: p.id, name: p.name, rank: p.rank, isExecutiveRole: p.isExecutiveRole, isLeaderRole: p.isLeaderRole, isDeptHead: p.isDeptHead })),
  };
}
export const toLegacyUsers = (org: OrgForAuthz): LegacyUser[] => org.users as unknown as LegacyUser[];

/**
 * 새 권한 체계로 옮기기 — 역할이 하나도 없을 때 권한 화면에 뜬다.
 * 옛 역할 그룹(roleGroups·roleMappings)은 읽기만 하고, 새 컬렉션에만 쓴다.
 */
export function MigrationPanel({ org }: { org: OrgForAuthz }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isSuperAdmin } = usePermission();
  const groupsQ = useRoleGroups() as { data?: RoleGroup[]; isLoading: boolean };
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(true);

  const plan = useMemo(
    () => (groupsQ.data && !org.isLoading ? planMigration(groupsQ.data, toLegacyOrg(org), toLegacyUsers(org)) : null),
    [groupsQ.data, org],
  );
  if (!plan) return <div className="grid h-60 place-items-center text-[12.5px] text-ink3">불러오는 중…</div>;

  const diffRows = plan.rows.filter((r) => r.missing.length || r.extra.length || r.scopeChanged.length);
  const superRows = plan.rows.filter((r) => r.superOnly.length);
  const shown = (onlyDiff ? plan.rows.filter((r) => r.missing.length || r.extra.length || r.scopeChanged.length || r.superOnly.length) : plan.rows).sort(
    (a, b) => b.missing.length + b.extra.length + b.scopeChanged.length - (a.missing.length + a.extra.length + a.scopeChanged.length),
  );
  const canApply = isSuperAdmin && !busy && (diffRows.length === 0 || accept);

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const at = new Date().toISOString();
      for (const r of plan.roles) await authzRepo.saveRole({ ...r, updatedAt: at, updatedBy: user?.id ?? '' });
      for (const a of plan.assignments) await authzRepo.insertAssignment({ ...a, id: authzRepo.newAssignmentId(), regBy: user?.id ?? '', regAt: at });
      if (user) await systemLogRepo.recordChange({ user: { id: user.id, empNo: user.empNo, name: user.name }, screen: '역할·권한 관리', detail: `새 권한 체계로 옮김 — 역할 ${plan.roles.length}개, 지정 ${plan.assignments.length}건` });
      await Promise.all([qc.invalidateQueries({ queryKey: [AUTHZ_ROLES_KEY] }), qc.invalidateQueries({ queryKey: [AUTHZ_ASSIGNMENTS_KEY] })]);
    } catch (e) {
      setError(`옮기지 못했습니다. (${(e as Error)?.message ?? e})`);
    } finally {
      setBusy(false);
    }
  };

  const stat = (label: string, value: number, tone?: string) => (
    <div className="rounded-[10px] border border-border bg-panel px-4 py-3">
      <div className="text-[11.5px] text-ink3">{label}</div>
      <div className={`mt-1 text-[22px] font-extrabold tabular-nums ${tone ?? 'text-ink'}`}>{value}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3.5">
      <Card title="새 권한 체계로 옮기기" bodyClassName="p-5">
        <p className="m-0 text-[12.5px] leading-relaxed text-ink2">
          지금 쓰는 역할 그룹과 임원·부서장·운영자 판정을 새 역할로 바꿉니다. 아래 표에서 사람마다 옮기기 전과 후의 권한을 비교해 보고 옮기세요. 지금 역할 그룹 데이터는 그대로 남습니다.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {stat('만들 역할', plan.roles.length)}
          {stat('만들 지정', plan.assignments.length)}
          {stat('권한이 달라지는 사람', diffRows.length, diffRows.length ? 'text-danger' : 'text-ok')}
          {stat('최고 관리자 업무 권한 정리', superRows.length, 'text-ink2')}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {plan.roles.map((r) => (
            <span key={r.id} className="rounded-full border border-border px-3 py-1 text-[11.5px] text-ink2">
              <b className="text-ink">{r.name}</b> 권한 {r.kind === 'super' ? '관리자 전체' : `${r.permissions.length}개`} · 지정 {plan.assignments.filter((a) => a.roleId === r.id).length}건
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
          {error && <span className="mr-auto text-[12px] text-danger">{error}</span>}
          {!isSuperAdmin && <span className="mr-auto text-[12px] text-ink3">최고 관리자만 옮길 수 있습니다.</span>}
          {diffRows.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink2">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="accent-[var(--color-teal)]" />
              권한이 달라지는 {diffRows.length}명을 확인했습니다
            </label>
          )}
          <Button variant="primary" disabled={!canApply} onClick={apply}>
            {busy ? '옮기는 중…' : '새 권한 체계로 옮기기'}
          </Button>
        </div>
      </Card>

      <Card
        title="사람별 비교"
        bodyClassName="p-0"
        action={
          <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-ink2">
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="accent-[var(--color-teal)]" />
            달라지는 사람만
          </label>
        }
      >
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] text-ink2">
              <th className="w-[220px] border-b border-border bg-panel-alt px-5 py-2.5 font-bold">직원</th>
              <th className="border-b border-border bg-panel-alt px-3 py-2.5 font-bold">달라지는 점</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Row key={r.user.id} r={r} />
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-ink3">
                  모든 직원의 권한이 옮기기 전과 같습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Row({ r }: { r: MigrationRow }) {
  const same = !r.missing.length && !r.extra.length && !r.scopeChanged.length && !r.superOnly.length;
  return (
    <tr className="border-b border-border/60 align-top last:border-b-0">
      <td className="px-5 py-2.5">
        <div className="font-bold text-ink">{r.user.name}</div>
        <div className="text-[11px] text-ink3">
          {r.user.dept} · {r.user.position}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {same ? (
          <span className="inline-flex items-center gap-1 text-ok">
            <Check size={12} strokeWidth={3} />
            같음
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            {r.missing.length > 0 && (
              <div>
                <Pill tone="err">없어짐</Pill> <span className="text-ink2">{names(r.missing)}</span>
              </div>
            )}
            {r.extra.length > 0 && (
              <div>
                <Pill tone="warn">새로 생김</Pill> <span className="text-ink2">{names(r.extra)}</span>
              </div>
            )}
            {r.scopeChanged.length > 0 && (
              <div>
                <Pill tone="warn">범위 바뀜</Pill> <span className="text-ink2">{names(r.scopeChanged)}</span>
              </div>
            )}
            {r.superOnly.length > 0 && (
              <div>
                <Pill tone="mute">최고 관리자라서 열리던 업무 권한</Pill> <span className="text-ink3">{names(r.superOnly)}</span>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
