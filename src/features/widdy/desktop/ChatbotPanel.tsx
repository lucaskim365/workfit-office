import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useWiddyChat } from '@/features/widdy/useWiddyChat';
import { fileStorage } from '@/shared/lib/storage';
import type { WiddyAttachment } from '@/domain/widdyChat/schema';

/** Widdy 첨부 허용 확장자(server3 attach.py 추출 지원과 일치). */
const WIDDY_ACCEPT = '.txt,.pdf,.xlsx,.xls,.hwp,.jpg,.jpeg,.png,.bmp,.tif,.tiff,.gif';
/** 첨부 최대 크기 100MB. */
const WIDDY_MAX_BYTES = 100 * 1024 * 1024;

/** 응답 대기 중 타이핑 인디케이터(점 3개). */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="응답 작성 중">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal" />
    </span>
  );
}

export function ChatbotPanel() {
  const { user } = useAuth();
  const { messages, send, isSending } = useWiddyChat();
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 새 메시지/응답 상태 변화 시 하단으로 스크롤.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isSending]);

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ''; // 같은 파일 재선택 허용
    setAttachError('');
    if (!f) return;
    if (f.size > WIDDY_MAX_BYTES) {
      setAttachError('파일이 너무 큽니다 (최대 100MB).');
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (isSending || uploading) return;
    const text = input.trim();
    if (!text && !file) return;

    let attachment: WiddyAttachment | undefined;
    if (file) {
      try {
        setUploading(true);
        setAttachError('');
        const ext = file.name.split('.').pop() || 'bin';
        const rand = Math.random().toString(36).slice(2, 8);
        const key = `widdy-uploads/${user?.id ?? 'anon'}/${Date.now()}_${rand}.${ext}`;
        const url = await fileStorage.put(key, file, { contentType: file.type, filename: file.name });
        attachment = { key, name: file.name, size: file.size, url };
      } catch {
        setAttachError('첨부 업로드에 실패했습니다. 다시 시도해 주세요.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    send(text, attachment);
    setInput('');
    setFile(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((m) => {
          const me = m.role === 'user';
          const bubbleStyle = me
            ? { backgroundColor: '#bae0ff', color: '#1c2536' }
            : m.status === 'error'
              ? { backgroundColor: '#fdecea', color: '#b23b2e', borderColor: '#f0a89f' }
              : undefined;
          return (
            <div key={m.id} className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[82%] gap-2 ${me ? 'flex-row-reverse' : 'flex-row'}`}>
                {!me && <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-teal-soft text-[14px] text-teal">✦</span>}
                <div>
                  <div
                    style={bubbleStyle}
                    className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${me ? '' : 'border border-border bg-panel text-ink'}`}
                  >
                    {m.status === 'pending' ? (
                      <div className="flex flex-col gap-1.5">
                        <TypingDots />
                        {m.hint && <span className="text-[11px] leading-snug text-ink3">{m.hint}</span>}
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.attachmentName && (
                    <div className={`mt-1 flex ${me ? 'justify-end' : 'justify-start'}`}>
                      <span className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full bg-teal-soft px-2 py-[3px] text-[10px] font-medium text-teal">📎 {m.attachmentName}</span>
                    </div>
                  )}
                  {m.citations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.citations.map((c, i) => {
                        const name = c.source.split('/').pop() || c.source || c.docId;
                        const label = c.url ? `${name}#${c.chunkIdx}` : name;
                        return c.url ? (
                          <a key={i} href={c.url} target="_blank" rel="noreferrer" className="rounded-full bg-teal-soft px-2 py-[3px] text-[10px] font-medium text-teal hover:underline">📎 {label}</a>
                        ) : (
                          <span key={i} className="rounded-full bg-teal-soft px-2 py-[3px] text-[10px] font-medium text-teal">📎 {label}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-border bg-panel p-3">
        {/* 선택된 첨부 미리보기 칩 */}
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-teal-soft/40 px-2.5 py-1.5">
            <span className="text-[13px]">📎</span>
            <span className="flex-1 truncate text-[11px] text-ink">{file.name}</span>
            <span className="shrink-0 text-[10px] text-ink3">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
            <button type="button" onClick={() => setFile(null)} disabled={uploading} aria-label="첨부 제거" className="shrink-0 text-ink3 hover:text-ink disabled:opacity-40">✕</button>
          </div>
        )}
        {attachError && <div className="mb-2 px-1 text-[10.5px] text-[#b23b2e]">{attachError}</div>}
        <input ref={fileRef} type="file" accept={WIDDY_ACCEPT} className="hidden" onChange={pickFile} />
        <form
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          className="flex items-center gap-2 rounded-full border border-border-hi bg-panel py-1.5 pl-2 pr-1.5"
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isSending || uploading}
            aria-label="파일 첨부"
            title="파일 첨부 (최대 100MB)"
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[15px] text-ink3 hover:bg-teal-soft hover:text-teal disabled:opacity-50"
          >
            📎
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={file ? '첨부에 대해 질문하거나 바로 전송하세요…' : '메시지를 입력하세요…'}
            className="flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink3"
          />
          <button type="submit" disabled={isSending || uploading || (!input.trim() && !file)} aria-label="전송" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-teal text-[14px] text-white disabled:opacity-50">
            {uploading ? '…' : '↑'}
          </button>
        </form>
      </div>
    </div>
  );
}
