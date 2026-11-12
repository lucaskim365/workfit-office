import { useNavigate } from 'react-router-dom';
import { useSecurityContext } from '@/features/auth/useSecurityContext';
import { commutePolicy } from '@/domain/security/policy/commutePolicy';

/**
 * 근태 화면 위 '내 근태 | 전사(부서) 근태' 전환 — 웹 근태 화면처럼 근태 안에서 바로 넘어가게.
 * 전사·부서 근태(근태 관제)는 그룹웨어 메뉴 맨 끝에만 있어 관리자가 근태 화면에서 찾지 못했다.
 * 볼 권한이 없으면 아무것도 그리지 않는다(그룹웨어 메뉴와 같은 판정).
 */
export default function MobileCommuteTabs({ active }: { active: 'me' | 'admin' }) {
  const nav = useNavigate();
  const ctx = useSecurityContext();
  if (!commutePolicy.canAccessCommuteAdmin(ctx)) return null;
  const adminLabel = commutePolicy.getScope(ctx) === 'TEAM' ? '부서 근태' : '전사 근태';
  const tab = (key: 'me' | 'admin', label: string, path: string) => (
    <button
      type="button"
      onClick={() => key !== active && nav(path, { replace: true })}
      className={`flex-1 rounded-lg py-1.5 text-[12.5px] font-bold transition-colors ${
        key === active ? 'bg-white text-teal shadow-xs' : 'text-ink3 active:bg-white/60'
      }`}
      aria-pressed={key === active}
    >
      {label}
    </button>
  );
  return (
    <div className="shrink-0 border-b border-border/60 bg-white/90 px-4 py-2">
      <div className="flex gap-1 rounded-xl bg-panel-alt p-1">
        {tab('me', '내 근태', '/m/commute')}
        {tab('admin', adminLabel, '/m/commute-admin')}
      </div>
    </div>
  );
}
