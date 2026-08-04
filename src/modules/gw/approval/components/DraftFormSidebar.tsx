import type { ApprovalForm } from '@/domain/approvalForm/schema';

export interface SidebarFolder {
  id: string;
  name: string;
  forms: ApprovalForm[];
}

export function DraftFormSidebar({
  sidebarOpen,
  setSidebarOpen,
  sidebarSearch,
  setSidebarSearch,
  onlyAllowedForms,
  setOnlyAllowedForms,
  sidebarFolders,
  openFolders,
  toggleFolder,
  disabledFormCodes,
  code,
  setCode,
  setValues,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarSearch: string;
  setSidebarSearch: (search: string) => void;
  onlyAllowedForms: boolean;
  setOnlyAllowedForms: (allowed: boolean) => void;
  sidebarFolders: SidebarFolder[];
  openFolders: Record<string, boolean>;
  toggleFolder: (id: string) => void;
  disabledFormCodes: Set<string>;
  code: string;
  setCode: (code: string) => void;
  setValues: (values: Record<string, any>) => void;
}) {
  const sidebarWidth = 240;

  return (
    <div
      style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      className="relative shrink-0 border-r border-border bg-panel-alt/30 transition-all duration-200"
    >
      {sidebarOpen && (
        <div className="flex h-full flex-col p-3 min-w-[240px]">
          <div className="border-b border-border pb-2 mb-2">
            <div className="text-[12px] font-bold text-ink mb-1 flex items-center justify-between">
              <span>📂 서식 선택</span>
            </div>

            <div className="space-y-1.5 mb-2">
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="서식 제목 검색..."
                className="w-full rounded-md border border-border-hi bg-panel px-2.5 py-1 text-[11px] text-ink outline-none focus:border-teal"
              />
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyAllowedForms}
                  onChange={(e) => setOnlyAllowedForms(e.target.checked)}
                  className="rounded border-border accent-teal cursor-pointer h-3.5 w-3.5"
                />
                <span className="text-[10px] font-bold text-ink2">작성 가능한 문서만 보기</span>
              </label>
            </div>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto">
            {sidebarFolders.map((f) => {
              const isOpen = openFolders[f.id] !== false;
              return (
                <div key={f.id} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleFolder(f.id)}
                    className="flex w-full items-center justify-between py-1 text-[11.5px] font-bold text-ink hover:text-teal transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>📂</span>
                      <span>{f.name}</span>
                    </span>
                    <span className="text-[9px] text-ink3">{isOpen ? '▼' : '▶'}</span>
                  </button>

                  {isOpen && (
                    <div className="pl-3 border-l border-border ml-1.5 space-y-0.5 mt-0.5">
                      {f.forms.map((fm) => {
                        const isDisabled = disabledFormCodes.has(fm.code);
                        return (
                          <button
                            key={fm.code}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              setCode(fm.code);
                              setValues({});
                            }}
                            className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11.5px] font-medium transition-colors ${
                              isDisabled
                                ? 'opacity-40 cursor-not-allowed'
                                : code === fm.code
                                ? 'bg-teal-soft text-teal font-semibold'
                                : 'text-ink2 hover:bg-border-hi/30'
                            }`}
                          >
                            <span className="text-[13px]">{fm.icon}</span>
                            <span className="truncate">{fm.name}</span>
                            {isDisabled && (
                              <span className="ml-auto text-[8.5px] font-bold bg-red-500/10 text-red-500 px-1 py-0.5 rounded">제한</span>
                            )}
                          </button>
                        );
                      })}
                      {f.forms.length === 0 && (
                        <div className="py-0.5 pl-5 text-[10.5px] text-ink3">서식이 없습니다.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-1/2 -right-2.5 -translate-y-1/2 z-[30] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-panel shadow hover:border-teal hover:text-teal transition-all text-[9px] font-bold text-ink2 cursor-pointer"
      >
        {sidebarOpen ? '◀' : '▶'}
      </button>
    </div>
  );
}
