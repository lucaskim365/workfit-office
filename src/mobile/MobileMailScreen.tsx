import { useState, useMemo } from 'react';
import {
  Search,
  Paperclip,
  Star,
  Inbox,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useInbox, useUnseenCount } from '@/features/mail/useMailbox';
import { useMailAccounts } from '@/features/mail/useMailAccounts';
import type { MailSummary } from '@/domain/mail/schema';
import MobileCommonHeader from './MobileCommonHeader';

// 샘플 데모 메일 (서버 미연결 시 모바일 체험용)
const DEMO_MAILS: MailSummary[] = [
  {
    ref: { accountId: 'acc-1', folder: 'INBOX', uidValidity: '1', uid: '101' },
    subject: '[안내] 2026년 3분기 전사 성과공유회 및 워크숍 일정 안내',
    preview: '임직원 여러분 안녕하십니까. 2026년 3분기 전사 성과공유회 일정을 안내해 드립니다...',
    from: { name: '경영지원본부', email: 'admin@workfit.co.kr' },
    to: [{ name: '임직원 일동', email: 'all@workfit.co.kr' }],
    receivedAt: '2026-09-17T09:30:00.000Z',
    seen: false,
    answered: false,
    flagged: true,
    hasAttachment: true,
  },
  {
    ref: { accountId: 'acc-1', folder: 'INBOX', uidValidity: '1', uid: '102' },
    subject: '[회의록] AI 스마트공장 및 그룹웨어 고도화 2차 기획 검토 회의',
    preview: '오늘 진행된 스마트공장 고도화 회의 결과 및 산출물 내역을 공유드립니다...',
    from: { name: '기술연구소 김팀장', email: 'tech_lead@workfit.co.kr' },
    to: [{ name: '개발팀', email: 'dev@workfit.co.kr' }],
    receivedAt: '2026-09-16T15:20:00.000Z',
    seen: true,
    answered: false,
    flagged: false,
    hasAttachment: true,
  },
  {
    ref: { accountId: 'acc-1', folder: 'INBOX', uidValidity: '1', uid: '103' },
    subject: '정기 보안점검 완료 및 사내 패스워드 변경 권고',
    preview: '사내 정보보호 강화를 위해 정기 패스워드 변경을 권고드리오니 안내에 따라 변경해 주시기 바랍니다.',
    from: { name: '정보보안팀', email: 'security@workfit.co.kr' },
    to: [{ name: '임직원 일동', email: 'all@workfit.co.kr' }],
    receivedAt: '2026-09-15T11:00:00.000Z',
    seen: true,
    answered: false,
    flagged: false,
    hasAttachment: false,
  },
];

export default function MobileMailScreen() {
  const { user } = useAuth();
  const [selectedFolder, setSelectedFolder] = useState<'ALL' | 'UNSEEN' | 'INBOX' | 'SENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMail, setSelectedMail] = useState<MailSummary | null>(null);

  const accountsQuery = useMailAccounts(user);
  const accounts = accountsQuery.data ?? [];
  const selectedAccountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  // 실제 메일 백엔드 쿼리
  const inboxQuery = useInbox(
    user,
    selectedAccountIds,
    'INBOX',
    { text: searchQuery, unseenOnly: selectedFolder === 'UNSEEN' },
    30
  );

  const realMails = inboxQuery.data?.mails ?? [];
  const unseenCountQuery = useUnseenCount(user);
  const realUnseenCount = Object.values(unseenCountQuery.data ?? {}).reduce((s, n) => s + n, 0);

  // 백엔드 연결 여부에 따라 실제 또는 데모 메일 노출
  const displayMails = useMemo(() => {
    let list = realMails.length > 0 ? realMails : DEMO_MAILS;

    if (selectedFolder === 'UNSEEN') {
      list = list.filter((m) => !m.seen);
    }

    const kw = searchQuery.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(kw) ||
          (m.from.name && m.from.name.toLowerCase().includes(kw)) ||
          m.from.email.toLowerCase().includes(kw)
      );
    }

    return list;
  }, [realMails, selectedFolder, searchQuery]);

  const unseenTotal = realMails.length > 0 ? realUnseenCount : DEMO_MAILS.filter((m) => !m.seen).length;

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader title="메일" subtitle={`안 읽은 메일 ${unseenTotal}통`} />

      {/* 1. 폴더/상태 탭 */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white/70 border-b border-border/50 shrink-0 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSelectedFolder('ALL')}
          className={`rounded-xl px-3 py-1 text-[11px] font-bold transition-all whitespace-nowrap ${
            selectedFolder === 'ALL'
              ? 'bg-teal text-white shadow-xs'
              : 'bg-white text-ink3 hover:bg-panel-alt border border-border/80'
          }`}
        >
          전체 받은메일
        </button>
        <button
          type="button"
          onClick={() => setSelectedFolder('UNSEEN')}
          className={`rounded-xl px-3 py-1 text-[11px] font-bold transition-all whitespace-nowrap ${
            selectedFolder === 'UNSEEN'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-blue-600 hover:bg-panel-alt border border-blue-200'
          }`}
        >
          안 읽은 메일 ({unseenTotal})
        </button>
      </div>

      {/* 2. 검색창 */}
      <div className="p-3 bg-white/40 border-b border-border/40">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
          <input
            type="text"
            placeholder="보낸사람, 제목 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-ink outline-none focus:border-teal transition-all"
          />
        </div>
      </div>

      {/* 3. 메일 목록 */}
      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-2">
        {displayMails.length === 0 ? (
          <div className="py-16 text-center text-ink3 border border-dashed border-border/80 rounded-2xl bg-white/60">
            <Inbox size={28} className="mx-auto mb-1.5 text-ink3/40" />
            <p className="text-[12px] font-bold text-ink">메일이 없습니다.</p>
            <p className="text-[10.5px] text-ink3 mt-0.5">수신된 메일이 없거나 검색 결과가 없습니다.</p>
          </div>
        ) : (
          displayMails.map((mail) => (
            <div
              key={`${mail.ref.accountId}-${mail.ref.uid}`}
              onClick={() => setSelectedMail(mail)}
              className={`rounded-2xl border p-3.5 shadow-2xs transition-all cursor-pointer active:scale-98 space-y-1.5 ${
                !mail.seen
                  ? 'border-blue-500/30 bg-blue-50/25 hover:border-blue-500/50'
                  : 'border-border/80 bg-white hover:border-teal/50'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {!mail.seen && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600 shadow-2xs" />
                  )}
                  <span className={`text-[12.5px] truncate ${!mail.seen ? 'font-black text-ink' : 'font-semibold text-ink2'}`}>
                    {mail.from.name || mail.from.email}
                  </span>
                </div>

                <span className="text-[10.5px] text-ink3 font-mono shrink-0">
                  {mail.receivedAt.slice(5, 10)}
                </span>
              </div>

              <h4 className={`text-[13px] leading-snug line-clamp-1 ${!mail.seen ? 'font-bold text-ink' : 'text-ink2'}`}>
                {mail.subject}
              </h4>

              <div className="flex items-center justify-between text-[11px] text-ink3 pt-1 border-t border-border/50">
                <span className="truncate max-w-[220px] text-[10.5px] text-ink3 font-mono">
                  {mail.preview || mail.ref.accountId}
                </span>

                <div className="flex items-center gap-2">
                  {mail.hasAttachment && (
                    <Paperclip size={12} className="text-ink3" />
                  )}
                  {mail.flagged && (
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. 메일 본문 상세 모달 */}
      {selectedMail && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in slide-in-from-bottom duration-200">
          <header className="flex items-center justify-between border-b border-border px-3 py-3 shrink-0" style={{ background: '#101830', color: '#fff' }}>
            <span className="text-[13px] font-bold truncate">메일 읽기</span>
            <button
              type="button"
              onClick={() => setSelectedMail(null)}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5" style={{ background: '#f2f8fc' }}>
            <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs space-y-3">
              <div className="space-y-1.5 border-b border-border/60 pb-3">
                <h2 className="text-[16px] font-black text-ink leading-snug">
                  {selectedMail.subject}
                </h2>

                <div className="space-y-1 text-[11px] text-ink3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">
                      보낸사람: {selectedMail.from.name || selectedMail.from.email}
                    </span>
                    <span className="font-mono">{selectedMail.receivedAt.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <div>
                    <span>받는사람: {selectedMail.to.map((t) => t.name || t.email).join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* 본문 미리보기 */}
              <div className="text-[13px] text-ink2 leading-relaxed whitespace-pre-line py-3 min-h-[160px]">
                {selectedMail.preview
                  ? `${selectedMail.preview}\n\n[모바일 미리보기 모드]`
                  : `안녕하세요,\n\n${selectedMail.subject} 건에 대해 공유드립니다.\n\n해당 안건과 관련하여 궁금하신 사항이나 추가 문의사항이 있으시면 언제든지 회신 부탁드립니다.\n\n감사합니다.`}
              </div>

              {selectedMail.hasAttachment && (
                <div className="rounded-xl border border-border bg-panel-alt/50 p-3 text-[11.5px] space-y-1.5">
                  <div className="flex items-center gap-1 font-bold text-ink">
                    <Paperclip size={13} className="text-teal" />
                    <span>첨부파일</span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-border/60 flex items-center justify-between">
                    <span className="font-medium text-ink">참조문서_첨부파일.pdf</span>
                    <span className="text-ink3 text-[10px]">1.2 MB</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
