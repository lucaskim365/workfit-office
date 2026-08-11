import type { DocumentBox, DocumentItem } from '@/domain/document/schema';

export const DOCUMENT_BOX_SEEDS: DocumentBox[] = [
  { id: 'rule', name: '규정', desc: '회사의 공식 규정 및 사내 복무 정책 문서들을 보관합니다.' },
  { id: 'manual', name: '업무매뉴얼', desc: '각 부서별 세부 업무 수행 방법 및 가이드라인을 제공합니다.' },
  { id: 'form', name: '서식', desc: '결재 상신, 계약 체결 등 업무에 사용하는 표준 양식 문서입니다.' },
  { id: 'resource', name: '업무자료', desc: '기타 참고용 통계 및 협업 부서 공유자료 등을 통합 보관합니다.' }
];

export const DOCUMENT_SEEDS: DocumentItem[] = [
  {
    id: 1,
    boxId: 'rule',
    name: '취업규칙',
    desc: '회사의 근무 조건, 임금 및 복무 기준에 관한 기본 규정입니다.',
    attachments: ['취업규칙_v3.0_최종본.pdf'],
    dept: '인사지원팀',
    author: '이영희 차장',
    date: '2026-08-01',
    version: 'v3.0',
    isRule: true,
    versions: [
      {
        version: 'v3.0',
        effectiveDate: '2026-08-01',
        revisedDate: '2026-07-25',
        reason: '유연근무제 시간대 세분화 및 하계 전사 공동 연휴 신설 규칙 반영',
        attachments: ['취업규칙_v3.0_최종본.pdf'],
        author: '이영희 차장',
        date: '2026-07-25'
      },
      {
        version: 'v2.0',
        effectiveDate: '2025-03-01',
        revisedDate: '2025-02-15',
        reason: '주 52시간 근무 근로기준법 개정 사항 보안 지침 업데이트',
        attachments: ['취업규칙_v2.0_이력본.pdf'],
        author: '이영희 차장',
        date: '2025-02-15'
      },
      {
        version: 'v1.0',
        effectiveDate: '2024-01-01',
        revisedDate: '2023-12-10',
        reason: '회사 설립에 따른 최초 복무 취업규칙 제정 등록',
        attachments: ['취업규칙_v1.0_초안본.pdf'],
        author: '이영희 차장',
        date: '2023-12-10'
      }
    ]
  },
  {
    id: 2,
    boxId: 'rule',
    name: '복무규정',
    desc: '임직원의 성실 의무, 품위 유지 및 징계 등에 관한 구체적인 내부 잣대 규정입니다.',
    attachments: ['사내_복무규정_v2.1.pdf'],
    dept: '인사지원팀',
    author: '이영희 차장',
    date: '2026-07-15',
    version: 'v2.1',
    isRule: true,
    versions: [
      {
        version: 'v2.1',
        effectiveDate: '2026-07-15',
        revisedDate: '2026-07-02',
        reason: '보안 관리 책임 및 비밀 유지 서약 의무 절차 추가',
        attachments: ['사내_복무규정_v2.1.pdf'],
        author: '이영희 차장',
        date: '2026-07-02'
      },
      {
        version: 'v1.0',
        effectiveDate: '2024-01-01',
        revisedDate: '2023-12-10',
        reason: '최초 복무 기본 규정 제정',
        attachments: ['사내_복무규정_v1.0.pdf'],
        author: '이영희 차장',
        date: '2023-12-10'
      }
    ]
  },
  {
    id: 3,
    boxId: 'rule',
    name: '출장규정',
    desc: '출장 시 여비 여건, 교통비 및 일비 정산 요령 규정입니다.',
    attachments: ['국내외_출장여비규정_v1.3.pdf'],
    dept: '재무관리팀',
    author: '박광래 차장',
    date: '2026-06-20',
    version: 'v1.3',
    isRule: true,
    versions: [
      {
        version: 'v1.3',
        effectiveDate: '2026-06-20',
        revisedDate: '2026-06-11',
        reason: '해외 현지 일비 지급 단가 현실화 조정 변경',
        attachments: ['국내외_출장여비규정_v1.3.pdf'],
        author: '박광래 차장',
        date: '2026-06-11'
      },
      {
        version: 'v1.0',
        effectiveDate: '2024-01-01',
        revisedDate: '2023-12-10',
        reason: '최초 여비지급 정산 여비규정 제정',
        attachments: ['국내외_출장여비규정_v1.0.pdf'],
        author: '박광래 차장',
        date: '2023-12-10'
      }
    ]
  },
  {
    id: 4,
    boxId: 'manual',
    name: '그룹웨어 사용자 매뉴얼',
    desc: '전자결재 상신, 퀵도크 위젯 사용 및 개인 정보 설정 등 서비스 조작 지침 매뉴얼입니다.',
    attachments: ['그룹웨어_사용자_매뉴얼_v1.1.pdf'],
    dept: '정보기술팀',
    author: '김승기 부장',
    date: '2026-08-05',
    isRule: false,
    versions: []
  },
  {
    id: 5,
    boxId: 'manual',
    name: '인사 평가 표준 가이드북',
    desc: '부서장 및 팀원을 위한 분기별 업무 성과 및 역량 평가 고과 매뉴얼입니다.',
    attachments: ['분기별_성과평가_작성_지침서.pdf'],
    dept: '인사지원팀',
    author: '이영희 차장',
    date: '2026-07-10',
    isRule: false,
    versions: []
  },
  {
    id: 6,
    boxId: 'form',
    name: '표준 용역 및 자재 도급 계약서 양식',
    desc: '외주 용역 및 원자재 공급 도급 계약 체결 시 사용하는 당사 공식 한글 표준 서식입니다.',
    attachments: ['표준_용역_및_자재_도급_계약서.docx'],
    dept: '법무지원팀',
    author: '정소연 사원',
    date: '2026-08-03',
    isRule: false,
    versions: []
  },
  {
    id: 7,
    boxId: 'form',
    name: '휴가 신청 서식 문서',
    desc: '연차, 반차, 특별휴가 상신이 어려울 때 작성하여 서면 제출하는 복리후생 부대 양식입니다.',
    attachments: ['휴가_신청서_수기제출용.hwp'],
    dept: '인사지원팀',
    author: '홍채원 사원',
    date: '2026-07-20',
    isRule: false,
    versions: []
  },
  {
    id: 8,
    boxId: 'resource',
    name: '2026 하반기 마케팅 기획 초안 자료',
    desc: '마케팅본부에서 제작한 하반기 신규 프로모션 기획 및 브랜딩 홍보 로드맵 공유자료입니다.',
    attachments: ['하반기_통합_마케팅_캠페인_기획안.pdf'],
    dept: '마케팅전략팀',
    author: '강윤석 팀장',
    date: '2026-08-08',
    isRule: false,
    versions: []
  }
];
