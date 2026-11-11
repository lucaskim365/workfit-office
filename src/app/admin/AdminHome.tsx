import { Link } from 'react-router-dom';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useApprovalForms } from '@/features/gw/useApprovalForms';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import { SYSTEM_SCREENS } from '@/domain/roleGroup/schema';
import { adminPath } from '../shell/screens';
import { useAdminMenu } from './AdminConsole';

/** 화면 설명 — 권한 목록(SYSTEM_SCREENS)의 설명을 주소로 찾아 쓴다 */
const DESC_BY_URL = new Map(SYSTEM_SCREENS.map((s) => [s.url, s.desc]));

/**
 * 콘솔 홈 — 지금 상태 몇 가지(읽기만)와 영역별 바로가기.
 */
export default function AdminHome() {
  const org = useOrgTree();
  const forms = useApprovalForms();
  const groups = useRoleGroups();
  const menu = useAdminMenu();

  const stats: { label: string; value: number | undefined; to: string }[] = [
    { label: '사용 중인 구성원', value: org.isLoading ? undefined : org.users.filter((u) => u.status !== '미사용').length, to: adminPath('/base/user') },
    { label: '부서', value: org.isLoading ? undefined : org.depts.length, to: adminPath('/base/department') },
    { label: '직급', value: org.isLoading ? undefined : org.positions.length, to: adminPath('/base/position') },
    { label: '결재서식', value: forms.data?.length, to: adminPath('/base/approval-form') },
    { label: '역할 그룹', value: (groups.data as unknown[] | undefined)?.length, to: adminPath('/base/auth') },
  ];

  return (
    <div className="mx-auto max-w-[1080px]">
      <h1 className="mb-1 text-[20px] font-extrabold tracking-tight text-ink">관리자 콘솔</h1>
      <p className="mb-5 text-[13px] text-ink3">구성원·권한·전자결재·회사 정보를 관리합니다.</p>

      <div className="mb-7 grid grid-cols-5 gap-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="rounded-xl border border-border bg-panel px-4 py-3.5 hover:border-ink3">
            <div className="text-[12px] text-ink3">{s.label}</div>
            <div className="mt-1 text-[22px] font-extrabold tabular-nums text-ink">{s.value ?? '–'}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {menu.map((g) => (
          <section key={g.id} className="rounded-xl border border-border bg-panel px-5 py-4">
            <h2 className="mb-2 text-[14px] font-bold text-ink">{g.name}</h2>
            <ul className="m-0 list-none p-0">
              {g.children.map((s) => (
                <li key={s.id} className="border-t border-border first:border-t-0">
                  <Link to={adminPath(s.url!)} className="group flex items-baseline gap-3 py-2">
                    <span className="w-[132px] shrink-0 text-[13px] font-semibold text-ink group-hover:text-[#0876c8]">{s.name}</span>
                    <span className="min-w-0 truncate text-[12px] text-ink3">{DESC_BY_URL.get(s.url!) ?? ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
