import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { PhotoSlot } from '@/shared/ui/PhotoSlot';
import { DetailField } from '@/shared/ui/DetailField';

interface DefectItem {
  code: string;
  name: string;
  proc: string;
  grade: '심' | '중' | '경';
  use: '사용' | '미사용';
  remark: string;
}

const DEFECTS: DefectItem[] = [
  { code: 'LB-1001', name: 'Scratch (스크래치)', proc: 'CMP', grade: '중', use: '사용', remark: '웨이퍼 표면 긁힘. 0.5㎛ 이상 길이 시 불합격 처리. CMP 패드 교체 주기 점검 필요.' },
  { code: 'LB-1002', name: 'Particle (파티클)', proc: 'Clean', grade: '경', use: '사용', remark: '표면 이물 부착. 세정 공정 재실시 후 재검사.' },
  { code: 'A-2210', name: 'Misalign (정렬불량)', proc: 'Photo', grade: '중', use: '사용', remark: '노광 정렬 오차. 오버레이 측정값 스펙 초과 시 발생.' },
  { code: 'A-0521', name: 'Crack (크랙)', proc: 'Etch', grade: '심', use: '사용', remark: '미세 균열. 기능 치명 결함으로 즉시 폐기 처리.' },
  { code: 'C-3300', name: 'Stain (얼룩)', proc: 'Depo', grade: '경', use: '미사용', remark: '증착 표면 얼룩. 외관 경미 결함.' },
  { code: 'F-7100', name: 'Open/Short (단선)', proc: 'Test', grade: '심', use: '사용', remark: '회로 단선/단락. 기능 검사 NG.' },
];

const GRADE_TONE: Record<DefectItem['grade'], Tone> = { 심: 'err', 중: 'warn', 경: 'info' };
const PROC_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...[...new Set(DEFECTS.map((d) => d.proc))].map((p) => ({ value: p, label: p }))];
const GRADE_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...(['심', '중', '경'] as const).map((g) => ({ value: g, label: g }))];
const USE_OPTIONS: Option[] = [{ value: '', label: '전체' }, { value: '사용', label: '사용' }, { value: '미사용', label: '미사용' }];
const GALLERY = ['예시 1', '예시 2', '확대', '비교'];
const DOCS: Array<{ name: string; type: 'PDF' | 'DOC' | 'ZIP'; date: string }> = [
  { name: '불량기준서_LB-1001_v2.pdf', type: 'PDF', date: '2026-05-10' },
  { name: '판정가이드_스크래치.docx', type: 'DOC', date: '2026-05-08' },
  { name: '검사사진_샘플.zip', type: 'ZIP', date: '2026-04-30' },
];
const DOC_TONE: Record<string, Tone> = { PDF: 'err', DOC: 'info', ZIP: 'mute' };

/** 불량항목정보 — 필터 + 마스터-디테일(목록 + 상세[필드·사진·첨부문서·비고]). 와이어프레임 admin-screens.DefectItemContent 정본. */
export default function DefectScreen() {
  const [draft, setDraft] = useState({ proc: '', grade: '', use: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState('LB-1001');

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    return DEFECTS.filter(
      (d) =>
        (!applied.proc || d.proc === applied.proc) &&
        (!applied.grade || d.grade === applied.grade) &&
        (!applied.use || d.use === applied.use) &&
        (!kw || d.code.toLowerCase().includes(kw) || d.name.toLowerCase().includes(kw)),
    );
  }, [applied]);

  const cur = DEFECTS.find((d) => d.code === selected) ?? DEFECTS[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">불량항목정보</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 불량항목정보</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '불량항목 추가' }, 'save', 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="공정">
          <Select value={draft.proc} onChange={(v) => setDraft({ ...draft, proc: v })} options={PROC_OPTIONS} width={110} />
        </FilterField>
        <FilterField label="불량 등급">
          <Select value={draft.grade} onChange={(v) => setDraft({ ...draft, grade: v })} options={GRADE_OPTIONS} width={90} />
        </FilterField>
        <FilterField label="사용여부">
          <Select value={draft.use} onChange={(v) => setDraft({ ...draft, use: v })} options={USE_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="검색">
          <TextInput value={draft.q} onChange={(v) => setDraft({ ...draft, q: v })} placeholder="불량코드 / 불량명" width={180} onEnter={() => setApplied(draft)} />
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.2fr_1fr]">
        {/* 불량항목 목록 */}
        <Card title="불량항목 목록" action={<span className="text-[10.5px] text-ink3">총 42건 중 {rows.length}건</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['사진', '불량코드', '불량명', '공정', '등급', '상태'].map((h, i) => (
                    <th
                      key={h}
                      className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${
                        i === 0 || i >= 3 ? 'text-center' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const on = d.code === selected;
                  return (
                    <tr
                      key={d.code}
                      onClick={() => setSelected(d.code)}
                      className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
                    >
                      <td
                        className="px-3 py-2.5 text-center"
                        style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}
                      >
                        <PhotoSlot className="mx-auto h-10 w-10" label="" />
                      </td>
                      <td className={`px-3 py-2.5 font-bold ${on ? 'text-teal' : 'text-ink'}`}>{d.code}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{d.name}</td>
                      <td className="px-3 py-2.5 text-center text-ink2">{d.proc}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Pill tone={GRADE_TONE[d.grade]} solid={d.grade === '심'}>
                          {d.grade}
                        </Pill>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Pill tone={d.use === '사용' ? 'ok' : 'mute'}>{d.use}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 불량항목 상세정보 */}
        <Card title="불량항목 상세정보" action={<ActionBar actions={[{ preset: 'save', label: '저장' }]} />}>
          <div className="flex flex-col gap-3.5">
            {/* 필드 */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="불량코드" required value={cur.code} mono />
                <DetailField label="등급" select value={cur.grade} />
              </div>
              <DetailField label="불량명" required value={cur.name} />
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="공정" select value={cur.proc} />
                <DetailField label="사용여부" select value={cur.use} />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* 사진 갤러리 */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[11.5px] font-bold text-ink2">
                <span>불량 사진</span>
                <span className="text-[10px] font-medium text-ink3">대표 + 예시 사진 · 끌어다 놓기</span>
              </div>
              <PhotoSlot label="대표 불량 사진 끌어다 놓기" height={160} />
              <div className="mt-2 grid grid-cols-4 gap-2">
                {GALLERY.map((g) => (
                  <div key={g} className="flex flex-col items-center gap-1">
                    <PhotoSlot label="+" className="h-[56px] w-full" />
                    <span className="text-[9.5px] font-semibold text-ink3">{g}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* 첨부 문서 */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[11.5px] font-bold text-ink2">
                <span>첨부 문서</span>
                <ActionButton icon="upload" label="파일 첨부" />
              </div>
              <div className="flex flex-col gap-1.5">
                {DOCS.map((doc) => (
                  <div key={doc.name} className="flex items-center gap-2.5 rounded-md border border-border bg-panel-alt px-3 py-2">
                    <Pill tone={DOC_TONE[doc.type]} solid>
                      {doc.type}
                    </Pill>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink">{doc.name}</span>
                    <span className="flex-shrink-0 text-[10px] tabular-nums text-ink3">{doc.date}</span>
                    <span className="grid h-[18px] w-[18px] flex-shrink-0 cursor-pointer place-items-center rounded-full border border-border-hi bg-panel text-[11px] text-ink3">
                      ×
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 비고 */}
            <DetailField label="비고" multiline value={cur.remark} />
          </div>
        </Card>
      </div>
    </div>
  );
}
