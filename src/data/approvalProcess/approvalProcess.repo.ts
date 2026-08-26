export interface ProcessOption {
  id: string;
  category: '결재 프로세스' | '합의 프로세스' | '수신·참조·시행' | '예외·제어';
  name: string;
  description: string;
  enabled: boolean;
  isImplemented: boolean; // 실제 시스템 엔진 및 UI 완전 구축 여부
}

export const DEFAULT_PROCESS_OPTIONS: ProcessOption[] = [
  // 1. 결재 프로세스 (대결/전결/후결/선결)
  {
    id: 'proxy_approval',
    category: '결재 프로세스',
    name: '대결자 지정',
    description: '결재자 휴가/출장 등 부재 등록 및 기본 대결자를 설정하여 결재를 자동 대행하는 프로세스를 사용합니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'arbitrary_decision',
    category: '결재 프로세스',
    name: '전결 승인',
    description: '서식 및 규칙별 전결 기준 충족 시, 전결권자의 승인으로 최종 승인 또는 차상급 결재를 전결 처리합니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'post_approval',
    category: '결재 프로세스',
    name: '사후 결재 (후결)',
    description: '긴급건 또는 선조치가 필요한 업무 서식에 대해 선집행 후 사후 결재(후결) 절차를 진행할 수 있도록 허용합니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'parallel_approval_toggle',
    category: '결재 프로세스',
    name: '병렬 결재 기능',
    description: '동일 결재 단계에 복수의 결재자를 지정하여 동시에 결재를 진행할 수 있는 병렬 결재 프로세스를 허용합니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'pre_approval',
    category: '결재 프로세스',
    name: '선결 (선승인)',
    description: '하위 순차 결재자의 승인 대기 여부와 상관없이 상급 결재자가 문서를 미리 확인하여 먼저 결재(선결) 처리하는 프로세스를 지원합니다.',
    enabled: false,
    isImplemented: false,
  },

  // 2. 합의 프로세스
  {
    id: 'dept_agreement',
    category: '합의 프로세스',
    name: '부서 간 합의',
    description: '문서 기안 시 타 부서와의 병렬 또는 순차 합의 결재선을 추가하고 의견을 수렴할 수 있는 합의 프로세스를 지원합니다.',
    enabled: false,
    isImplemented: true,
  },
  {
    id: 'agreement_reject_cancel',
    category: '합의 프로세스',
    name: '합의 거부 시 즉시 반려',
    description: '합의 단계에서 1명 이상의 합의자가 거부 처리할 경우 결재 진행을 즉시 중단하고 문서를 반려 처리합니다.',
    enabled: false,
    isImplemented: true,
  },

  // 3. 수신/참조/시행
  {
    id: 'recipient_dept',
    category: '수신·참조·시행',
    name: '수신처 배부',
    description: '문서가 최종 승인되면 지정된 수신 부서/담당자의 수신함으로 문서를 자동 배부하고 알림을 발송합니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'reference_notice',
    category: '수신·참조·시행',
    name: '참조자 지정',
    description: '결재선 외에 진행 현황 및 완료 문서를 공유받아 열람할 수 있는 참조자를 기안 단계에서 지정할 수 있습니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'enforcement_notice',
    category: '수신·참조·시행',
    name: '시행처 공지 및 관리',
    description: '결재 완료 후 지정 부서/담당자에게 시행 처리 권한 및 시행함 열람/시행 완료 패널 기능을 제공합니다.',
    enabled: true,
    isImplemented: true,
  },

  // 4. 예외 및 제어
  {
    id: 'draft_recall',
    category: '예외·제어',
    name: '기안자 문서 회수',
    description: '최초 결재자가 결재를 진행하기 전(대기 상태)에 한해 기안자가 문서를 회수하여 수정 또는 취소할 수 있습니다.',
    enabled: true,
    isImplemented: true,
  },
  {
    id: 'mid_route_edit',
    category: '예외·제어',
    name: '진행 중 결재선 변경',
    description: '결재 진행 중 상위 결재자나 검토자가 차순위 결재선 또는 참조자를 추가/변경할 수 있는 권한을 제공합니다.',
    enabled: false,
    isImplemented: false,
  },
];

const STORAGE_KEY = 'workfit_approval_process_options';

export const approvalProcessRepo = {
  /** 프로세스 설정 옵션 목록 조회 */
  async getOptions(): Promise<ProcessOption[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const storedOptions: ProcessOption[] = JSON.parse(raw);
        // 디폴트 옵션과 병합 (신규 추가된 옵션 보존)
        return DEFAULT_PROCESS_OPTIONS.map((def) => {
          const match = storedOptions.find((s) => s.id === def.id);
          return match ? { ...def, enabled: match.enabled } : def;
        });
      }
    } catch (e) {
      console.warn('Failed to parse approval process options:', e);
    }
    return DEFAULT_PROCESS_OPTIONS;
  },

  /** 프로세스 설정 옵션 목록 저장 */
  async saveOptions(options: ProcessOption[]): Promise<ProcessOption[]> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    return options;
  },

  /** 특정 프로세스 옵션의 활성화(ON) 여부 판별 */
  async isOptionEnabled(optionId: string): Promise<boolean> {
    const options = await this.getOptions();
    const opt = options.find((o) => o.id === optionId);
    return opt ? opt.enabled : false;
  },
};
