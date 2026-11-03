import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarCheck,
  Camera,
  Clock,
  ClipboardCheck,
  FolderGit2,
  ListTodo,
  Mail,
  Megaphone,
  Network,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useSecurityContext } from '@/features/auth/useSecurityContext';
import { commutePolicy } from '@/domain/security/policy/commutePolicy';
import { workPlanPolicy } from '@/domain/security/policy/workPlanPolicy';
import GroupwareMenu, { type GroupwareMenuItem } from './GroupwareMenu';
import type { MobileTabContext } from './MobileTabLayout';

/** 하단 탭 '그룹웨어' — 모듈 메뉴. 관리자 메뉴는 권한이 있을 때만 보인다. */
export default function MobileGroupwareScreen() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { viewMode, pendingApprovals } = useOutletContext<MobileTabContext>();
  const securityContext = useSecurityContext();

  const items = useMemo<GroupwareMenuItem[]>(() => {
    const list: GroupwareMenuItem[] = [
      { id: 'approval', name: '전자결재', desc: '기안·품의·결재 현황 확인', path: '/m/approval', icon: ClipboardCheck, accent: true, badge: pendingApprovals > 0 ? `${pendingApprovals}건` : undefined },
      { id: 'mail', name: '메일', desc: '사내 메일 송수신', path: '/m/mail', icon: Mail, disabled: true },
      { id: 'task', name: '업무계획', desc: '업무 계획 등록 및 진행 현황', path: '/m/task', icon: CalendarCheck, accent: true },
      { id: 'commute', name: '근태·휴가', desc: '출퇴근 기록 및 잔여 연차', path: '/m/commute', icon: Clock, accent: true },
      { id: 'calendar', name: '캘린더', desc: '전사·개인 일정 관리', path: '/m/calendar', icon: Calendar },
      { id: 'board', name: '게시판', desc: '전사 공지 및 경조사', path: '/m/board', icon: Megaphone },
      { id: 'gallery', name: '회사 갤러리', desc: '사내 행사 및 전사 사진', path: '/m/gallery', icon: Camera },
      { id: 'project', name: '프로젝트', desc: '프로젝트 관리', path: '/m/project', icon: FolderGit2, disabled: true },
      { id: 'resource', name: '자원예약', desc: '회의실 및 공용자원 예약', path: '/m/resource', icon: Building2 },
      { id: 'survey', name: '전자설문', desc: '임직원 의견 수렴', path: '/m/survey', icon: BarChart3 },
      { id: 'orgchart', name: '조직도', desc: '부서 계층 및 임직원 배치도', path: '/m/orgchart', icon: Network },
      { id: 'contacts', name: '인명관리', desc: '임직원 연락처 검색', path: '/m/contacts', icon: Users },
    ];
    if (commutePolicy.canAccessCommuteAdmin(securityContext)) {
      list.push({ id: 'commute-admin', name: '근태 관제', desc: '전사·부서 출퇴근 현황, 이상근태, 연차 대장', path: '/m/commute-admin', icon: ShieldCheck });
    }
    if (workPlanPolicy.canAccessWorkPlanAdmin(securityContext)) {
      list.push({ id: 'work-plan-admin', name: '업무 종합', desc: '팀·전사 주간 업무 취합과 진척률', path: '/m/work-plan-admin', icon: ListTodo });
    }
    return list;
  }, [pendingApprovals, securityContext]);

  return <GroupwareMenu userId={user!.id} items={items} mode={viewMode} onOpen={(item) => nav(item.path)} />;
}
