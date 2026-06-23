import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { PhotoSlot } from '@/shared/ui/PhotoSlot';
import { DetailField } from '@/shared/ui/DetailField';

interface Equip {
  code: string;
  name: string;
  type: string;
  line: string;
  state: '가동' | '대기' | '정지' | '고장';
  maker: string;
  installDate: string;
  use: '사용' | '미사용';
}

const EQUIPS: Equip[] = [
  { code: 'EQ-CMP02', name: 'CMP 02호기', type: 'CMP', line: 'A라인', state: '가동', maker: 'AMAT', installDate: '2022-04-18', use: '사용' },
  { code: 'EQ-ETCH01', name: 'Etch 01호기', type: 'Etch', line: 'A라인', state: '대기', maker: 'LamResearch', installDate: '2020-07-21', use: '사용' },
  { code: 'EQ-DEP03', name: 'Depo 03호기', type: 'Depo', line: 'B라인', state: '정지', maker: 'TEL', installDate: '2019-09-30', use: '사용' },
  { code: 'EQ-PHO05', name: 'Photo 05호기', type: 'Photo', line: 'A라인', state: '가동', maker: 'Nikon', installDate: '2022-03-14', use: '사용' },
  { code: 'EQ-OVEN05', name: 'Thermal 05호기', type: 'Thermal', line: 'C라인', state: '고장', maker: 'Koyo', installDate: '2018-12-05', use: '미사용' },
  { code: 'EQ-CLN04', name: 'Clean 04호기', type: 'Clean', line: 'C라인', state: '가동', maker: 'SCREEN', installDate: '2022-06-18', use: '사용' },
  { code: 'EQ-IMP02', name: 'Implant 02호기', type: 'Implant', line: 'B라인', state: '가동', maker: 'AMAT', installDate: '2023-01-09', use: '사용' },
];

const STATE_TONE: Record<Equip['state'], Tone> = { 가동: 'ok', 대기: 'info', 정지: 'warn', 고장: 'err' };
const TYPE_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...[...new Set(EQUIPS.map((e) => e.type))].map((t) => ({ value: t, label: t }))];
const LINE_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...['A라인', 'B라인', 'C라인'].map((l) => ({ value: l, label: l }))];
const USE_OPTIONS: Option[] = [{ value: '', label: '전체' }, { value: '사용', label: '사용' }, { value: '미사용', label: '미사용' }];
const GALLERY = ['정면', '측면', '명판', '설치'];

/** 설비정보 — 필터 + 마스터-디테일(목록 + 사진 갤러리·상세 폼). 와이어프레임 admin-screens.EquipInfoContent 정본. */
export default function EquipScreen() {
  const [draft, setDraft] = useState({ type: '', line: '', use: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState('EQ-CMP02');

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    return EQUIPS.filter(
      (e) =>
        (!applied.type || e.type === applied.type) &&
        (!applied.line || e.line === applied.line) &&
        (!applied.use || e.use === applied.use) &&
        (!kw || e.code.toLowerCase().includes(kw) || e.name.toLowerCase().includes(kw)),
    );
  }, [applied]);

  const cur = EQUIPS.find((e) => e.code === selected) ?? EQUIPS[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비정보</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 설비정보</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '설비 추가' }, 'save', 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="설비 유형">
          <Select value={draft.type} onChange={(v) => setDraft({ ...draft, type: v })} options={TYPE_OPTIONS} width={120} />
        </FilterField>
        <FilterField label="라인">
          <Select value={draft.line} onChange={(v) => setDraft({ ...draft, line: v })} options={LINE_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="사용여부">
          <Select value={draft.use} onChange={(v) => setDraft({ ...draft, use: v })} options={USE_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="검색">
          <TextInput value={draft.q} onChange={(v) => setDraft({ ...draft, q: v })} placeholder="설비코드 / 설비명" width={180} onEnter={() => setApplied(draft)} />
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.3fr_1fr]">
        {/* 설비 목록 */}
        <Card title="설비 목록" action={<span className="text-[10.5px] text-ink3">총 100건 중 {rows.length}건</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['사진', '설비코드', '설비명', '유형', '라인', '상태'].map((h, i) => (
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
                {rows.map((e) => {
                  const on = e.code === selected;
                  return (
                    <tr
                      key={e.code}
                      onClick={() => setSelected(e.code)}
                      className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
                    >
                      <td
                        className="px-3 py-2.5 text-center"
                        style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}
                      >
                        <PhotoSlot className="mx-auto h-10 w-10" label="" />
                      </td>
                      <td className={`px-3 py-2.5 font-bold ${on ? 'text-teal' : 'text-ink'}`}>{e.code}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{e.name}</td>
                      <td className="px-3 py-2.5 text-center text-ink2">{e.type}</td>
                      <td className="px-3 py-2.5 text-center text-ink2">{e.line}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Pill tone={STATE_TONE[e.state]}>{e.state}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 설비 상세정보 */}
        <Card title="설비 상세정보" action={<ActionBar actions={[{ preset: 'save', label: '저장' }]} />}>
          <div className="flex flex-col gap-3.5">
            {/* 사진 갤러리 */}
            <div>
              <div className="mb-2 flex items-center justify-between text-[11.5px] font-bold text-ink2">
                <span>설비 사진</span>
                <span className="text-[10px] font-medium text-ink3">최대 5장 · 끌어다 놓기</span>
              </div>
              <PhotoSlot label="대표 사진 끌어다 놓기" height={170} />
              <div className="mt-2 grid grid-cols-4 gap-2">
                {GALLERY.map((g) => (
                  <div key={g} className="flex flex-col items-center gap-1">
                    <PhotoSlot label="+" className="h-[58px] w-full" />
                    <span className="text-[9.5px] font-semibold text-ink3">{g}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* 필드 */}
            <div className="flex flex-col gap-3">
              <DetailField label="설비코드" required value={cur.code} mono />
              <DetailField label="설비명" required value={cur.name} />
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="유형" select value={cur.type} />
                <DetailField label="라인" select value={cur.line} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="제조사" value={cur.maker} />
                <DetailField label="도입일" value={cur.installDate} mono />
              </div>
              <DetailField label="사용여부" select value={cur.use} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
