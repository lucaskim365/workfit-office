import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/shared/ui/Modal';
import { adminPath } from '@/app/shell/screens';
import { Button } from '@/shared/ui/Button';
import { AuthzBlockedError } from '@/features/authz/useAuthzDraft';
import { Building2, Crown, Layers, User as UserIcon, Users } from 'lucide-react';
import type { AuthAssignment, AuthRole } from '@/domain/authz/types';
import { matchAssignment, type AuthzOrg, type AuthzUser } from '@/domain/authz/engine';
import { PERMISSION_BY_KEY } from '@/domain/authz/permissions';

export function PageHead({ title, path, desc, actions }: { title: string; path: string; desc: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-0.5 text-xs text-ink3">
          {path}{desc ? ` · ${desc}` : ''}
        </p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export const roleHasScoped = (role: AuthRole) => role.kind !== 'super' && role.permissions.some((k) => PERMISSION_BY_KEY.get(k)?.scoped);

/** 이 지정에 해당하는 사용 중인 직원 */
export function matchedUsers(a: AuthAssignment, users: AuthzUser[], org: AuthzOrg) {
  return users.filter((u) => matchAssignment(a, u, org) !== null);
}

/** 역할을 받는 사람 수(중복 제외) */
export function roleUserCount(role: AuthRole, assignments: AuthAssignment[], users: AuthzUser[], org: AuthzOrg): number {
  if (role.kind === 'base') return users.length;
  const ids = new Set<string>();
  for (const a of assignments) if (a.roleId === role.id) for (const u of matchedUsers(a, users, org)) ids.add(u.id);
  return ids.size;
}

export { targetText, scopeText } from '@/domain/authz/labels';

export const TARGET_ICON = { USER: UserIcon, DEPT: Building2, POSITION: Layers, DEPT_HEAD: Crown } as const;

/** 역할 목록 — 역할 관리·역할 지정 화면 공용 */
export function RoleList({
  roles,
  selectedId,
  onSelect,
  countOf,
  footer,
}: {
  roles: AuthRole[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  countOf: (r: AuthRole) => number;
  footer?: ReactNode;
}) {
  const fixed = roles.filter((r) => r.kind !== 'custom').sort((a, b) => a.sort - b.sort);
  const custom = roles.filter((r) => r.kind === 'custom').sort((a, b) => a.sort - b.sort);
  const row = (r: AuthRole) => {
    const on = r.id === selectedId;
    return (
      <li key={r.id}>
        <button
          type="button"
          onClick={() => onSelect(r.id)}
          className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
          style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={`truncate text-[12.5px] font-bold ${on ? 'text-teal' : 'text-ink'} ${r.use ? '' : 'opacity-50'}`}>{r.name}</span>
              {!r.use && <span className="text-[10px] text-ink3">사용 안 함</span>}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-ink3">{r.desc || '설명 없음'}</span>
          </span>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-ink3">
            <Users size={12} />
            {countOf(r)}
          </span>
        </button>
      </li>
    );
  };
  return (
    <div className="flex flex-col rounded-[10px] border border-border bg-panel shadow-[0_1px_2px_rgba(23,34,65,0.04)]">
      <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">역할</div>
      <div className="px-4 pb-1 pt-3 text-[10.5px] font-bold text-ink3">기본 역할</div>
      <ul className="m-0 list-none p-0">{fixed.map(row)}</ul>
      <div className="mt-1 border-t border-border px-4 pb-1 pt-3 text-[10.5px] font-bold text-ink3">만든 역할 {custom.length}</div>
      <ul className="m-0 list-none p-0 pb-1">{custom.map(row)}</ul>
      {footer}
    </div>
  );
}

export function Loading() {
  return <div className="grid h-60 place-items-center text-[12.5px] text-ink3">불러오는 중…</div>;
}

/**
 * 저장 결과 알림 — 막힌 이유를 보여주고, 본인 권한이 빠지는 경우엔 '계속'을 받는다.
 * run(작업, 다시하기) : 작업이 selfLoss 로 막히면 확인 후 다시하기(confirmSelf)를 부른다.
 */
export function useAuthzNotice() {
  const [state, setState] = useState<{ message: string; retry?: () => void } | null>(null);
  const run = async (fn: () => Promise<unknown>, retry?: () => Promise<unknown>) => {
    try {
      await fn();
      return true;
    } catch (e) {
      if (e instanceof AuthzBlockedError) {
        setState({ message: e.message, retry: e.kind === 'selfLoss' && retry ? () => void run(retry) : undefined });
      } else {
        setState({ message: `저장하지 못했습니다. 잠시 뒤 다시 해 주세요. (${(e as Error)?.message ?? e})` });
      }
      return false;
    }
  };
  const node = (
    <Modal
      open={Boolean(state)}
      onClose={() => setState(null)}
      title={state?.retry ? '확인' : '저장할 수 없음'}
      footer={
        state?.retry ? (
          <>
            <Button onClick={() => setState(null)}>취소</Button>
            <Button
              variant="dangerSolid"
              onClick={() => {
                const r = state.retry!;
                setState(null);
                r();
              }}
            >
              계속
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => setState(null)}>
            확인
          </Button>
        )
      }
    >
      <p className="m-0 text-[13px] leading-relaxed text-ink2">{state?.message}</p>
    </Modal>
  );
  return { run, node };
}

/** 아직 새 권한 체계로 옮기지 않았을 때 */
export function NotMigrated() {
  const navigate = useNavigate();
  return (
    <div className="grid place-items-center rounded-[10px] border border-border bg-panel px-5 py-16 text-center">
      <p className="m-0 mb-3 text-[13px] text-ink2">아직 새 권한 체계로 옮기지 않았습니다.</p>
      <Button variant="accent" onClick={() => navigate(adminPath('/base/authz/roles'))}>
        역할 관리에서 옮기기
      </Button>
    </div>
  );
}
