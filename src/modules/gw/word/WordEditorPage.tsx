import { useEffect, useRef, useState } from 'react';
import { WordEditor, downloadDocx, emptyWordDoc, exportDocx, importDocx, parseWordDoc, wordDocText, type WordNode } from '@/lib/word';

/*
  워드 편집기 확인용 새 탭(/word-editor) — 앱 상단바·메뉴 없이 편집기만.
  아직 쓰일 곳이 정해지지 않은 워드 모듈(src/lib/word)을 써 보는 화면: 새 문서·.docx 열기·.docx 저장·인쇄.
  쓰던 문서는 이 브라우저에 저절로 남는다(서버에는 저장하지 않음).
*/

const STORE_KEY = 'wordEditor.draft';
type Draft = { name: string; doc: WordNode };

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { name?: string; doc?: unknown };
    const doc = parseWordDoc(p.doc);
    return doc ? { name: p.name || '제목 없는 문서', doc } : null;
  } catch {
    return null;
  }
}

/** 처음 열었을 때 보이는 예시 — 제목·목록·표 */
function sampleDoc(): WordNode {
  const t = (text: string, marks?: WordNode['marks']): WordNode => (marks ? { type: 'text', text, marks } : { type: 'text', text });
  const p = (...content: WordNode[]): WordNode => ({ type: 'paragraph', content });
  const li = (text: string): WordNode => ({ type: 'listItem', content: [p(t(text))] });
  const cell = (text: string, header = false): WordNode => ({ type: header ? 'tableHeader' : 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(t(text))] });
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [t('주간 업무 보고')] },
      { type: 'paragraph', attrs: { textAlign: 'right' }, content: [t('작성: 기획팀 · 2026년 11월')] },
      { type: 'heading', attrs: { level: 2 }, content: [t('1. 이번 주 한 일')] },
      { type: 'bulletList', content: [li('전자결재 시트 서식 엑셀 내보내기'), li('발주서 인쇄 크기 바로잡기'), li('워드 편집 모듈 시작')] },
      { type: 'heading', attrs: { level: 2 }, content: [t('2. 진행 현황')] },
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('항목', true), cell('담당', true), cell('진행률', true)] },
          { type: 'tableRow', content: [cell('엑셀 내보내기'), cell('신지웅'), cell('100%')] },
          { type: 'tableRow', content: [cell('워드 모듈'), cell('신지웅'), cell('30%')] },
        ],
      },
      { type: 'heading', attrs: { level: 2 }, content: [t('3. 다음 주 계획')] },
      p(t('워드 모듈을 '), t('전자결재 본문', [{ type: 'bold' }]), t('·공문·회의록 중 어디에 붙일지 정합니다. '), t('일정은 협의 후 확정', [{ type: 'highlight', attrs: { color: '#fff59d' } }]), t('.')),
    ],
  };
}

export default function WordEditorPage() {
  const [draft, setDraft] = useState<Draft>(() => loadDraft() ?? { name: '주간 업무 보고(예시)', doc: sampleDoc() });
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** 브라우저에 남기기 실패(그림이 커서 저장소가 모자람) — 탭을 닫으면 사라진다고 알린다 */
  const [storeFailed, setStoreFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${draft.name || '문서'} — 워드`;
  }, [draft.name]);
  // 이 브라우저에 저절로 남기기(잠깐 멈췄을 때)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(draft));
        setStoreFailed(false);
      } catch {
        // 그림이 커서 저장소가 모자라면 남기지 못한다 — 옛 내용이 남아 다시 열 때 헷갈리지 않게 지우고 알린다
        try {
          localStorage.removeItem(STORE_KEY);
        } catch {
          /* 저장소를 아예 못 쓰는 창 */
        }
        setStoreFailed(true);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draft]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const newDoc = () => {
    if (wordDocText(draft.doc).trim() && !confirm('새 문서를 엽니다. 지금 내용은 사라집니다(필요하면 먼저 [저장]). 계속할까요?')) return;
    setDraft({ name: '제목 없는 문서', doc: emptyWordDoc() });
  };
  const open = async (file: File) => {
    setBusy(true);
    try {
      const res = await importDocx(new Uint8Array(await file.arrayBuffer()));
      setDraft({ name: file.name.replace(/\.docx$/i, ''), doc: res.doc });
      setNotice({ kind: 'ok', text: `'${file.name}'을(를) 열었습니다.${res.warnings.length ? ' ' + res.warnings.join(' ') : ''}` });
    } catch (e) {
      setNotice({ kind: 'err', text: `워드 파일을 열지 못했습니다: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      downloadDocx(await exportDocx(draft.doc, { title: draft.name }), draft.name || '문서');
      setNotice({ kind: 'ok', text: '워드 파일(.docx)로 저장했습니다(다운로드 폴더).' });
    } catch (e) {
      setNotice({ kind: 'err', text: `저장하지 못했습니다: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const btn = 'rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-teal hover:text-teal disabled:opacity-50';
  return (
    <div className="min-h-screen bg-[#e9ecf1] print:bg-white">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-2 print:hidden">
        <span className="rounded-md bg-[#1d4ed8] px-2 py-0.5 text-[12px] font-black text-white">W</span>
        <input
          className="w-72 rounded-md border border-transparent bg-transparent px-2 py-1 text-[14px] font-bold text-ink outline-none hover:border-border focus:border-teal"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          aria-label="문서 이름"
        />
        {storeFailed ? (
          <span className="text-[11px] font-bold text-rose-600">문서가 커서 브라우저에 남기지 못했습니다 — 탭을 닫기 전에 [저장(.docx)]으로 받아 두세요</span>
        ) : (
          <span className="text-[11px] text-ink3">이 브라우저에 저절로 남습니다(서버 저장 아님)</span>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" className={btn} onClick={newDoc}>
            새 문서
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
            열기(.docx)
          </button>
          <button type="button" className={btn} onClick={() => window.print()}>
            인쇄
          </button>
          <button type="button" className={`${btn} border-teal bg-teal text-white hover:text-white`} disabled={busy} onClick={save}>
            저장(.docx)
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void open(f);
          }}
        />
      </header>
      {notice && (
        <div className={`px-4 py-1.5 text-[12px] font-semibold print:hidden ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{notice.text}</div>
      )}
      {/* 인쇄 — 앱 인쇄 규칙(.approval-print 만 찍음)을 그대로 쓴다 */}
      <main className="approval-print px-4 py-5">
        <WordEditor value={draft.doc} onChange={(doc) => setDraft((d) => ({ ...d, doc }))} stickyTop={52} />
      </main>
    </div>
  );
}
