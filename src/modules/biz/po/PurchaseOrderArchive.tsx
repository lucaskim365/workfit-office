import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Download, FileCheck2, FileText, Loader2, PackageCheck, Receipt, Search, Trash2, Upload } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { downloadFile } from '@/shared/lib/download';
import { exportElementToPdf } from '@/shared/lib/pdf';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import {
  canUploadPoReply,
  completedDateOf,
  filterPurchaseOrders,
  poPdfFileName,
  type PoArchiveQuery,
  type PoReply,
  type PoReplyFilter,
  type PoViewer,
} from '@/domain/poArchive/schema';
import {
  useDeletePoReply,
  useDeletePoTaxInvoice,
  usePoReplies,
  usePoTaxInvoices,
  usePurchaseOrderArchive,
  useUploadPoReply,
  useUploadPoTaxInvoice,
} from '@/features/poArchive/usePoArchive';
import { poReplyRepo, poTaxInvoiceRepo } from '@/data/poArchive/poReply.repo';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';
import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';

const REPLY_FILTERS: { key: PoReplyFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '회신 대기' },
  { key: 'replied', label: '회신 완료' },
];

/** 파일 고르는 창에 먼저 보여 줄 형식 — 스캔본·사진·PDF. 다른 형식도 올릴 수 있다(끌어다 놓기 포함). */
const REPLY_ACCEPT = '.pdf,.jpg,.jpeg,.png,.tif,.tiff';

/** 행마다 올리는 파일 종류 */
type UploadKind = 'reply' | 'tax';
const KIND_LABEL: Record<UploadKind, string> = { reply: '회신 문서', tax: '세금계산서' };

/**
 * 발주서 보관함 — 결재 완료된 발주서가 자동으로 쌓이는 목록.
 * 한 줄: 제목 · 완료일자 | PDF 다운로드 | 회신 문서(거래처 직인본) | 매입 세금계산서(미발행/발행 완료).
 */
export function PurchaseOrderArchive({
  me,
  isManager,
}: {
  me: { id: string; name: string; dept: string };
  isManager: boolean;
}) {
  const viewer = useMemo(
    () => (me.id === 'guest' ? null : { userId: me.id, deptName: me.dept, isManager }),
    [me.id, me.dept, isManager],
  );
  const { docs, isLoading } = usePurchaseOrderArchive(viewer);
  const { data: replies = [] } = usePoReplies();
  const upload = useUploadPoReply();
  const { data: taxInvoices = [] } = usePoTaxInvoices();
  const uploadTax = useUploadPoTaxInvoice();

  const replyByDoc = useMemo(() => new Map(replies.map((r) => [r.docId, r])), [replies]);
  const taxByDoc = useMemo(() => new Map(taxInvoices.map((t) => [t.docId, t])), [taxInvoices]);
  const [query, setQuery] = useState<PoArchiveQuery>({ keyword: '', from: '', to: '', reply: 'all' });
  const rows = useMemo(
    () => filterPurchaseOrders(docs, query, (id) => replyByDoc.has(id)),
    [docs, query, replyByDoc],
  );

  const [viewDoc, setViewDoc] = useState<ApprovalDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── 회신 문서·세금계산서 업로드 — 클릭(숨긴 file input 하나를 행마다 돌려 씀)과 끌어다 놓기가 같은 길로 올린다 ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ doc: ApprovalDoc; kind: UploadKind } | null>(null);
  const pickFile = (doc: ApprovalDoc, kind: UploadKind) => {
    setUploadTarget({ doc, kind });
    fileRef.current?.click();
  };
  const uploadPoFile = async (doc: ApprovalDoc, kind: UploadKind, file: File) => {
    const label = KIND_LABEL[kind];
    const prev = (kind === 'reply' ? replyByDoc : taxByDoc).get(doc.id);
    if (prev && !window.confirm(`이미 올린 ${label}(${prev.name})를 새 파일로 바꿀까요?`)) return;
    setErr(null);
    setUploadTarget({ doc, kind });
    try {
      await (kind === 'reply' ? upload : uploadTax).mutateAsync({ doc, file, actor: { id: me.id, name: me.name } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : `${label}를 올리지 못했습니다.`);
    } finally {
      setUploadTarget(null);
    }
  };
  const onFile = async (file: File | undefined) => {
    const target = uploadTarget;
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !target) {
      setUploadTarget(null);
      return;
    }
    await uploadPoFile(target.doc, target.kind, file);
  };

  const downloadPoFile = async (kind: UploadKind, file: PoReply) => {
    setErr(null);
    try {
      await downloadFile(await (kind === 'reply' ? poReplyRepo : poTaxInvoiceRepo).downloadUrl(file), file.name);
    } catch {
      setErr(`${KIND_LABEL[kind]}를 내려받지 못했습니다.`);
    }
  };

  const remove = useDeletePoReply();
  const removeTax = useDeletePoTaxInvoice();
  const deletePoFile = async (kind: UploadKind, file: PoReply) => {
    const label = KIND_LABEL[kind];
    if (!window.confirm(`${label}(${file.name})를 삭제할까요? 삭제하면 되돌릴 수 없습니다.`)) return;
    setErr(null);
    try {
      await (kind === 'reply' ? remove : removeTax).mutateAsync(file);
    } catch (e) {
      setErr(e instanceof Error ? e.message : `${label}를 삭제하지 못했습니다.`);
    }
  };
  const anyUploading = upload.isPending || uploadTax.isPending;

  // ── PDF — 화면 밖에 결재 문서를 그려 두고 그대로 떠서 저장한다 ──
  const pdfHostRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<ApprovalDoc | null>(null);
  // 회사 직인 정보를 다 불러온 뒤에 뜬다 — 직인 자리에 '(직인)' 글자만 찍히지 않게
  const { isLoading: companyLoading } = useCompanyInfo();
  useEffect(() => {
    if (!pdfDoc || companyLoading) return;
    let cancelled = false;
    // 서식·사용자 정보가 그려질 시간을 준다(이미 캐시돼 있어 대개 바로 끝난다).
    const timer = setTimeout(async () => {
      const el = pdfHostRef.current?.querySelector<HTMLElement>('.approval-print');
      try {
        if (!el) throw new Error('no document');
        await exportElementToPdf(el, poPdfFileName(pdfDoc));
      } catch (e) {
        console.error('발주서 PDF 생성 실패:', e);
        if (!cancelled) setErr('PDF를 만들지 못했습니다. 잠시 후 다시 시도하세요.');
      } finally {
        if (!cancelled) setPdfDoc(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pdfDoc, companyLoading]);

  const poViewer: PoViewer = { userId: me.id, deptId: '', deptName: me.dept, isManager };

  return (
    <main className="flex-1 flex flex-col gap-4 rounded-xl border border-border bg-panel p-5 shadow-sm overflow-hidden">
      {/* 상단: 제목 + 검색 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold text-ink flex items-center gap-2">
            <PackageCheck size={18} className="text-teal" />
            <span>결재 보관함 / 발주서 보관함</span>
          </h1>
          <p className="text-[11px] text-ink3 mt-0.5">
            결재가 완료된 발주서가 자동으로 보관됩니다. 거래처 직인이 찍힌 회신본을 올려 함께 보관하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border-hi overflow-hidden text-[11px] font-bold">
            {REPLY_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setQuery({ ...query, reply: f.key })}
                className={`px-2.5 py-1.5 transition-colors ${query.reply === f.key ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={query.from}
            onChange={(e) => setQuery({ ...query, from: e.target.value })}
            aria-label="완료일 시작"
            className="h-8 rounded-lg border border-border-hi bg-panel px-2 text-[11px] outline-none focus:border-teal"
          />
          <span className="text-ink3">~</span>
          <input
            type="date"
            value={query.to}
            onChange={(e) => setQuery({ ...query, to: e.target.value })}
            aria-label="완료일 끝"
            className="h-8 rounded-lg border border-border-hi bg-panel px-2 text-[11px] outline-none focus:border-teal"
          />
          <div className="relative w-56">
            <input
              type="text"
              value={query.keyword}
              onChange={(e) => setQuery({ ...query, keyword: e.target.value })}
              placeholder="제목·문서번호·기안자 검색"
              className="h-8 w-full rounded-lg border border-border-hi bg-panel px-3 pr-7 text-[11px] outline-none focus:border-teal"
            />
            <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" />
          </div>
        </div>
      </div>

      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] font-semibold text-red-500 shrink-0">{err}</p>}

      {/* 목록 */}
      <div className="flex-1 overflow-auto rounded-lg border border-border bg-panel">
        <table className="w-full border-collapse text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-border bg-panel-alt/50 font-bold text-ink2">
              <th className="p-3">제목</th>
              <th className="p-3 w-28">완료일자</th>
              <th className="p-3 w-32 text-center">다운로드</th>
              <th className="p-3 w-80">회신 문서</th>
              <th className="p-3 w-80">매입 세금계산서</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="p-12 text-center text-ink3">불러오는 중…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-ink3">
                  {docs.length === 0 ? '결재가 완료된 발주서가 아직 없습니다.' : '검색 조건에 맞는 발주서가 없습니다.'}
                </td>
              </tr>
            )}
            {rows.map((d) => {
              const reply = replyByDoc.get(d.id);
              const canUpload = canUploadPoReply(d, poViewer);
              const tax = taxByDoc.get(d.id);
              const uploading = upload.isPending && uploadTarget?.kind === 'reply' && uploadTarget.doc.id === d.id;
              const uploadingTax = uploadTax.isPending && uploadTarget?.kind === 'tax' && uploadTarget.doc.id === d.id;
              const making = pdfDoc?.id === d.id;
              return (
                <tr
                  key={d.id}
                  className={`border-b border-border transition-colors ${reply ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/10' : 'hover:bg-panel-alt/30'}`}
                >
                  {/* 회신 문서가 있는 행은 왼쪽 띠로 한눈에 구분한다 */}
                  <td className={`p-3 min-w-0 border-l-[3px] ${reply ? 'border-l-emerald-500' : 'border-l-transparent'}`}>
                    <button onClick={() => setViewDoc(d)} className="flex items-center gap-1.5 text-left font-semibold text-ink hover:text-teal transition-colors">
                      <FileText size={13} className="shrink-0 text-ink3" />
                      <span className="truncate">{d.title}</span>
                    </button>
                    <div className="mt-0.5 pl-5 text-[10.5px] text-ink3">
                      <span className="font-mono">{d.docNo}</span>
                      {(d.drafterName || d.drafterDept) && <span> · {[d.drafterDept, d.drafterName].filter(Boolean).join(' ')}</span>}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-ink2">{completedDateOf(d) || '-'}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setPdfDoc(d)}
                      disabled={pdfDoc !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-hi px-2.5 py-1 text-[11px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50 transition-colors"
                    >
                      {making ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      PDF
                    </button>
                  </td>
                  <td className="p-3">
                    <PoFileCell
                      file={reply}
                      canUpload={canUpload}
                      uploading={uploading}
                      deleting={remove.isPending && remove.variables?.docId === d.id}
                      busy={anyUploading || remove.isPending}
                      doneLabel="회신 완료"
                      doneIcon={<FileCheck2 size={11} />}
                      emptyLabel="회신 대기"
                      emptyTone="teal"
                      onPick={() => pickFile(d, 'reply')}
                      onDropFile={(f) => void uploadPoFile(d, 'reply', f)}
                      onDownload={(f) => downloadPoFile('reply', f)}
                      onDelete={(f) => deletePoFile('reply', f)}
                    />
                  </td>
                  <td className="p-3">
                    <PoFileCell
                      file={tax}
                      canUpload={canUpload}
                      uploading={uploadingTax}
                      deleting={removeTax.isPending && removeTax.variables?.docId === d.id}
                      busy={anyUploading || removeTax.isPending}
                      doneLabel="발행 완료"
                      doneIcon={<Receipt size={11} />}
                      emptyLabel="미발행"
                      emptyTone="amber"
                      onPick={() => pickFile(d, 'tax')}
                      onDropFile={(f) => void uploadPoFile(d, 'tax', f)}
                      onDownload={(f) => downloadPoFile('tax', f)}
                      onDelete={(f) => deletePoFile('tax', f)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10.5px] text-ink3 shrink-0">총 {rows.length}건{rows.length !== docs.length && ` (전체 ${docs.length}건)`}</p>

      <input ref={fileRef} type="file" accept={REPLY_ACCEPT} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {/* 원문 보기 */}
      <Modal
        open={viewDoc !== null}
        onClose={() => setViewDoc(null)}
        title={viewDoc?.title}
        width={840}
        footer={
          viewDoc && (
            <button
              onClick={() => setPdfDoc(viewDoc)}
              disabled={pdfDoc !== null}
              className="inline-flex items-center gap-1 rounded-lg bg-teal px-3.5 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Download size={13} /> PDF 다운로드
            </button>
          )
        }
      >
        {viewDoc && (
          <div className="overflow-x-auto">
            <ApprovalDocumentView doc={viewDoc} currentUser={{ id: me.id, dept: me.dept }} external />
          </div>
        )}
      </Modal>

      {/* PDF 생성용 — 화면 밖에 A4 폭으로 그린다 */}
      {pdfDoc && (
        <div ref={pdfHostRef} aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000, width: 800 }}>
          <ApprovalDocumentView doc={pdfDoc} currentUser={{ id: me.id, dept: me.dept }} external />
        </div>
      )}
    </main>
  );
}

/**
 * 보관함 첨부 칸 — 회신 문서·매입 세금계산서가 같은 모양을 쓴다.
 * 파일이 있으면: [완료 표시] 올린 사람 · 날짜 / 파일 이름(내려받기) · 교체 · 삭제
 * 없으면: 올릴 수 있는 사람에겐 점선 올리기 칸(클릭·끌어다 놓기), 나머지에겐 상태 표시만.
 * 올릴 수 있는 사람은 칸 어디에 파일을 놓아도 올라간다(있으면 교체).
 */
function PoFileCell({
  file,
  canUpload,
  uploading,
  deleting,
  busy,
  doneLabel,
  doneIcon,
  emptyLabel,
  emptyTone,
  onPick,
  onDropFile,
  onDownload,
  onDelete,
}: {
  file: PoReply | undefined;
  canUpload: boolean;
  uploading: boolean;
  deleting: boolean;
  busy: boolean;
  doneLabel: string;
  doneIcon: ReactNode;
  emptyLabel: string;
  emptyTone: 'teal' | 'amber';
  onPick: () => void;
  onDropFile: (file: File) => void;
  onDownload: (file: PoReply) => void;
  onDelete: (file: PoReply) => void;
}) {
  const uploadIcon = uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />;
  const tone =
    emptyTone === 'teal'
      ? { box: 'border-teal/60 bg-teal/5 text-teal hover:bg-teal/10', badge: 'border-teal/60 text-teal', over: 'outline-teal/60 bg-teal/5' }
      : { box: 'border-amber-500/60 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10', badge: 'border-amber-500/60 text-amber-600', over: 'outline-amber-500/60 bg-amber-500/5' };

  // 끌어다 놓기 — 칸 안의 버튼 사이를 지날 때 꺼지지 않게, 칸 밖으로 나갈 때만 강조를 끈다
  const [over, setOver] = useState(false);
  const canDrop = canUpload && !busy;
  const dropProps = canDrop
    ? {
        onDragOver: (e: DragEvent<HTMLDivElement>) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setOver(true);
        },
        onDragLeave: (e: DragEvent<HTMLDivElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        },
        onDrop: (e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setOver(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped) onDropFile(dropped);
        },
      }
    : {};
  const overClass = over ? `rounded-lg outline-2 outline-dashed outline-offset-2 ${tone.over}` : '';

  if (!file) {
    return (
      <div {...dropProps} className={overClass}>
        {canUpload ? (
          <button
            onClick={onPick}
            disabled={busy}
            title="눌러서 파일을 고르거나, 파일을 끌어다 놓으세요"
            className={`flex w-full flex-col items-start gap-0.5 rounded-lg border border-dashed px-2.5 py-1.5 text-left disabled:opacity-50 transition-colors ${tone.box}`}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold">
              {uploadIcon}
              {emptyLabel}
            </span>
            <span className="text-[10px] opacity-75">클릭 또는 파일 끌어다 놓기</span>
          </button>
        ) : (
          <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${tone.badge}`}>{emptyLabel}</span>
        )}
      </div>
    );
  }
  return (
    <div {...dropProps} className={`flex flex-col gap-1.5 ${overClass}`}>
      <div className="flex items-center gap-1.5 text-[10.5px]">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 font-bold text-white">
          {doneIcon} {doneLabel}
        </span>
        <span className="truncate text-ink3">{[file.uploadedByName, file.uploadedAt.slice(0, 10)].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onDownload(file)}
          title={`${file.name} 내려받기`}
          className="inline-flex min-w-0 items-center gap-1 rounded-lg border border-teal/40 bg-panel px-2 py-1 text-[11px] font-bold text-teal hover:bg-teal-soft transition-colors"
        >
          <Download size={12} className="shrink-0" />
          <span className="truncate max-w-[150px]">{file.name}</span>
        </button>
        {canUpload && (
          <button
            onClick={onPick}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border-hi bg-panel px-2.5 py-1 text-[11px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50 transition-colors"
          >
            {uploadIcon}
            교체
          </button>
        )}
        {canUpload && (
          <button
            onClick={() => onDelete(file)}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border-hi bg-panel px-2.5 py-1 text-[11px] font-bold text-ink2 hover:border-red-500 hover:text-red-500 disabled:opacity-50 transition-colors"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
