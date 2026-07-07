import { useParams } from 'react-router-dom';

/** 그룹웨어 앱 slug → 표기(이름·아이콘). 조직도/전자결재/휴가는 실화면으로 대체 예정. */
const GW_APPS: Record<string, { name: string; icon: string; desc: string }> = {
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
};

/**
 * 그룹웨어 미구현 앱 랜딩(Phase 0) — 도크 타일 라우팅이 동작함을 보여준다.
 * 각 앱은 상위 계획서 로드맵에 따라 실화면으로 순차 대체.
 */
export default function GwComingSoon() {
  const { app = '' } = useParams();
  const meta = GW_APPS[app] ?? { name: '그룹웨어', icon: '▦', desc: '' };
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-xs font-medium text-ink3">그룹웨어 <span className="px-1">/</span> {meta.name}</div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-soft text-teal">{meta.icon}</span>
        <h1 className="text-xl font-bold text-ink">{meta.name}</h1>
      </div>
      <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-border bg-panel px-8 py-16 text-center">
        <div className="text-4xl">{meta.icon}</div>
        <div className="mt-3 text-[15px] font-bold text-ink">준비 중인 기능입니다</div>
        {meta.desc && <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-ink3">{meta.desc}</p>}
        <div className="mt-4 rounded-full bg-amber/10 px-3 py-1 text-[11px] font-bold text-amber">개발 로드맵에 따라 순차 오픈 예정</div>
      </div>
    </div>
  );
}
