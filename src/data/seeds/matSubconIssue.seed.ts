import type { MatSubconIssue } from '@/domain/matSubconIssue/schema';

/**
 * 자재 외주불출 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 mock 이관)
 */
export const MAT_SUBCON_ISSUE_SEED: MatSubconIssue[] = [
  { no: 'SI-260611-11', vendor: '대성테크', code: 'PCB-A1', name: '메인 PCB', qty: 2000, type: '무상', issueStatus: '발행완료', status: '출고완료', urgent: true },
  { no: 'SI-260611-12', vendor: '한울가공', code: 'CMP-SHD-02', name: 'EMI 쉴드캔', qty: 1500, type: '유상', issueStatus: '발행완료', status: '출고완료' },
  { no: 'SI-260611-15', vendor: '동진정밀', code: 'WF-200-A', name: '200mm 웨이퍼', qty: 300, type: '무상', issueStatus: '미발행', status: '출고대기' },
  { no: 'SI-260610-30', vendor: '서원SMT', code: 'CMP-CON-14', name: '보드 커넥터', qty: 5000, type: '유상', issueStatus: '발행완료', status: '출고완료' },
];
