import type { Board, Post } from '@/domain/board/schema';

export const BOARDS_SEED: Board[] = [
  { id: 'notice', name: '공지사항', icon: '📢', desc: '회사의 주요 공지사항 및 긴급 안내를 전달합니다.' },
  { id: 'event', name: '경조사', icon: '💐', desc: '임직원들의 기쁜 소식과 슬픈 소식을 함께 나눕니다.' },
  { id: 'rule', name: '사내규정', icon: '📑', desc: '회사의 복무규정, 보안정책 및 내규를 확인합니다.' },
  { id: 'archive', name: '자료실', icon: '📁', desc: '업무 관련 매뉴얼, 양식 및 참고 문서를 내려받습니다.' },
];

export const BOARD_POSTS_SEED: Post[] = [];
