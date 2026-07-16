import type { FlatScreen } from '@/shared/types/menu';

/**
 * 그룹웨어 앱 메타 — 도크 전용(menu-tree 밖) 화면의 단일 소스.
 * 탭 합성(gwScreen)·미구현 랜딩(GwComingSoon)·도크가 공유한다.
 * ([[groupware-feature]] 진입 방식 A: 각 앱 = 본문 전체화면 라우트)
 */
export interface GwAppMeta {
  name: string;
  icon: string;
  desc: string;
}

export const GW_APP_META: Record<string, GwAppMeta> = {
  orgchart: { name: '조직도', icon: '🏢', desc: '부서 계층과 사원 배치·상급자 관계를 조회합니다.' },
  approval: { name: '전자결재', icon: '🖋️', desc: '기안·품의·지출결의 등 사내 문서의 승인 과정을 온라인으로 처리합니다.' },
  leave: { name: '휴가관리', icon: '🏖️', desc: '연차·반차·경조 등 잔여 휴가 조회와 신청·승인 내역을 관리합니다.' },
  calendar: { name: '일정관리', icon: '📅', desc: '개인·부서·전사 일정을 기록하고 관리하는 캘린더입니다.' },
  mail: { name: '메일', icon: '✉️', desc: '사내·외부 비즈니스 소통을 주고받는 사내 메일 시스템입니다.' },
  resource: { name: '자원예약', icon: '📦', desc: '회의실·차량·공용 장비의 사용 시간을 예약·관리합니다.' },
  survey: { name: '전자설문', icon: '📋', desc: '임직원 대상 의견 수렴·만족도 조사를 비대면으로 진행합니다.' },
  board: { name: '게시판', icon: '📌', desc: '전사 공지·경조사·사내 규정 등을 게시하고 확인합니다.' },
  community: { name: '커뮤니티', icon: '💬', desc: '동호회·소모임 등 임직원 간 자유로운 소통 공간입니다.' },
  document: { name: '문서관리', icon: '🗂️', desc: '매뉴얼·서식·산출물 등 중요 문서를 분류·보관하는 문서고입니다.' },
  contacts: { name: '인명관리', icon: '👥', desc: '임직원·외부 거래처 연락처를 검색·관리하는 주소록입니다.' },
  task: { name: '업무관리', icon: '📗', desc: '프로젝트·업무 보고·TO-DO를 등록하고 진행을 트래킹합니다.' },
  'permission-request': { name: '권한 건의', icon: '🔑', desc: '임직원 권한 매핑 검토 및 변경 건의 서식입니다.' },
};

/** 그룹웨어 앱 라우트 여부. */
export const isGwUrl = (url: string) => url.startsWith('/gw/');

/**
 * 그룹웨어 라우트(/gw/<slug>) → 탭용 FlatScreen 합성. 미지의 slug 는 '그룹웨어'로 폴백.
 * MES 화면과 동일한 탭 모델로 다루기 위해 moduleId/group 을 'gw'로 채운다.
 */
export function gwScreen(url: string): FlatScreen | null {
  if (!isGwUrl(url)) return null;
  const slug = url.slice('/gw/'.length).split('/')[0];
  const meta = GW_APP_META[slug] ?? { name: '그룹웨어', icon: '▦', desc: '' };
  return {
    id: `gw:${slug}`,
    name: meta.name,
    url,
    icon: meta.icon,
    moduleId: 'gw',
    moduleName: '그룹웨어',
    groupId: 'gw',
    groupName: '그룹웨어',
  };
}
