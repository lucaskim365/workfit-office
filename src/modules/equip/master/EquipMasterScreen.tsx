import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { PhotoSlot } from '@/shared/ui/PhotoSlot';
import { DetailField } from '@/shared/ui/DetailField';
import { ReadSelect } from '@/modules/prod/_bits';
import { EQ_TREE, EQ_UNITS, SPEC, CHECKS, ALARMS, HISTORY, stTone, gradeTone, histTone, cycleTone } from '../_data';
import { useEquipments } from '@/features/equipment/useEquipments';

const TABS = ['기본정보', '제원 / 스펙', '점검 항목', '알람 / 에러 코드', '보전 이력'];
const GALLERY = ['측면', '명판', '설치'];

/** 설비 마스터 등록 — 와이어프레임 equip-base.jsx 정본 (BOM 트리 + 탭 상세). */
export default function EquipMasterScreen() {
  const [sel, setSel] = useState('EQ-CMP02');
  const [tab, setTab] = useState('기본정보');
  const [openLines, setOpenLines] = useState<Record<string, boolean>>({ A라인: true, B라인: true, C라인: true });
  const { data: EQ_LIST = [], isLoading } = useEquipments();
  const eq = EQ_LIST.find((e) => e.code === sel) ?? EQ_LIST[0];
  if (!eq) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '등록된 설비가 없습니다.'}</div>;
  }
  const spec = SPEC[eq.type] ?? [];
  const specRows: Array<[(typeof spec)[number], (typeof spec)[number] | undefined]> = [];
  for (let i = 0; i < spec.length; i += 2) specRows.push([spec[i], spec[i + 1]]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비 마스터 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 기준정보 관리 / 설비 마스터 등록</p>
        </div>
        <ActionBar actions={['add', 'save', { preset: 'delete' }, 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="라인"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="설비 유형"><ReadSelect value="전체" w={110} /></FilterField>
        <FilterField label="사용여부"><ReadSelect value="사용" w={80} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="설비코드 / 설비명" width={180} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[300px_1fr]">
        {/* 설비 계층(BOM) 트리 */}
        <Card title="설비 계층 (BOM)" action={<span className="text-[10.5px] text-ink3">라인 · {EQ_LIST.length}대</span>} bodyClassName="p-0">
          <div className="flex max-h-[560px] flex-col gap-px overflow-y-auto p-1.5">
            {EQ_TREE.map((grp) => {
              const open = openLines[grp.line];
              return (
                <div key={grp.line}>
                  <button onClick={() => setOpenLines((o) => ({ ...o, [grp.line]: !o[grp.line] }))} className="flex w-full items-center gap-1.5 rounded-[7px] px-2.5 py-2 text-left">
                    <span className="w-2 text-[8px] text-ink3">{open ? '▾' : '▸'}</span>
                    <span className="text-[13px] text-teal">▤</span>
                    <span className="text-[12px] font-extrabold text-navy">{grp.line}</span>
                    <span className="ml-auto text-[10px] font-semibold text-ink3">{grp.codes.length}</span>
                  </button>
                  {open && grp.codes.map((code) => {
                    const e = EQ_LIST.find((x) => x.code === code)!;
                    const on = code === sel;
                    return (
                      <div key={code}>
                        <button onClick={() => setSel(code)} className={`flex w-full items-center gap-2 rounded-r-[7px] py-[7px] pl-[26px] pr-2.5 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${e.state === '가동' ? 'bg-ok' : e.state === '대기' ? 'bg-blue' : e.state === '정지' ? 'bg-amber' : 'bg-danger'}`} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className={`truncate text-[11.5px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{e.name}</span>
                            <span className="font-mono text-[9.5px] text-ink3">{e.code}</span>
                          </span>
                        </button>
                        {on && (EQ_UNITS[code] ?? []).map((u) => (
                          <div key={u} className="flex items-center gap-1.5 py-1 pl-[46px] pr-2.5">
                            <span className="text-[9px] text-ink3">└</span>
                            <span className="text-[10.5px] text-ink2">{u}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>

        {/* 상세 (탭) */}
        <Card bodyClassName="p-0">
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-2">
            {TABS.map((t) => {
              const on = t === tab;
              return (
                <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-[12px] ${on ? 'border-teal font-extrabold text-teal' : 'border-transparent font-semibold text-ink3'}`}>{t}</button>
              );
            })}
            <span className="ml-auto flex items-center gap-2 pr-3">
              <span className="font-mono text-[11px] font-bold text-ink">{eq.code}</span>
              <Pill tone={stTone(eq.state)}>{eq.state}</Pill>
            </span>
          </div>

          <div className="p-[18px]">
            {tab === '기본정보' && (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[220px_1fr]">
                <div>
                  <PhotoSlot label="대표 사진 끌어다 놓기" height={160} />
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {GALLERY.map((g) => (
                      <div key={g} className="flex flex-col items-center gap-1">
                        <PhotoSlot label="+" className="h-[52px] w-full" />
                        <span className="text-[9.5px] font-semibold text-ink3">{g}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5 rounded-[9px] border border-border bg-panel-alt p-3">
                    {([['설치 위치', eq.loc], ['관리 담당', eq.mgr], ['IP 주소', eq.ip]] as const).map(([k, v], i) => (
                      <div key={k} className="flex justify-between text-[11px]">
                        <span className="font-semibold text-ink3">{k}</span>
                        <span className={`font-bold text-ink ${i === 2 ? 'font-mono' : ''}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3.5">
                    <DetailField label="설비코드" required value={eq.code} mono />
                    <DetailField label="설비명" required value={eq.name} />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <DetailField label="설비 유형" required select value={eq.type} />
                    <DetailField label="라인" required select value={eq.line} />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <DetailField label="모델명" value={eq.model} />
                    <DetailField label="제조사" value={eq.maker} />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <DetailField label="도입일" value={eq.date} mono />
                    <DetailField label="자산번호" value={`AST-${eq.code.replace('EQ-', '')}`} mono />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <DetailField label="정격 전력" value={`${eq.power} kW`} />
                    <DetailField label="전원" value={eq.volt} />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <DetailField label="사용여부" select value={eq.use} />
                    <DetailField label="가동 상태" select value={eq.state} />
                  </div>
                  <DetailField label="비고" multiline value={`${eq.maker} 공급 · 정기 PM 대상 설비. 핵심 공정 라인 설비로 비가동 시 즉시 보전팀 호출.`} />
                </div>
              </div>
            )}

            {tab === '제원 / 스펙' && (
              <div className="flex flex-col gap-3">
                <div className="text-[12px] font-bold text-ink2">{eq.type} 설비 표준 제원</div>
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      {['제원 항목', '값', '단위', '제원 항목', '값', '단위'].map((h, i) => (
                        <th key={i} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${i === 1 || i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {specRows.map(([a, b], i) => (
                      <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                        <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{a[0]}</td>
                        <td className="border-b border-border px-3 py-2.5 text-right font-extrabold tabular-nums text-ink">{a[1]}</td>
                        <td className="border-b border-border px-3 py-2.5 text-ink2">{a[2]}</td>
                        <td className="border-b border-l border-border px-3 py-2.5 font-bold text-ink">{b ? b[0] : '—'}</td>
                        <td className="border-b border-border px-3 py-2.5 text-right font-extrabold tabular-nums text-ink">{b ? b[1] : ''}</td>
                        <td className="border-b border-border px-3 py-2.5 text-ink2">{b ? b[2] : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === '점검 항목' && (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {['No', '점검 항목', '주기', '합격 기준', '점검 방법'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${i === 0 || i === 2 || i === 4 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(CHECKS[eq.type] ?? []).map((r, i) => (
                    <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5 text-center text-ink3">{i + 1}</td>
                      <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{r[0]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={cycleTone(r[1])}>{r[1]}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-ink2">{r[2]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === '알람 / 에러 코드' && (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {['코드', '알람 명칭', '등급', '조치 가이드'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${i === 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ALARMS[eq.type] ?? []).map((r, i) => (
                    <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5 font-mono font-bold text-teal">{r[0]}</td>
                      <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{r[1]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={gradeTone(r[2])}>{r[2]}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-ink2">{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === '보전 이력' && (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {['일자', '구분', '작업 내용', '담당', '소요'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${i === 0 || i === 1 || i === 3 ? 'text-center' : i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HISTORY.map((r, i) => (
                    <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5 text-center font-mono text-ink2">{r[0]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={histTone(r[1])}>{r[1]}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-ink">{r[2]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{r[3]}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-bold tabular-nums text-ink">{r[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
