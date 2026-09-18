import { useState, useMemo } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  Search,
} from 'lucide-react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useEmployeeProfiles } from '@/features/employeeProfile/useEmployeeProfiles';
import type { User as UserType } from '@/domain/user/schema';
import MobileCommonHeader from './MobileCommonHeader';

export default function MobileOrgChartScreen() {
  const org = useOrgTree();
  const { data: employeeProfiles = [] } = useEmployeeProfiles();
  const profileMap = useMemo(() => {
    return new Map(employeeProfiles.map((p) => [p.userId || p.id, p]));
  }, [employeeProfiles]);

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // 유효한 부서 및 사용자 필터링
  const validUsers = useMemo(() => {
    return org.users.filter((u) => u.status === '사용' && !u.resignedAt);
  }, [org.users]);

  // 부서별 사원 맵
  const usersByDept = useMemo(() => {
    const map = new Map<string, UserType[]>();
    for (const u of validUsers) {
      const list = map.get(u.dept) ?? [];
      list.push(u);
      map.set(u.dept, list);
    }
    return map;
  }, [validUsers]);

  const departments = useMemo(() => {
    return org.depts
      .filter((d) => !d.name.includes('테스트'))
      .sort((a, b) => a.order - b.order);
  }, [org.depts]);

  const toggleDept = (deptName: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptName)) next.delete(deptName);
      else next.add(deptName);
      return next;
    });
  };

  // 검색 시 부서 필터링
  const filteredDepts = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    if (!kw) return departments;

    return departments.filter((d) => {
      const deptMatch = d.name.toLowerCase().includes(kw);
      const members = usersByDept.get(d.name) ?? [];
      const memberMatch = members.some(
        (m) =>
          m.name.toLowerCase().includes(kw) ||
          (m.position && m.position.toLowerCase().includes(kw)) ||
          (m.jobTitle && m.jobTitle.toLowerCase().includes(kw))
      );
      return deptMatch || memberMatch;
    });
  }, [departments, searchQuery, usersByDept]);

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader
        title="조직도"
        subtitle={`${departments.length}개 부서 · 총 ${validUsers.length}명`}
      />

      {/* 1. 검색창 */}
      <div className="bg-white px-3.5 py-2.5 border-b border-border/70 shrink-0 shadow-2xs">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="부서명 또는 사원 검색…"
            className="h-9 w-full rounded-xl border border-border bg-panel px-3 pl-8.5 text-[12px] text-ink outline-none focus:border-teal placeholder:text-ink3"
          />
          <Search size={14} className="absolute left-2.5 top-2.5 text-ink3 pointer-events-none" />
        </div>
      </div>

      {/* 2. 부서 아코디언 목록 */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2">
        {filteredDepts.map((dept) => {
          const members = usersByDept.get(dept.name) ?? [];
          const isExpanded = expandedDepts.has(dept.name) || searchQuery.trim().length > 0;

          return (
            <div
              key={dept.id}
              className="rounded-2xl border border-border/80 bg-white overflow-hidden shadow-2xs transition-all"
            >
              {/* 부서 헤더 바 */}
              <button
                type="button"
                onClick={() => toggleDept(dept.name)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-panel-alt/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-teal-soft/20 text-teal">
                    <Building2 size={15} />
                  </div>
                  <div>
                    <span className="text-[13.5px] font-bold text-ink">{dept.name}</span>
                    <span className="text-[11px] text-ink3 ml-2 font-medium">({members.length}명)</span>
                  </div>
                </div>

                <div className="text-ink3">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {/* 부서원 목록 */}
              {isExpanded && (
                <div className="border-t border-border/50 bg-panel-alt/30 p-2 space-y-1.5">
                  {members.length === 0 ? (
                    <div className="py-4 text-center text-[11.5px] text-ink3">소속 사원이 없습니다.</div>
                  ) : (
                    members.map((member) => {
                      const profile = profileMap.get(member.id);
                      const phone = profile?.phone || (member as { phone?: string }).phone;

                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-border/60 shadow-2xs"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-teal text-white text-[11px] font-bold shrink-0">
                              {member.name.slice(-2)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12.5px] font-bold text-ink">{member.name}</span>
                                <span className="text-[11px] text-ink3">{member.position}</span>
                              </div>
                              <p className="text-[10.5px] text-ink3 truncate font-mono">
                                {member.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {phone && (
                              <a
                                href={`tel:${phone}`}
                                className="grid h-7 w-7 place-items-center rounded-lg bg-teal-soft/20 text-teal hover:bg-teal-soft/40"
                                title="전화"
                              >
                                <Phone size={13} />
                              </a>
                            )}
                            <a
                              href={`mailto:${member.email}`}
                              className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                              title="메일"
                            >
                              <Mail size={13} />
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
