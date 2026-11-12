/**
 * 파일 종류 아이콘 — 확장자 글자를 색 바탕에 얹어 PDF·워드·엑셀 등을 한눈에 구분한다(메신저 웹·PWA 말풍선·파일함 공용).
 * 예전에는 PDF·워드·한글이 모두 같은 파란 문서 모양이었다.
 */
const KINDS: Array<{ exts: string[]; label: string; bg: string }> = [
  { exts: ['pdf'], label: 'PDF', bg: '#e5484d' },
  { exts: ['doc', 'docx', 'rtf'], label: 'DOC', bg: '#2b6cd8' },
  { exts: ['xls', 'xlsx', 'xlsm', 'csv'], label: 'XLS', bg: '#1f9254' },
  { exts: ['ppt', 'pptx'], label: 'PPT', bg: '#d9622b' },
  { exts: ['hwp', 'hwpx'], label: 'HWP', bg: '#1aa3b8' },
  { exts: ['zip', 'rar', '7z', 'tar', 'gz'], label: 'ZIP', bg: '#b7791f' },
  { exts: ['txt', 'md', 'log'], label: 'TXT', bg: '#6b7280' },
];

export function fileKindOf(name: string): { label: string; bg: string } {
  const ext = name.trim().split('.').pop()?.toLowerCase() ?? '';
  const hit = KINDS.find((k) => k.exts.includes(ext));
  if (hit) return hit;
  return { label: (ext && ext.length <= 4 ? ext : 'FILE').toUpperCase(), bg: '#8a94a6' };
}

export function FileKindIcon({ name, size = 30 }: { name: string; size?: number }) {
  const { label, bg } = fileKindOf(name);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-md font-black leading-none tracking-tight text-white"
      style={{ width: size, height: size, background: bg, fontSize: Math.max(8, Math.round(size * (label.length > 3 ? 0.27 : 0.32))) }}
    >
      {label}
    </span>
  );
}
