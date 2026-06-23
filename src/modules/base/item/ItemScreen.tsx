import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { PhotoSlot } from '@/shared/ui/PhotoSlot';
import { DetailField } from '@/shared/ui/DetailField';

interface Item {
  code: string;
  name: string;
  spec: string;
  unit: string;
  type: '원자재' | '부자재' | '반제품' | '완제품';
  use: '사용' | '미사용';
  safety: string;
  remark: string;
}

const ITEMS: Item[] = [
  { code: 'WF-200-A', name: '200mm 웨이퍼', spec: 'Ø200mm', unit: 'EA', type: '원자재', use: '사용', safety: '500 EA', remark: '입고 검사 필수 품목. 거래처 대성반도체(주).' },
  { code: 'WF-300-B', name: '300mm 웨이퍼', spec: 'Ø300mm', unit: 'EA', type: '원자재', use: '사용', safety: '300 EA', remark: '주력 생산 라인 투입 원자재.' },
  { code: 'PKG-BGA-14', name: 'BGA 패키지', spec: '14×14mm', unit: 'EA', type: '반제품', use: '사용', safety: '1,200 EA', remark: '패키징 공정 반제품.' },
  { code: 'CHM-SL-05', name: '슬러리 SL-05', spec: '20L', unit: 'CAN', type: '부자재', use: '사용', safety: '40 CAN', remark: 'CMP 공정 소모 부자재. 유효기간 관리.' },
  { code: 'MOD-CAM-02', name: '카메라 모듈', spec: '1/2.8"', unit: 'EA', type: '완제품', use: '사용', safety: '200 EA', remark: '출하 완제품.' },
  { code: 'RES-PR-22', name: '포토레지스트', spec: '5L', unit: 'BTL', type: '부자재', use: '미사용', safety: '60 BTL', remark: '포토 공정 소모 부자재.' },
];

const TYPE_TONE: Record<Item['type'], Tone> = { 원자재: 'info', 부자재: 'mute', 반제품: 'warn', 완제품: 'ok' };
const TYPE_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...(['원자재', '부자재', '반제품', '완제품'] as const).map((t) => ({ value: t, label: t }))];
const USE_OPTIONS: Option[] = [{ value: '', label: '전체' }, { value: '사용', label: '사용' }, { value: '미사용', label: '미사용' }];

/** 품목정보 — 필터 + 마스터-디테일(사진). 와이어프레임 admin-screens.ItemInfoContent 정본. */
export default function ItemScreen() {
  const [draft, setDraft] = useState({ type: '', use: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState('WF-200-A');

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    return ITEMS.filter(
      (it) =>
        (!applied.type || it.type === applied.type) &&
        (!applied.use || it.use === applied.use) &&
        (!kw || it.code.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
    );
  }, [applied]);
  const cur = ITEMS.find((it) => it.code === selected) ?? ITEMS[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">품목정보</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 품목정보</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '품목 추가' }, 'save', 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="품목 구분">
          <Select value={draft.type} onChange={(v) => setDraft({ ...draft, type: v })} options={TYPE_OPTIONS} width={110} />
        </FilterField>
        <FilterField label="사용여부">
          <Select value={draft.use} onChange={(v) => setDraft({ ...draft, use: v })} options={USE_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="검색">
          <TextInput value={draft.q} onChange={(v) => setDraft({ ...draft, q: v })} placeholder="품목코드 / 품목명" width={200} onEnter={() => setApplied(draft)} />
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <Card title="품목 목록" action={<span className="text-[10.5px] text-ink3">총 248건 중 {rows.length}건</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['사진', '품목코드', '품목명', '규격', '단위', '구분', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 || i === 4 || i === 6 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => {
                  const on = it.code === selected;
                  return (
                    <tr key={it.code} onClick={() => setSelected(it.code)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className="px-3 py-2 text-center" style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                        <PhotoSlot className="mx-auto h-10 w-10" label="" />
                      </td>
                      <td className={`px-3 py-2 font-bold ${on ? 'text-teal' : 'text-ink'}`}>{it.code}</td>
                      <td className="px-3 py-2 font-semibold text-ink">{it.name}</td>
                      <td className="px-3 py-2 text-ink2">{it.spec}</td>
                      <td className="px-3 py-2 text-center text-ink2">{it.unit}</td>
                      <td className="px-3 py-2"><Pill tone={TYPE_TONE[it.type]}>{it.type}</Pill></td>
                      <td className="px-3 py-2 text-center"><Pill tone={it.use === '사용' ? 'ok' : 'mute'}>{it.use}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="품목 상세정보" action={<ActionBar actions={[{ preset: 'save', label: '저장' }]} />}>
          <div className="flex flex-col gap-3.5">
            {/* 대표 사진 + 코드/명 */}
            <div className="flex items-start gap-3.5">
              <PhotoSlot label="품목 사진" className="h-[160px] w-[160px] flex-shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <div>
                  <div className="mb-1 text-[10.5px] font-semibold text-ink3">품목코드 <span className="text-danger">*</span></div>
                  <div className="flex h-9 items-center rounded-md border border-border-hi bg-panel px-3 text-[12.5px] font-bold text-ink">{cur.code}</div>
                </div>
                <div>
                  <div className="mb-1 text-[10.5px] font-semibold text-ink3">품목명 <span className="text-danger">*</span></div>
                  <div className="flex h-9 items-center rounded-md border border-border-hi bg-panel px-3 text-[12.5px] font-semibold text-ink">{cur.name}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="규격" value={cur.spec} />
              <DetailField label="단위" select value={cur.unit} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="구분" select value={cur.type} />
              <DetailField label="안전재고" value={cur.safety} mono />
            </div>
            <DetailField label="사용여부" select value={cur.use} />
            <DetailField label="비고" multiline value={cur.remark} />
          </div>
        </Card>
      </div>
    </div>
  );
}
