import { useState, useEffect } from 'react';
import { approvalProcessRepo, DEFAULT_PROCESS_OPTIONS, type ProcessOption } from '@/data/approvalProcess/approvalProcess.repo';

const CATEGORY_ICONS: Record<ProcessOption['category'], string> = {
  '결재 프로세스': '⚖',
  '합의 프로세스': '🤝',
  '수신·참조·시행': '📨',
  '예외·제어': '🛡',
};

export default function ApprovalProcessScreen() {
  const [options, setOptions] = useState<ProcessOption[]>(DEFAULT_PROCESS_OPTIONS);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    approvalProcessRepo.getOptions().then((res) => {
      setOptions(res);
      setIsLoading(false);
    });
  }, []);

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

  const handleSave = async () => {
    setIsLoading(true);
    await approvalProcessRepo.saveOptions(options);
    const fresh = await approvalProcessRepo.getOptions();
    setOptions(fresh);
    setIsLoading(false);
    setToastMsg('결재 세부 프로세스 설정이 성공적으로 저장되었습니다.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleReset = async () => {
    if (!confirm('정말로 모든 설정을 기본값으로 초기화하시겠습니까?')) return;
    setIsLoading(true);
    await approvalProcessRepo.saveOptions(DEFAULT_PROCESS_OPTIONS);
    const fresh = await approvalProcessRepo.getOptions();
    setOptions(fresh);
    setIsLoading(false);
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
            disabled={isLoading}
            className="rounded-lg border border-border bg-panel px-3.5 py-2 text-[12.5px] font-medium text-ink2 hover:bg-panel-alt hover:text-ink transition-colors disabled:opacity-50"
          >
            기본값 초기화
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
          >
            {isLoading ? '저장 중...' : '설정 저장'}
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
                        disabled={isLoading}
                        onClick={() => toggleOption(opt.id)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
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
