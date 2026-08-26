import type { ApprovalForm, FormField } from '@/domain/approvalForm/schema';
import type { ApprovalRouteRule, Resolver } from '@/domain/approvalRoute/schema';

export const RESOLVER_LABEL: Record<Resolver, string> = {
  MANAGER: '직속 상급자',
  DEPT_HEAD: '소속 부서장',
  PARENT_DEPT_HEAD: '상위 부서장(level)',
  ROLE_CEO: '대표',
  ROLE_DIVISION_HEAD: '본부장',
  POSITION_AT_LEAST: '직급 이상',
  SPECIFIC_USER: '특정 사용자',
  SPECIFIC_DEPT_HEAD: '특정 부서장',
};

export const ARG_HINT: Partial<Record<Resolver, string>> = {
  PARENT_DEPT_HEAD: 'level(예: 1)',
  POSITION_AT_LEAST: 'rank(예: 3)',
  SPECIFIC_USER: 'userId',
  SPECIFIC_DEPT_HEAD: 'deptId',
};

export const blankRule = (formId: string, docType: string): ApprovalRouteRule => ({
  id: '',
  name: '',
  priority: 50,
  active: true,
  formId,
  docType,
  conditionKey: null,
  conditionValues: [],
  deptScope: { kind: '전체', deptId: null, deptType: null },
  positionFromRank: null,
  positionToRank: null,
  amountFrom: null,
  amountTo: null,
  steps: [{ resolver: 'DEPT_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false }],
});

export const blankField = (): FormField => ({
  key: '',
  label: '',
  type: '텍스트',
  required: false,
  options: [],
  placeholder: '',
  width: 'full',
  section: '',
  isAmountKey: false,
  visibleIf: null,
  isTabSelector: false,
  isSecret: false,
  tabOverrides: {},
});

export const blankForm = (folderId: string | null = null): ApprovalForm => ({
  id: '',
  code: '',
  name: '',
  icon: '📄',
  docTitle: '',
  closing: '',
  active: true,
  order: 99,
  system: false,
  folderId,
  recipientDeptId: null,
  recipientUserId: null,
  recipientDrafter: false,
  executionDeptId: null,
  executionUserId: null,
  preservationPeriod: '5년',
  allowedPositionFromRank: null,
  allowedPositionToRank: null,
  allowedDeptIds: [],
  fields: [{ ...blankField(), key: 'body', label: '본문', type: '장문', required: true }],
});

export const getJobTitleRank = (name: string): number => {
  if (name.includes('대표')) return 1;
  if (name.includes('본부장')) return 2;
  if (name.includes('임원') || name.includes('이사')) return 3;
  if (name.includes('팀장')) return 4;
  if (name.includes('파트장')) return 5;
  return 6;
};
