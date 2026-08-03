import { useState } from 'react';
import type { ApprovalDoc, RelatedDoc } from '@/domain/approvalDoc/schema';
import { useCompletedDocsForSelection } from '@/features/gw/useApprovals';
import { useOrgTree } from '@/features/gw/useOrgTree';

interface RelatedDocSearchModalProps {
  userId: string;
  userDept?: string;
  userDeptId?: string;
  selectedDocIds: string[];
  onSelect: (docs: RelatedDoc[]) => void;
  onClose: () => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

export function RelatedDocSearchModal({
  userId,
  userDept,
  userDeptId,
  selectedDocIds,
  onSelect,
  onClose,
}: RelatedDocSearchModalProps) {
  const org = useOrgTree();
  const [keyword, setKeyword] = useState('');
  const [tempSelected, setTempSelected] = useState<ApprovalDoc[]>([]);

  const { data: docs = [], isLoading } = useCompletedDocsForSelection({
    userId,
    userDept,
    userDeptId,
    keyword,
  });

  const nameOf = (id: string) => org.userById(id)?.name ?? id;

  const toggleSelect = (doc: ApprovalDoc) => {
    if (selectedDocIds.includes(doc.id)) return; // 이미 선택된 항목
    setTempSelected((prev) =>
      prev.some((x) => x.id === doc.id) ? prev.filter((x) => x.id !== doc.id) : [...prev, doc]
    );
  };

  const handleApply = () => {
    const relatedList: RelatedDoc[] = tempSelected.map((d) => ({
      docId: d.id,
      docNo: d.docNo,
      title: d.title,
      docType: d.docType,
      drafterName: d.drafterName || nameOf(d.drafterId),
      drafterDept: d.drafterDept || '',
      completedAt: d.completedAt,
    }));
    onSelect(relatedList);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border bg-panel-alt/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔗</span>
            <h2 className="text-sm font-bold text-ink">관련 문서 선택 (기결재 완료 문서)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink3 hover:bg-panel-alt hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 보안 안내 팁 */}
        <div className="bg-amber-soft/20 border-b border-amber/20 px-5 py-2.5 text-[11px] text-amber-700 flex items-start gap-2">
          <span className="shrink-0 text-sm">💡</span>
          <div>
            <b>보안 안내:</b> 관련 문서 연동 시 원본 문서의 열람 권한이 그대로 유지됩니다. 개인정보나 연봉 등 민감 정보가 포함된 기결재 문서를 선택할 때는 결재선 지정 및 보안 지침에 유의해 주세요.
          </div>
        </div>

        {/* 검색 필터 바 */}
        <div className="flex items-center gap-2 border-b border-border p-3.5 bg-panel shrink-0">
          <div className="relative flex-1">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="문서 제목, 문서 번호, 기안자로 검색..."
              className="w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2 pl-9 text-[12px] text-ink outline-none focus:border-teal transition-colors"
            />
            <span className="absolute left-3 top-2.5 text-[13px] text-ink3">🔍</span>
          </div>
          {tempSelected.length > 0 && (
            <span className="text-[11px] font-bold text-teal">
              {tempSelected.length}건 선택됨
            </span>
          )}
        </div>

        {/* 문서 목록 그리드 */}
        <div className="menu-scroll flex-1 overflow-y-auto p-3.5">
          {isLoading ? (
            <div className="py-12 text-center text-[12px] text-ink3">완료 문서를 불러오는 중입니다...</div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-ink3">
              {keyword ? '검색 조건에 일치하는 완료 문서가 없습니다.' : '연동 가능한 기결재 완료 문서가 없습니다.'}
            </div>
          ) : (
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="border-b border-border bg-panel-alt text-ink3 text-left">
                  <th className="w-10 px-3 py-2 text-center">선택</th>
                  <th className="w-32 px-3 py-2">문서번호</th>
                  <th className="w-20 px-3 py-2">서식</th>
                  <th className="px-3 py-2">제목</th>
                  <th className="w-28 px-3 py-2">기안자</th>
                  <th className="w-24 px-3 py-2 text-center">결재 완료일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {docs.map((doc) => {
                  const isAlreadyAdded = selectedDocIds.includes(doc.id);
                  const isChecked = isAlreadyAdded || tempSelected.some((x) => x.id === doc.id);

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => !isAlreadyAdded && toggleSelect(doc)}
                      className={`transition-colors ${
                        isAlreadyAdded
                          ? 'bg-panel-alt/40 opacity-50 cursor-not-allowed'
                          : isChecked
                          ? 'bg-teal-soft/20 cursor-pointer font-medium'
                          : 'hover:bg-panel-alt/60 cursor-pointer'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isAlreadyAdded}
                          onChange={() => {}}
                          className="rounded border-border text-teal focus:ring-teal cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-ink2">{doc.docNo}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink2">{doc.docType}</td>
                      <td className="px-3 py-2.5 font-bold text-ink truncate max-w-[240px]">
                        {doc.title}
                        {isAlreadyAdded && (
                          <span className="ml-1.5 text-[10px] font-normal text-ink3">(이미 추가됨)</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-ink2">
                        {doc.drafterName || nameOf(doc.drafterId)}
                        {doc.drafterDept && <span className="text-[10px] text-ink3 ml-1">({doc.drafterDept})</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-ink3">{formatDate(doc.completedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="flex items-center justify-between border-t border-border bg-panel-alt/40 px-5 py-3 shrink-0">
          <span className="text-[11px] text-ink3">
            목록에서 클릭하여 연동할 문서를 선택하세요.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-panel px-4 py-1.5 text-[12px] font-bold text-ink hover:bg-panel-alt transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={tempSelected.length === 0}
              className="rounded-xl bg-teal px-4 py-1.5 text-[12px] font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-40 transition-all"
            >
              선택 완료 ({tempSelected.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
