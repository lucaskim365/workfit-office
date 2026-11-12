import { Fragment, useMemo, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import type { Attachment } from '@/domain/chatMessage/schema';
import { imageIdsOfRich, isSafeHref, parseRichBody, type RichNode } from '@/domain/chatMessage/richBody';
import { downloadAttachment, fmtSize } from '@/mobile/chatUtils';
import { ChatFileStatusText } from '@/mobile/ChatFileStatusText';
import { AutoLinkText } from '@/shared/ui/AutoLinkText';
import { FileKindIcon } from '@/features/chat/FileKindIcon';

/**
 * 서식 메시지(rich) 본문 — 저장된 문서 구조를 React 요소로만 그린다(HTML 주입 없음).
 * 본문 속 사진은 첨부 id 로 주소를 찾고, 본문에 없는 첨부(파일 등)는 아래 목록으로 보인다.
 */
export function RichMessageBody({
  body,
  attachments = [],
  mine,
  onOpenImage,
  onOpenFile,
}: {
  body: string | null | undefined;
  attachments?: Attachment[];
  mine: boolean;
  onOpenImage?: (att: Attachment, list: Attachment[]) => void;
  /** 파일 줄을 누르면 — 휴대폰은 앱 안에서 열기(PDF·엑셀·워드 보기, 그 밖은 다른 앱으로), 없으면(PC) 다운로드 단추만 */
  onOpenFile?: (att: Attachment) => void;
}) {
  const doc = useMemo(() => parseRichBody(body), [body]);
  const byId = useMemo(() => new Map(attachments.filter((a) => a.id).map((a) => [a.id!, a])), [attachments]);
  const inlineIds = useMemo(() => new Set(imageIdsOfRich(doc)), [doc]);
  /** 크게 보기에서 넘겨 볼 사진 — 본문 순서 */
  const imageList = useMemo(
    () => imageIdsOfRich(doc).map((id) => byId.get(id)).filter((a): a is Attachment => Boolean(a)),
    [doc, byId],
  );
  const extras = attachments.filter((a) => !(a.id && inlineIds.has(a.id)));

  const renderText = (n: RichNode, key: number): ReactNode => {
    // 주소는 글자 그대로 자동 링크(코드·예전 링크 꾸밈 안은 제외)
    const plain = !(n.marks ?? []).some((m) => m.type === 'code' || m.type === 'link');
    let el: ReactNode = plain ? <AutoLinkText text={n.text ?? ''} /> : n.text;
    for (const m of n.marks ?? []) {
      if (m.type === 'bold') el = <strong>{el}</strong>;
      else if (m.type === 'italic') el = <em>{el}</em>;
      else if (m.type === 'underline') el = <u>{el}</u>;
      else if (m.type === 'strike') el = <s>{el}</s>;
      else if (m.type === 'code') el = <code>{el}</code>;
      else if (m.type === 'link' && isSafeHref(m.attrs?.href)) {
        el = (
          <a href={String(m.attrs!.href)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {el}
          </a>
        );
      }
    }
    return <Fragment key={key}>{el}</Fragment>;
  };

  const render = (n: RichNode, key: number): ReactNode => {
    const kids = () => n.content?.map(render);
    switch (n.type) {
      case 'text':
        return renderText(n, key);
      case 'hardBreak':
        return <br key={key} />;
      case 'paragraph':
        return <p key={key}>{kids()}</p>;
      case 'heading': {
        const level = Number(n.attrs?.level);
        return level === 1 ? <h1 key={key}>{kids()}</h1> : level === 3 ? <h3 key={key}>{kids()}</h3> : <h2 key={key}>{kids()}</h2>;
      }
      case 'bulletList':
        return <ul key={key}>{kids()}</ul>;
      case 'orderedList':
        return <ol key={key} start={Number(n.attrs?.start) || 1}>{kids()}</ol>;
      case 'listItem':
        return <li key={key}>{kids()}</li>;
      case 'blockquote':
        return <blockquote key={key}>{kids()}</blockquote>;
      case 'codeBlock':
        return (
          <pre key={key}>
            <code>{(n.content ?? []).map((c) => c.text ?? '').join('')}</code>
          </pre>
        );
      case 'horizontalRule':
        return <hr key={key} />;
      case 'table':
        return (
          <div key={key} className="max-w-full overflow-x-auto">
            <table>
              <tbody>{kids()}</tbody>
            </table>
          </div>
        );
      case 'tableRow':
        return <tr key={key}>{kids()}</tr>;
      case 'tableHeader':
      case 'tableCell': {
        const Cell = n.type === 'tableHeader' ? 'th' : 'td';
        return (
          <Cell key={key} colSpan={Number(n.attrs?.colspan) || 1} rowSpan={Number(n.attrs?.rowspan) || 1}>
            {kids()}
          </Cell>
        );
      }
      case 'image': {
        const att = byId.get(String(n.attrs?.attachmentId ?? ''));
        if (!att) return <span key={key} className="text-ink3">[사진]</span>;
        return (
          <button
            key={key}
            type="button"
            title="크게 보기"
            onClick={(e) => {
              e.stopPropagation();
              onOpenImage?.(att, imageList);
            }}
            className="inline-block cursor-zoom-in align-bottom"
          >
            <img src={att.url} alt={att.name} loading="lazy" />
          </button>
        );
      }
      case 'mention':
        return (
          <span key={key} className="chat-mention">
            @{String(n.attrs?.label ?? '')}
          </span>
        );
      default:
        return <Fragment key={key}>{kids()}</Fragment>;
    }
  };

  return (
    <div className="chat-rich select-text">
      {doc.content?.map(render)}
      {extras.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {extras.map((att, idx) =>
            att.mime.startsWith('image/') ? (
              <button key={idx} type="button" onClick={() => onOpenImage?.(att, [att])} className="block cursor-zoom-in">
                <img src={att.url} alt={att.name} loading="lazy" />
              </button>
            ) : (
              <div
                key={idx}
                className={`flex items-center justify-between gap-2 rounded-xl p-2 ${
                  mine ? 'border border-[#91caff]/60 bg-white/80' : 'border border-black/5 bg-black/[0.03]'
                }`}
              >
                <div
                  className={`flex min-w-0 flex-1 items-center gap-2 ${onOpenFile ? 'cursor-pointer' : ''}`}
                  onClick={
                    onOpenFile
                      ? (e) => {
                          e.stopPropagation();
                          onOpenFile(att);
                        }
                      : undefined
                  }
                >
                  <FileKindIcon name={att.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate chat-text-[12px] font-semibold leading-tight text-ink" title={att.name}>{att.name}</div>
                    {onOpenFile ? (
                      <ChatFileStatusText url={att.url} name={att.name} size={att.size} className="mt-0.5 block chat-text-[10px] font-medium text-ink3" />
                    ) : (
                      <div className="mt-0.5 chat-text-[10px] font-medium text-ink3">{fmtSize(att.size)}</div>
                    )}
                  </div>
                </div>
                {/* 다운로드 단추는 PC만 — 휴대폰은 줄을 누르면 앱 안 보기 화면으로 열고 저장은 그 화면에서.
                    휴대폰에서 바로 내려받으면 다운로드 알림의 [열기]가 다른 앱으로 넘겨 대화방으로 못 돌아왔다 */}
                {!onOpenFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAttachment(att);
                    }}
                    title={`${att.name} 다운로드`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/5 text-ink2 hover:bg-black/10"
                  >
                    <Download size={13} />
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
