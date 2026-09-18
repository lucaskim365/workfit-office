import { useState, useMemo } from 'react';
import {
  Search,
  Paperclip,
  Star,
  Inbox,
  Send,
  Trash2,
  X,
  Mail,
  RefreshCw,
  Plus,
  AlertCircle,
  FileText,
  Download,
  Reply,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import {
  isMailBackendReady,
  isMailSampleData,
} from '@/data/mail/mail.client';
import { useMailAccounts } from '@/features/mail/useMailAccounts';
import {
  useInbox,
  useUnseenCount,
  useMailDetail,
  useMarkMailRead,
  useMarkFlagged,
  useMoveMail,
  useDownloadAttachment,
  saveAttachment,
  useSendMail,
} from '@/features/mail/useMailbox';
import type {
  MailFolder,
  MailRef,
  MailSummary,
  SendMailInput,
} from '@/domain/mail/schema';
import MobileCommonHeader from './MobileCommonHeader';

type MobileFolderTab = 'INBOX' | 'UNSEEN' | 'FLAGGED' | 'SENT' | 'TRASH';

export default function MobileMailScreen() {
  const { user } = useAuth();

  // 1. 메일 백엔드 준비 상태 검사 (가짜 목업 절대 미표출)
  if (!isMailBackendReady && !isMailSampleData) {
    return (
      <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
        <MobileCommonHeader title="메일" subtitle="서버 연결 필요" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-sm border border-border text-3xl mb-4">
            ✉️
          </div>
          <h2 className="text-[15px] font-extrabold text-ink">메일 서버에 연결되어 있지 않습니다</h2>
          <p className="mt-2 max-w-[280px] text-[11.5px] leading-relaxed text-ink3">
            메일을 조회하고 발송하려면 메일 서버(IMAP/SMTP) 연결이 필요합니다. 웹 버전 설정 또는 시스템 관리자에게 문의해 주세요.
          </p>
          <div className="mt-6 rounded-xl border border-teal/20 bg-teal-soft/20 px-4 py-3 text-left max-w-[320px]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal">
              <AlertCircle size={13} />
              <span>안내</span>
            </div>
            <p className="mt-1 text-[10.5px] text-ink2 leading-relaxed">
              사용자 혼선을 방지하기 위해 가짜 샘플 메일은 표출되지 않습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <ConnectedMobileMailScreen user={user} />;
}

/** ── 백엔드가 연결된 실제 메일 화면 ── */
function ConnectedMobileMailScreen({ user }: { user: any }) {
  const [folderTab, setFolderTab] = useState<MobileFolderTab>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMailRef, setSelectedMailRef] = useState<MailRef | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string } | null>(null);

  // 계정 쿼리
  const accountsQuery = useMailAccounts(user);
  const accounts = accountsQuery.data ?? [];
  const selectedAccountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  // 폴더 매핑
  const imapFolder: MailFolder =
    folderTab === 'SENT' ? 'SENT' : folderTab === 'TRASH' ? 'TRASH' : 'INBOX';

  // 실제 메일 쿼리
  const inboxQuery = useInbox(
    user,
    selectedAccountIds,
    imapFolder,
    {
      text: searchQuery,
      unseenOnly: folderTab === 'UNSEEN',
      flaggedOnly: folderTab === 'FLAGGED',
    },
    50,
  );

  const mails = inboxQuery.data?.mails ?? [];
  const isLoading = inboxQuery.isLoading;

  const unseenQuery = useUnseenCount(user);
  const unseenTotal = Object.values(unseenQuery.data ?? {}).reduce((s, n) => s + n, 0);

  const markFlagged = useMarkFlagged();

  const handleToggleFlag = (e: React.MouseEvent, mail: MailSummary) => {
    e.stopPropagation();
    if (!user) return;
    markFlagged.mutate({
      actor: user,
      refs: [mail.ref],
      flagged: !mail.flagged,
    });
  };

  // 계정이 없는 경우
  if (!accountsQuery.isLoading && accounts.length === 0) {
    return (
      <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
        <MobileCommonHeader title="메일" subtitle="계정 미등록" />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-sm border border-border text-3xl mb-4">
            📬
          </div>
          <h2 className="text-[15px] font-extrabold text-ink">등록된 메일 계정이 없습니다</h2>
          <p className="mt-2 max-w-[280px] text-[11.5px] leading-relaxed text-ink3">
            그룹웨어 웹 버전의 [메일 &gt; 계정 설정] 메뉴에서 메일 계정(사내 메일, 네이버, 지메일 등)을 먼저 등록해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col select-none overflow-hidden relative" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader
        title="메일"
        subtitle={unseenTotal > 0 ? `안 읽은 메일 ${unseenTotal}통` : '모든 메일 확인됨'}
      />

      {/* 1. 폴더 칩 네비게이션 */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-border/70 shrink-0 overflow-x-auto no-scrollbar shadow-2xs">
        <button
          type="button"
          onClick={() => setFolderTab('INBOX')}
          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
            folderTab === 'INBOX'
              ? 'bg-teal text-white shadow-xs'
              : 'bg-slate-100 text-ink3 hover:bg-slate-200'
          }`}
        >
          <Inbox size={12} />
          <span>받은메일함</span>
        </button>

        <button
          type="button"
          onClick={() => setFolderTab('UNSEEN')}
          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
            folderTab === 'UNSEEN'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 text-blue-600 hover:bg-slate-200'
          }`}
        >
          <span>안 읽음</span>
          {unseenTotal > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9.5px] font-mono">
              {unseenTotal}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFolderTab('FLAGGED')}
          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
            folderTab === 'FLAGGED'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-100 text-amber-700 hover:bg-slate-200'
          }`}
        >
          <Star size={12} className={folderTab === 'FLAGGED' ? 'fill-white' : ''} />
          <span>중요 메일</span>
        </button>

        <button
          type="button"
          onClick={() => setFolderTab('SENT')}
          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
            folderTab === 'SENT'
              ? 'bg-teal text-white shadow-xs'
              : 'bg-slate-100 text-ink3 hover:bg-slate-200'
          }`}
        >
          <Send size={12} />
          <span>보낸메일함</span>
        </button>

        <button
          type="button"
          onClick={() => setFolderTab('TRASH')}
          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
            folderTab === 'TRASH'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-slate-100 text-ink3 hover:bg-slate-200'
          }`}
        >
          <Trash2 size={12} />
          <span>휴지통</span>
        </button>
      </div>

      {/* 2. 검색 & 새로고침 바 */}
      <div className="flex items-center gap-2 p-2.5 bg-slate-50/80 border-b border-border/50">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="보낸사람, 제목 실시간 검색…"
            className="h-8.5 w-full rounded-xl border border-border bg-white px-3 pl-8 text-[11.5px] text-ink outline-none focus:border-teal placeholder:text-ink3 shadow-2xs"
          />
          <Search size={13} className="absolute left-2.5 top-2.5 text-ink3 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={() => inboxQuery.refetch()}
          className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-white border border-border text-ink3 hover:text-teal shadow-2xs shrink-0 active:scale-95 transition-all"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin text-teal' : ''} />
        </button>
      </div>

      {/* 3. 실제 메일 목록 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && mails.length === 0 ? (
          <div className="py-20 text-center text-[12px] text-ink3">메일을 불러오는 중입니다…</div>
        ) : mails.length === 0 ? (
          <div className="py-20 text-center text-ink3 border border-dashed border-border/80 rounded-2xl bg-white/70">
            <Inbox size={28} className="mx-auto mb-1.5 text-ink3/40" />
            <p className="text-[12.5px] font-bold text-ink">메일이 없습니다.</p>
            <p className="text-[10.5px] text-ink3 mt-0.5">새로운 메일이 도착하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          mails.map((mail) => {
            const dateStr = mail.receivedAt ? mail.receivedAt.slice(0, 10) : '';
            return (
              <div
                key={`${mail.ref.accountId}-${mail.ref.uid}`}
                onClick={() => setSelectedMailRef(mail.ref)}
                className={`flex items-start gap-2.5 rounded-2xl border p-3 shadow-2xs cursor-pointer active:scale-98 transition-all ${
                  mail.seen
                    ? 'border-border/70 bg-white/90'
                    : 'border-blue-200 bg-blue-50/40 shadow-xs'
                }`}
              >
                {/* 중요 별표 버튼 */}
                <button
                  type="button"
                  onClick={(e) => handleToggleFlag(e, mail)}
                  className="mt-0.5 text-slate-300 hover:text-amber-500 transition-colors shrink-0 p-0.5"
                >
                  <Star
                    size={15}
                    className={mail.flagged ? 'fill-amber-400 text-amber-500' : ''}
                  />
                </button>

                {/* 메일 내용 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`truncate text-[12px] ${
                        mail.seen ? 'text-ink2 font-medium' : 'text-blue-900 font-extrabold'
                      }`}
                    >
                      {mail.from.name || mail.from.email}
                    </span>
                    <span className="text-[10px] text-ink3 font-mono shrink-0">{dateStr}</span>
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`truncate text-[12.5px] ${
                        mail.seen ? 'text-ink font-semibold' : 'text-slate-900 font-black'
                      }`}
                    >
                      {mail.subject || '(제목 없음)'}
                    </span>
                    {mail.hasAttachment && (
                      <Paperclip size={11} className="text-teal shrink-0" />
                    )}
                  </div>

                  {mail.preview && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-ink3">
                      {mail.preview}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. 새 메일 작성 플로팅 버튼 */}
      <button
        type="button"
        onClick={() => {
          setReplyTo(null);
          setIsComposerOpen(true);
        }}
        className="fixed bottom-6 right-6 grid h-12 w-12 place-items-center rounded-full bg-teal text-white shadow-lg hover:bg-teal/90 active:scale-95 transition-transform z-30"
      >
        <Plus size={22} />
      </button>

      {/* 5. 메일 상세 읽기 모달 시트 */}
      {selectedMailRef && (
        <MobileMailDetailModal
          user={user}
          mailRef={selectedMailRef}
          onClose={() => setSelectedMailRef(null)}
          onReply={(to, subject) => {
            setSelectedMailRef(null);
            setReplyTo({ to, subject });
            setIsComposerOpen(true);
          }}
        />
      )}

      {/* 6. 메일 작성 모달 시트 */}
      {isComposerOpen && (
        <MobileMailComposerModal
          user={user}
          accounts={accounts}
          replyTo={replyTo}
          onClose={() => {
            setIsComposerOpen(false);
            setReplyTo(null);
          }}
        />
      )}
    </div>
  );
}

/** ── 메일 상세 읽기 모달 ── */
function MobileMailDetailModal({
  user,
  mailRef,
  onClose,
  onReply,
}: {
  user: any;
  mailRef: MailRef;
  onClose: () => void;
  onReply: (to: string, subject: string) => void;
}) {
  const detailQuery = useMailDetail(user, mailRef);
  const detail = detailQuery.data;

  const markRead = useMarkMailRead();
  const moveMail = useMoveMail();
  const downloadAttachment = useDownloadAttachment();

  // 열람 시 자동 읽음 처리
  useMemo(() => {
    if (user && mailRef && detail && !detail.seen) {
      markRead.mutate({ actor: user, refs: [mailRef], seen: true });
    }
  }, [user, mailRef, detail, markRead]);

  const handleDelete = async () => {
    if (!user || !confirm('이 메일을 휴지통으로 이동하시겠습니까?')) return;
    await moveMail.mutateAsync({ actor: user, refs: [mailRef], to: 'TRASH' });
    onClose();
  };

  const handleDownload = async (index: number) => {
    if (!user) return;
    try {
      const res = await downloadAttachment.mutateAsync({ actor: user, ref: mailRef, index });
      saveAttachment(res);
    } catch {
      alert('첨부파일 다운로드에 실패했습니다.');
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-3xl border-t border-border bg-white shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* 상단 툴바 */}
        <div className="flex items-center justify-between border-b border-border/60 p-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-soft/40 text-teal">
              <Mail size={14} />
            </span>
            <span className="text-[12.5px] font-extrabold text-ink">메일 상세</span>
          </div>

          <div className="flex items-center gap-1.5">
            {detail && (
              <button
                type="button"
                onClick={() => onReply(detail.from.email, `Re: ${detail.subject}`)}
                className="flex items-center gap-1 rounded-lg bg-teal-soft/40 px-2.5 py-1 text-[11px] font-bold text-teal"
              >
                <Reply size={12} />
                <span>답장</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-ink3 hover:bg-slate-100 hover:text-red-500 transition-colors"
            >
              <Trash2 size={15} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink3 hover:bg-slate-100 transition-colors"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 본문 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {detailQuery.isLoading ? (
            <div className="py-24 text-center text-[12px] text-ink3">본문을 불러오는 중입니다…</div>
          ) : !detail ? (
            <div className="py-24 text-center text-[12px] text-ink3">메일 정보를 불러올 수 없습니다.</div>
          ) : (
            <>
              {/* 제목 */}
              <h2 className="text-[16px] font-black text-ink leading-snug">
                {detail.subject || '(제목 없음)'}
              </h2>

              {/* 보낸사람 / 받는사람 메타 */}
              <div className="rounded-xl bg-slate-50 p-3 text-[11.5px] space-y-1 border border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-ink3 font-medium">보낸사람:</span>
                  <span className="font-bold text-ink truncate">
                    {detail.from.name} &lt;{detail.from.email}&gt;
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink3 font-medium">받는사람:</span>
                  <span className="text-ink truncate">
                    {detail.to.map((t) => `${t.name || ''} <${t.email}>`).join(', ')}
                  </span>
                </div>
                {detail.receivedAt && (
                  <div className="flex items-center justify-between text-[10.5px] text-ink3 font-mono">
                    <span>수신일시:</span>
                    <span>{detail.receivedAt.replace('T', ' ').slice(0, 19)}</span>
                  </div>
                )}
              </div>

              {/* 첨부파일 목록 */}
              {detail.attachments && detail.attachments.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-teal/20 bg-teal-soft/10 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal">
                    <Paperclip size={12} />
                    <span>첨부파일 ({detail.attachments.length}개)</span>
                  </div>
                  <div className="space-y-1">
                    {detail.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-white p-2 text-[11px] border border-border/50"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText size={13} className="text-ink3 shrink-0" />
                          <span className="font-medium text-ink truncate">{att.filename}</span>
                          <span className="text-[9.5px] text-ink3 font-mono">
                            ({(att.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownload(idx)}
                          className="flex items-center gap-1 rounded bg-teal px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs"
                        >
                          <Download size={10} />
                          <span>다운로드</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 본문 (HTML 또는 텍스트) */}
              <div className="pt-2 text-[12.5px] leading-relaxed text-slate-800 break-words">
                {detail.htmlBody ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: detail.htmlBody }}
                    className="prose prose-sm max-w-none text-[12.5px]"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">
                    {detail.textBody || '(내용이 없습니다.)'}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** ── 모바일 메일 작성 모달 ── */
function MobileMailComposerModal({
  user,
  accounts,
  replyTo,
  onClose,
}: {
  user: any;
  accounts: any[];
  replyTo?: { to: string; subject: string } | null;
  onClose: () => void;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [toInput, setToInput] = useState(replyTo?.to || '');
  const [subject, setSubject] = useState(replyTo?.subject || '');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendMail = useSendMail();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toInput.trim()) {
      alert('받는 사람 이메일을 입력해주세요.');
      return;
    }
    if (!subject.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: SendMailInput = {
        accountId: selectedAccountId,
        to: toInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((email) => ({ name: '', email })),
        cc: [],
        bcc: [],
        subject: subject.trim(),
        textBody: body.trim(),
        origin: null,
        attachments: [],
      };

      await sendMail.mutateAsync({ actor: user, input });
      alert('메일이 성공적으로 발송되었습니다.');
      onClose();
    } catch (err) {
      console.error('메일 발송 실패:', err);
      alert('메일 발송에 실패했습니다. 메일 서버 설정을 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-3xl border-t border-border bg-white shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between border-b border-border/60 p-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-soft/40 text-teal">
              <Send size={14} />
            </span>
            <span className="text-[13px] font-extrabold text-ink">메일 쓰기</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-ink3 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-4 space-y-3 text-[12px]">
          {/* 계정 선택 */}
          {accounts.length > 1 && (
            <div>
              <label className="text-[11px] font-bold text-ink3 block mb-1">보내는 계정</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full rounded-xl border border-border bg-white p-2 text-[12px] text-ink outline-none focus:border-teal"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.senderName ? `${a.senderName} (${a.email})` : a.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 받는 사람 */}
          <div>
            <label className="text-[11px] font-bold text-ink3 block mb-1">받는 사람</label>
            <input
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="예: user@company.com (쉼표로 구분)"
              className="w-full rounded-xl border border-border bg-white p-2.5 text-[12px] text-ink outline-none focus:border-teal"
            />
          </div>

          {/* 제목 */}
          <div>
            <label className="text-[11px] font-bold text-ink3 block mb-1">제목</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="메일 제목을 입력하세요"
              className="w-full rounded-xl border border-border bg-white p-2.5 text-[12px] text-ink font-bold outline-none focus:border-teal"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="text-[11px] font-bold text-ink3 block mb-1">내용</label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="메일 내용을 작성하세요…"
              className="w-full rounded-xl border border-border bg-white p-3 text-[12px] text-ink leading-relaxed outline-none focus:border-teal resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-teal py-3 text-[13px] font-bold text-white shadow-md hover:bg-teal/90 active:scale-98 transition-all disabled:opacity-50"
            >
              {isSubmitting ? '발송 중…' : '메일 보내기'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
