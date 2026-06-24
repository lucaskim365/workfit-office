import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { useAuthRoles } from '@/features/authRole/useAuthRoles';

const MENUS = ['운영 현황', '기준 정보', '생산 관리', '설비 관리', '품질 관리', '리포트', '시스템 관리'];

function Check({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-[18px] w-[18px] place-items-center rounded border transition-colors ${on ? 'border-teal bg-teal' : 'border-border-hi bg-panel hover:border-teal'}`}
    >
      {on && (
        <svg width="11" height="11" viewBox="0 0 12 12">
          <path d="M2 6.2l2.6 2.6L10 3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** 권한 관리 — 직무(역할) + 메뉴 접근/수정 권한. 와이어프레임 sys-screens.AuthMgmtContent 정본. */
export default function AuthMgmtScreen() {
  const { data: roles = [], isLoading } = useAuthRoles();
  const [selected, setSelected] = useState('MANAGER');
  // 화면 내 토글 편집을 보존하는 오버라이드. 키 = 역할 코드, 값 = [메뉴][접근,수정].
  const [overrides, setOverrides] = useState<Record<string, boolean[][]>>({});

  if (isLoading) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">불러오는 중…</div>;
  }
  if (roles.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">등록된 역할이 없습니다.</div>;
  }

  const role = roles.find((r) => r.code === selected) ?? roles[0];
  const grid: boolean[][] = overrides[role.code] ?? role.permissions.map((row) => [...row]);

  const toggle = (mi: number, ci: number) =>
    setOverrides((prev) => {
      const base = prev[role.code] ?? role.permissions.map((row) => [...row]);
      const next = base.map((row) => [...row]);
      next[mi][ci] = !next[mi][ci];
      return { ...prev, [role.code]: next };
    });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">권한 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 권한 관리</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '역할 추가' }, { preset: 'save', label: '저장', variant: 'primary' }]} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[300px_1fr]">
        <Card title="직무 (역할)" bodyClassName="p-0">
          {roles.map((r) => {
            const on = r.code === selected;
            return (
              <button
                key={r.code}
                onClick={() => setSelected(r.code)}
                style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}
                className={`flex w-full items-center gap-2 border-b border-border px-4 py-3 text-left transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
              >
                <span className={`text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{r.name}</span>
                <span className="text-[10.5px] text-ink3">{r.code}</span>
              </button>
            );
          })}
        </Card>

        <Card
          title={<span>메뉴 접근/수정 권한 <span className="text-teal">· {role.name}</span></span>}
          action={<span className="text-[10.5px] text-ink3">직무별 차등 부여</span>}
          bodyClassName="p-0"
        >
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border-b border-border bg-panel-alt px-3 py-2.5 text-left text-[10.5px] font-bold text-ink2">메뉴</th>
                <th className="w-[120px] border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold text-ink2">접근(조회)</th>
                <th className="w-[120px] border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold text-ink2">수정</th>
              </tr>
            </thead>
            <tbody>
              {MENUS.map((menu, mi) => (
                <tr key={menu} className={mi % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className="border-b border-border px-3 py-2.5 font-semibold text-ink">{menu}</td>
                  <td className="border-b border-border px-3 py-2.5"><div className="flex justify-center"><Check on={grid[mi][0]} onClick={() => toggle(mi, 0)} /></div></td>
                  <td className="border-b border-border px-3 py-2.5"><div className="flex justify-center"><Check on={grid[mi][1]} onClick={() => toggle(mi, 1)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
