import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useUsers } from '@/features/user/useUsers';
import { useSubmitPermissionRequest } from '@/features/permissionRequest/usePermissionRequest';
import { Card } from '@/shared/ui/Card';

export default function PermissionRequestScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: users = [], isLoading } = useUsers();
  const submitRequest = useSubmitPermissionRequest();

  // 사용자별 제안된 역할 매핑 { [userId]: roleGroup }
  const [proposedRoles, setProposedRoles] = useState<Record<string, string>>({});
  const [comments, setComments] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 사용자 목록이 로드되면 기본값으로 현재 roleGroup 세팅
  useEffect(() => {
    if (users.length > 0) {
      const initial: Record<string, string> = {};
      users.forEach((u) => {
        initial[u.id] = u.roleGroup;
      });
      setProposedRoles(initial);
    }
  }, [users]);

  // 비인가자 접근 차단 가드 (U003 손 상무, U012 홍채원만 허용)
  if (user?.id !== 'U003' && user?.id !== 'U012') {
    return (
      <div className="flex h-[calc(100vh-130px)] items-center justify-center bg-panel-alt/10 rounded-xl border border-border">
        <div className="text-center max-w-[280px] p-6">
          <span className="text-4xl">🔒</span>
          <h2 className="mt-3 text-[13px] font-bold text-ink">접근 권한이 없습니다</h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink3">
            해당 화면은 지정된 대상자(손승원 상무, 홍채원 사원)만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const handleRoleChange = (userId: string, newRole: string) => {
    setProposedRoles((prev) => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  const handleSubmit = () => {
    if (!user) return;
    
    // 비파괴성 요청 전송
    submitRequest.mutate(
      {
        submitterId: user.id,
        submitterName: user.name,
        userRoles: proposedRoles,
        comments: comments.trim(),
      },
      {
        onSuccess: () => {
          setSuccessMsg('권한 변경 건의안이 성공적으로 제출되었습니다. (실제 DB에는 직접 반영되지 않고 어드민이 검토 후 적용합니다)');
          setComments('');
          setTimeout(() => {
            setSuccessMsg('');
            navigate('/exec'); // 제출 완료 후 대시보드로 이동
          }, 3000);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-3.5 h-[calc(100vh-130px)] min-h-0">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">권한 변경 건의 콘솔</h1>
        <p className="mt-0.5 text-xs text-ink3">
          임직원들의 권한 등급을 검토하고, 추가 요구사항 및 의견을 작성하여 전송합니다. (비파괴적 건의 전용 페이지)
        </p>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-teal-soft/80 border border-teal p-3.5 text-[11.5px] font-bold text-teal-dark shadow-sm">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-[1fr_360px] gap-4 min-h-0 flex-1">
        {/* 사용자 목록 및 변경 제안 테이블 */}
        <Card title="임직원 권한 매핑 검토" bodyClassName="p-3 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-[12px] text-ink3">
              사용자 데이터를 읽어오는 중입니다...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto content-scroll">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-panel-alt/50">
                    <th className="px-3 py-2 text-left font-bold text-ink2">사번</th>
                    <th className="px-3 py-2 text-left font-bold text-ink2">이름</th>
                    <th className="px-3 py-2 text-left font-bold text-ink2">부서</th>
                    <th className="px-3 py-2 text-left font-bold text-ink2">직급</th>
                    <th className="px-3 py-2 text-left font-bold text-ink2">현재 권한</th>
                    <th className="px-3 py-2 text-left font-bold text-ink2" style={{ width: 120 }}>제안 권한</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border hover:bg-panel-alt/20">
                      <td className="px-3 py-2.5 font-mono text-ink2">{u.empNo}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{u.name}</td>
                      <td className="px-3 py-2.5 text-ink2">{u.dept}</td>
                      <td className="px-3 py-2.5 text-ink2">{u.position}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block rounded bg-panel-alt px-1.5 py-0.5 text-[10px] font-bold text-ink2">
                          {u.roleGroup === 'ADMIN' ? '관리자' : u.roleGroup === 'OPERATOR' ? '임원' : '일반사원'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={proposedRoles[u.id] || u.roleGroup}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="h-7 w-full rounded border border-border-hi bg-panel px-1.5 text-[11px] text-ink focus:border-teal outline-none"
                        >
                          <option value="ADMIN">관리자</option>
                          <option value="OPERATOR">임원</option>
                          <option value="USER">일반사원</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 건의서 제출 및 의견 입력 패널 */}
        <div className="flex flex-col gap-4">
          <Card title="권한 등급 가이드" bodyClassName="p-4 space-y-2.5">
            <div className="flex flex-col gap-2 text-[11px] leading-relaxed select-none">
              <div className="border-b border-border pb-1.5">
                <span className="font-bold text-navy bg-blue-soft px-1.5 py-0.5 rounded text-[9.5px]">관리자 (ADMIN)</span>
                <p className="mt-1 text-ink2">전사 시스템 관리 권한. 사용자/권한/코드 전 영역 접근 가능.</p>
              </div>
              <div className="border-b border-border pb-1.5">
                <span className="font-bold text-teal bg-teal-soft px-1.5 py-0.5 rounded text-[9.5px]">임원 (OPERATOR)</span>
                <p className="mt-1 text-ink2">결재선 문서 모니터링 및 완료 문서 조회 권한.</p>
              </div>
              <div>
                <span className="font-bold text-ink2 bg-panel-alt px-1.5 py-0.5 rounded text-[9.5px]">일반사원 (USER)</span>
                <p className="mt-1 text-ink2">일반 사원 권한. 기본 조회 및 본인 업무 작성/신청 권한.</p>
              </div>
            </div>
          </Card>

          <Card title="추가 요구사항 및 의견 작성" className="flex-1 flex flex-col min-h-0" bodyClassName="p-4 flex flex-col flex-1 gap-3">
            <p className="text-[10.5px] leading-relaxed text-ink3 select-none">
              임직원 권한 매핑 외에 추가로 개별 부여하고 싶은 상세 권한이나 기타 건의 의견을 아래에 자유롭게 작성해 주세요.
            </p>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="예: 홍채원 사원에게 특정 모니터링 메뉴 추가 권한을 부여해 주세요."
              className="flex-1 w-full rounded-lg border border-border-hi bg-panel-alt p-3 text-[11.5px] text-ink outline-none focus:border-teal resize-none leading-relaxed"
            />
            <button
              onClick={handleSubmit}
              disabled={submitRequest.isPending || users.length === 0}
              className="h-9 w-full rounded-lg bg-teal text-white text-[12px] font-bold shadow-sm hover:bg-teal-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitRequest.isPending ? '건의서 전송 중...' : '📨 건의서 제출'}
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
