import type { DocumentBox, DocumentItem } from '@/domain/document/schema';

export const DOCUMENT_BOX_SEEDS: DocumentBox[] = [
  { id: 'rule', name: '규정', desc: '회사의 공식 규정 및 사내 복무 정책 문서들을 보관합니다.' },
  { id: 'manual', name: '업무매뉴얼', desc: '각 부서별 세부 업무 수행 방법 및 가이드라인을 제공합니다.' },
  { id: 'form', name: '서식', desc: '결재 상신, 계약 체결 등 업무에 사용하는 표준 양식 문서입니다.' },
  { id: 'resource', name: '업무자료', desc: '기타 참고용 통계 및 협업 부서 공유자료 등을 통합 보관합니다.' }
];

/** 예시 문서는 제거(실데이터만 사용). */
export const DOCUMENT_SEEDS: DocumentItem[] = [];
