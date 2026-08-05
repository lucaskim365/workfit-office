import { useState } from 'react';

interface ProcessOption {
  id: string;
  category: '결재 프로세스' | '합의 프로세스' | '수신·참조·시행' | '예외·제어';
  name: string;
  description: string;
  enabled: boolean;
  isImplemented: boolean; // 실제 시스템 엔진 및 UI 완전 구축 여부
}

const CATEGORY_ICONS: Record<ProcessOption['category'], string> = {
  '결재 프로세스': '⚖',
  '합의 프로세스': '🤝',
  '수신·참조·시행': '📨',
  '예외·제어': '🛡',
};

const DEFAULT_OPTIONS: ProcessOption[] = [
  // 1. 결재 프로세스 (대결/전결/후결/선결)
  {
    id: 'proxy_approval',
    category: '결재 프로세스',
    name: '대결자 지정',
    description: '결재자 휴가/출장 등 부재 등록 및 기본 대결자를 설정하여 결재를 자동 대행하는 프로세스를 사용합니다.',
    enabled: false,
    isImplemented: false,
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
    enabled: false,
    isImplemented: false,
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
    isImplemented: false,
  },
  {
    id: 'agreement_reject_cancel',
    category: '합의 프로세스',
    name: '합의 거부 시 즉시 반려',
    description: '합의 단계에서 1명 이상의 합의자가 거부 처리할 경우 결재 진행을 즉시 중단하고 문서를 반려 처리합니다.',
    enabled: false,
    isImplemented: false,
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

export default function ApprovalProcessScreen() {
  const [options, setOptions] = useState<ProcessOption[]>(DEFAULT_OPTIONS);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const categories: ProcessOption['category'][] = [
    '결재 프로세스',
    '합의 프로세스',
    '수신·참조·시행',
    '예외·제어',
  ];

  const toggleOption = (id: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, enabled: !opt.enabled } : opt))
    );
  };

  const handleSave = () => {
    setToastMsg('결재 세부 프로세스 설정이 성공적으로 저장되었습니다.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleReset = () => {
    setOptions(DEFAULT_OPTIONS);
    setToastMsg('기본 설정으로 초기화되었습니다.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const enabledCount = options.filter((o) => o.enabled).length;
  const implementedCount = options.filter((o) => o.isImplemented).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-3">
          <span className="text-teal">✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">결재 프로세스 설정</h1>
          <p className="mt-0.5 text-xs text-ink3">
            기준 정보 / 결재 프로세스 설정 · 부가 프로세스(결재 프로세스, 합의, 수신·참조·시행 등)의 사용 여부를 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="rounded-lg border border-border bg-panel px-3.5 py-2 text-[12.5px] font-medium text-ink2 hover:bg-panel-alt hover:text-ink transition-colors"
          >
            기본값 초기화
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 transition-opacity shadow-sm"
          >
            설정 저장
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="flex items-center justify-between rounded-xl border border-teal/20 bg-teal/5 px-4 py-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal/10 text-base text-teal">
            ⚙
          </span>
          <div>
            <span className="font-bold text-ink">세부 프로세스 가동 및 구현 현황</span>
            <span className="ml-2 text-ink3">
              총 {options.length}개 세부 프로세스 중 <strong className="text-teal">{enabledCount}개 활성</strong> (기능 구현완료: {implementedCount}개 / 기능 미구현: {options.length - implementedCount}개)
            </span>
          </div>
        </div>
        <div className="text-[11.5px] text-ink3">
          * <span className="font-bold text-rose-500">[기능 미구현]</span> 뱃지가 달린 항목은 향후 결재 엔진 및 시스템 확장 개발 대상입니다.
        </div>
      </div>

      {/* Categorized Sections Stacked Vertically in 1 Column */}
      <div className="flex flex-col gap-4">
        {categories.map((cat) => {
          const catOptions = options.filter((opt) => opt.category === cat);
          const icon = CATEGORY_ICONS[cat];

          return (
            <div
              key={cat}
              className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm"
            >
              {/* Category Section Header */}
              <div className="flex items-center justify-between border-b border-border bg-panel-alt px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{icon}</span>
                  <h2 className="text-sm font-bold text-ink">{cat}</h2>
                </div>
                <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-[11px] font-semibold text-ink2">
                  {catOptions.filter((o) => o.enabled).length} / {catOptions.length} 활성
                </span>
              </div>

              {/* 1-Column List of Process Items within this Category */}
              <div className="divide-y divide-border/50">
                {catOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className={`flex items-center justify-between p-4 transition-colors ${
                      opt.enabled ? 'hover:bg-panel-alt/30' : 'bg-panel-alt/40 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col gap-1 pr-6">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-ink">{opt.name}</h3>

                        {/* Implementation Status Badge */}
                        {opt.isImplemented ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                            기능 구현완료
                          </span>
                        ) : (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600">
                            기능 미구현
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink2 leading-relaxed">{opt.description}</p>
                    </div>

                    {/* Right Action: Status Tag & Toggle Switch */}
                    <div className="flex flex-shrink-0 items-center gap-4">
                      <span
                        className={`text-[11.5px] font-bold ${
                          opt.enabled ? 'text-teal' : 'text-ink3'
                        }`}
                      >
                        {opt.enabled ? '● 사용 중' : '○ 미사용'}
                      </span>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={opt.enabled}
                        onClick={() => toggleOption(opt.id)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          opt.enabled ? 'bg-teal' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            opt.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
