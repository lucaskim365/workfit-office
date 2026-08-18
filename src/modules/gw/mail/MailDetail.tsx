import type { MailAccount } from '@/domain/mailAccount/schema';
import { formatAddress, formatAddressList, mailErrorText } from '@/domain/mail/engine';
import type { MailAddress, MailDetail as MailDetailModel } from '@/domain/mail/schema';
import { Button } from '@/shared/ui/Button';
import { formatMailFullTime } from './mailDate';

interface Props {
  detail: MailDetailModel | undefined;
  account: MailAccount | undefined;
  loading: boolean;
  error: unknown;
  onBack: () => void;
  onReply: (mode: 'reply' | 'replyAll') => void;
  onForward: () => void;
  /** 목록 순서 기준 이웃 메일로 이동. 끝이면 넘기지 않아 버튼이 비활성된다. */
  onPrev?: () => void;
  onNext?: () => void;
  /** 보낸사람 주소를 눌러 그 주소로 새 메일을 쓴다. */
  onComposeTo?: (address: MailAddress) => void;
  /** 휴지통 이동. 이미 휴지통에 있으면 넘기지 않는다. */
  onTrash?: () => void;
  /** 휴지통에서 받은메일함으로 복원. 휴지통 폴더에서만 넘긴다. */
  onRestore?: () => void;
  trashing?: boolean;
  /** 안 읽음 되돌리기. */
  onMarkUnread?: () => void;
  markingUnread?: boolean;
  onDownload?: (index: number) => void;
  /** 이미지 첨부 미리보기. 내려받기와 같은 경로로 받아 화면에 띄운다. */
  onPreview?: (index: number) => void;
  /** 지금 받고 있는 첨부 순번. 없으면 null. */
  downloadingIndex?: number | null;
}

/** 첨부 크기 표기. 실제 크기를 숨기지 않되 자릿수는 줄인다. */
function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 메일 상세.
 *
 * 본문은 서버가 텍스트로 변환한 결과만 표시한다. HTML 원문과 외부 이미지는 추적·스크립트
 * 위험 때문에 클라이언트로 내리지 않는다. ([[jwheo/feat/mail/DESIGN.md]] §8 본문 안전성)
 */
export default function MailDetail({ detail, account, loading, error, onBack, onReply, onForward, onPrev, onNext, onComposeTo, onTrash, onRestore, trashing, onMarkUnread, markingUnread, onDownload, onPreview, downloadingIndex = null }: Props) {
  if (loading) {
    return <div className="grid h-full place-items-center text-[11px] text-ink3">메일을 불러오는 중…</div>;
  }

  if (error) {
    const guide = mailErrorText(error, '메일을 불러오지 못했습니다.');
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <div className="text-2xl">⚠️</div>
          <div className="mt-2 text-[12px] font-bold text-amber">메일을 열지 못했습니다.</div>
          <div className="mt-1 text-[10.5px] text-ink3">{guide}</div>
          <div className="mt-3">
            <Button size="sm" onClick={onBack}>목록으로</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <div className="text-2xl">✉️</div>
          <div className="mt-2 text-[11.5px] text-ink3">읽을 메일을 선택하세요.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="lg:hidden">
          <Button size="sm" onClick={onBack}>← 목록</Button>
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="primary" onClick={() => onReply('reply')}>답장</Button>
          <Button size="sm" onClick={() => onReply('replyAll')}>전체답장</Button>
          <Button size="sm" onClick={onForward}>전달</Button>
          {onMarkUnread && (
            <Button size="sm" disabled={markingUnread} onClick={onMarkUnread}>
              {markingUnread ? '표시 중…' : '안 읽음'}
            </Button>
          )}
          {onRestore && (
            <Button size="sm" disabled={trashing} onClick={onRestore}>
              {trashing ? '옮기는 중…' : '받은메일함으로'}
            </Button>
          )}
          {onTrash && (
            <Button size="sm" variant="danger" disabled={trashing} onClick={onTrash}>
              {trashing ? '옮기는 중…' : '휴지통'}
            </Button>
          )}
        </div>
        {(onPrev !== undefined || onNext !== undefined) && (
          <div className="flex items-center gap-1">
            <Button size="sm" disabled={!onPrev} onClick={onPrev} aria-label="이전 메일">‹ 이전</Button>
            <Button size="sm" disabled={!onNext} onClick={onNext} aria-label="다음 메일">다음 ›</Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-[14px] font-bold leading-snug text-ink">{detail.subject || '(제목 없음)'}</h2>

        <div className="mt-2.5 space-y-1 border-b border-border pb-3 text-[10.5px] text-ink2">
          <div>
            <span className="mr-2 text-ink3">보낸사람</span>
            {onComposeTo ? (
              <button
                type="button"
                onClick={() => onComposeTo(detail.from)}
                title="이 주소로 새 메일 쓰기"
                className="text-left hover:text-teal hover:underline"
              >
                {formatAddress(detail.from)}
              </button>
            ) : formatAddress(detail.from)}
          </div>
          <div><span className="mr-2 text-ink3">받는사람</span>{formatAddressList(detail.to) || '-'}</div>
          {detail.cc.length > 0 && <div><span className="mr-2 text-ink3">참조</span>{formatAddressList(detail.cc)}</div>}
          <div className="flex flex-wrap gap-x-3 text-[9.5px] text-ink3">
            <span>{formatMailFullTime(detail.receivedAt)}</span>
            {account && <span>{account.displayName} · {account.email}</span>}
          </div>
        </div>

        {detail.attachments.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-ink3/4 px-3 py-2.5">
            <div className="text-[9.5px] font-bold text-ink3">첨부 {detail.attachments.length}개</div>
            <ul className="mt-1.5 space-y-1">
              {detail.attachments.map((file) => (
                <li key={file.index} className="flex items-center gap-2">
                  <span className="shrink-0 text-[11px]">📎</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{file.filename}</span>
                  <span className="shrink-0 text-[9.5px] text-ink3">{formatBytes(file.size)}</span>
                  <span className="flex shrink-0 gap-1">
                    {onPreview && file.contentType.startsWith('image/') && (
                      <Button size="sm" disabled={downloadingIndex !== null} onClick={() => onPreview(file.index)}>
                        미리보기
                      </Button>
                    )}
                    <Button size="sm" disabled={downloadingIndex !== null} onClick={() => onDownload?.(file.index)}>
                      {downloadingIndex === file.index ? '받는 중…' : '내려받기'}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {detail.htmlBody ? (
          <>
            <div className="mt-3 rounded-lg border border-border bg-ink3/4 px-3 py-2 text-[10px] text-ink3">
              외부 이미지와 스크립트는 표시하지 않습니다.
            </div>
            <div
              className="mt-3 break-words text-[11.5px] leading-relaxed text-ink [&_a]:text-teal [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h1]:my-2 [&_h1]:text-[14px] [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-[13px] [&_h2]:font-bold [&_h3]:my-2 [&_h3]:text-[12px] [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-ink3/8 [&_pre]:p-2 [&_table]:my-2 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-ink3/6 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5"
              // 서버가 정화한 HTML만 내려온다(설계 §8). 원문 HTML은 이 경계를 넘지 않는다.
              dangerouslySetInnerHTML={{ __html: detail.htmlBody }}
            />
          </>
        ) : (
          <>
            {detail.convertedFromHtml && (
              <div className="mt-3 rounded-lg border border-amber/20 bg-amber-soft/25 px-3 py-2 text-[10px] text-amber">
                HTML 메일을 텍스트로 변환해 표시합니다. 외부 이미지는 추적 위험 때문에 불러오지 않습니다.
              </div>
            )}
            <p className="mt-3 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-ink">{detail.textBody}</p>
          </>
        )}
      </div>
    </div>
  );
}
