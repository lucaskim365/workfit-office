import { Fragment, useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '@/modules/prod/_bits';
import { EQ_LIST } from '../_data';

interface Item { area: string; name: string; kind: '일상' | '정기'; cycle: string; method: string; std: string; lo: string; hi: string; unit: string; pass: string; action: string }
const it = (area: string, name: string, kind: '일상' | '정기', cycle: string, method: string, std: string, lo: string, hi: string, unit: string, pass: string, action: string): Item => ({ area, name, kind, cycle, method, std, lo, hi, unit, pass, action });

const CHECK_ITEMS: Record<string, Item[]> = {
  CMP: [
    it('헤드 캐리어 유닛', '멤브레인 마모도', '일상', '1일', '게이지', '1.5', '1.2', '', 'mm', '두께 ≥ 1.2 mm', '멤브레인 교체 의뢰'),
    it('헤드 캐리어 유닛', '헤드 진공 누설', '정기', '1주', '계측', '', '', '5', 'mmHg/min', '누설 ≤ 5', 'O-Ring 점검·교체'),
    it('연마 플래튼', '연마 패드 마모도', '일상', '1일', '게이지', '1.3', '1.2', '', 'mm', '두께 ≥ 1.2 mm', '패드 교체'),
    it('연마 플래튼', '컨디셔너 다이아 상태', '정기', '1주', '육안', '', '', '', '-', '균열·박리 없음', '컨디셔너 디스크 교체'),
    it('연마 플래튼', '구동부 윤활 상태', '정기', '1개월', '점검', '', '', '', '-', '규정 주유량 충족', '주유 작업 실시'),
    it('슬러리 공급 유닛', '슬러리 공급 압력', '일상', '1일', '계측', '0.3', '0.2', '0.4', 'MPa', '0.2 ~ 0.4 MPa', '펌프·레귤레이터 점검'),
    it('슬러리 공급 유닛', '슬러리 유량', '일상', '1일', '계측', '200', '180', '220', 'mL/min', '180 ~ 220 mL/min', 'MFC 캘리브레이션'),
    it('End-point 검출', '광학 센서 청결도', '정기', '1주', '육안', '', '', '', '-', '오염·파티클 없음', '센서 클리닝'),
    it('End-point 검출', '신호 캘리브레이션', '정기', '1개월', '측정', '', '', '1', '%', '오차 ≤ ±1 %', '재캘리브레이션'),
  ],
  Etch: [
    it('RF 제너레이터', 'RF 매칭(반사파)', '일상', '1일', '계측', '', '', '5', 'W', 'Reflect ≤ 5 W', '매칭 네트워크 점검'),
    it('챔버 A', '챔버 압력', '일상', '1일', '계측', '', '-3', '3', '%', '규정 ±3 %', 'APC 밸브·펌프 점검'),
    it('챔버 A', '가스 누설 점검', '정기', '1주', 'He 디텍터', '', '', '', '-', '누설 없음', '배관·피팅 조임'),
    it('챔버 A', 'O-Ring 상태', '정기', '1개월', '육안', '', '', '', '-', '경화·손상 없음', 'O-Ring 교체'),
  ],
  Photo: [
    it('웨이퍼 스테이지', '스테이지 정렬', '일상', '1일', '자동측정', '', '-2', '2', 'nm', '±2 nm 이내', '얼라인먼트 재수행'),
    it('광원', '광원 출력', '일상', '1일', '계측', '', '-2', '2', '%', '규정 ±2 %', '램프 점검·교체'),
    it('얼라인먼트 유닛', '렌즈 오염', '정기', '1주', '검사', '0', '', '0', 'EA', '파티클 0', '렌즈 클리닝'),
    it('환경', '온습도 환경', '일상', '1일', '모니터', '23', '22.9', '23.1', '℃', '23 ±0.1 ℃', '항온항습 설비 점검'),
  ],
  Depo: [
    it('프로세스 챔버', '히터 온도 편차', '일상', '1일', '계측', '', '-3', '3', '℃', '±3 ℃', '히터·열전대 점검'),
    it('가스 박스', '가스 유량(MFC)', '일상', '1일', '계측', '', '-2', '2', '%', '규정 ±2 %', 'MFC 캘리브레이션'),
    it('프로세스 챔버', '챔버 누설률', '정기', '1주', '계측', '', '', '1', 'mTorr/min', '≤ 1', '챔버 리크 점검'),
    it('프로세스 챔버', '샤워헤드 오염', '정기', '1개월', '육안', '', '', '', '-', '증착물 제거 상태', '샤워헤드 세정'),
  ],
  Implant: [
    it('이온 소스', '빔 전류 안정도', '일상', '1일', '계측', '', '-1', '1', '%', '±1 % 이내', '이온 소스 점검'),
    it('엔드 스테이션', '진공도 확인', '일상', '1일', '계측', '', '', '1e-6', 'Torr', '≤ 1×10⁻⁶', '펌프·게이지 확인'),
    it('이온 소스', '소스 수명', '정기', '1주', '카운터', '', '20', '', '%', '잔여 ≥ 20 %', '이온 소스 교체'),
    it('가속관', '고전압 절연', '정기', '1개월', '계측', '', '', '', '-', '방전 없음', '절연부 점검'),
  ],
  Thermal: [
    it('퍼니스 튜브', '온도 프로파일', '일상', '1일', '계측', '', '-2', '2', '℃', '±2 ℃', '히터·열전대 점검'),
    it('보트 엘리베이터', '보트 구동 상태', '일상', '1일', '청음', '', '', '', '-', '이상음 없음', '구동부 점검'),
    it('가스 패널', '퍼지 압력', '정기', '1주', '계측', '', '-5', '5', '%', '규정 ±5 %', '가스 패널 점검'),
    it('퍼니스 튜브', '석영 튜브 균열', '정기', '1개월', '육안', '', '', '', '-', '균열 없음', '석영 튜브 교체'),
  ],
  Clean: [
    it('케미컬 배스', '케미컬 농도', '일상', '1일', '적정', '', '-3', '3', '%', '규정 ±3 %', '케미컬 보충·교체'),
    it('린스 모듈', 'DI수 비저항', '일상', '1일', '계측', '18', '18', '', 'MΩ·cm', '≥ 18', 'DI 공급 설비 점검'),
    it('케미컬 배스', '배스 온도', '일상', '1일', '계측', '', '-1', '1', '℃', '규정 ±1 ℃', '히터·센서 점검'),
    it('스핀 드라이어', '필터 차압', '정기', '1주', '계측', '', '', '0.1', 'MPa', '≤ 0.1', '필터 교체'),
  ],
};

const kindTone = (k: string): Tone => (k === '일상' ? 'info' : 'ok');
const cycleTone = (c: string): Tone => (c === '1일' ? 'info' : c === '1주' ? 'ok' : c === '1개월' ? 'mute' : 'warn');

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-[10px] border border-border bg-panel px-3.5 py-3">
      <span className="text-[10.5px] font-semibold text-ink3">{label}</span>
      <span className={`text-[22px] font-extrabold leading-none tabular-nums ${color}`}>{value}<span className="ml-0.5 text-[11px] font-semibold text-ink3">건</span></span>
    </div>
  );
}

/** 설비별 점검 항목 — 와이어프레임 equip-check.jsx 정본. */
export default function EquipCheckScreen() {
  const [sel, setSel] = useState('EQ-CMP02');
  const [pick, setPick] = useState(0);
  const eq = EQ_LIST.find((e) => e.code === sel) ?? EQ_LIST[0];
  const items = CHECK_ITEMS[eq.type] ?? [];
  const item = items[pick] ?? items[0];

  const groups = useMemo(() => {
    const g: Array<{ area: string; rows: Array<{ item: Item; idx: number }> }> = [];
    items.forEach((x, idx) => {
      let grp = g.find((y) => y.area === x.area);
      if (!grp) { grp = { area: x.area, rows: [] }; g.push(grp); }
      grp.rows.push({ item: x, idx });
    });
    return g;
  }, [items]);

  const daily = items.filter((i) => i.kind === '일상').length;
  const weekly = items.filter((i) => i.cycle === '1주').length;
  const monthly = items.filter((i) => i.cycle === '1개월').length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비별 점검 항목</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 기준정보 관리 / 설비별 점검 항목</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '항목 추가' }, 'save', { preset: 'delete' }, 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="라인"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="설비 유형"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="점검 유형"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="점검 항목 / 부위" width={170} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[260px_1fr]">
        <Card title="설비 목록" action={<span className="text-[10.5px] text-ink3">{EQ_LIST.length}대</span>} bodyClassName="p-0">
          <div className="flex max-h-[600px] flex-col gap-px overflow-y-auto p-1.5">
            {EQ_LIST.map((e) => {
              const on = e.code === sel;
              const n = (CHECK_ITEMS[e.type] ?? []).length;
              return (
                <button key={e.code} onClick={() => { setSel(e.code); setPick(0); }} className={`flex w-full items-center gap-2.5 rounded-r-[7px] px-2.5 py-2 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${e.state === '가동' ? 'bg-ok' : e.state === '대기' ? 'bg-blue' : e.state === '정지' ? 'bg-amber' : 'bg-danger'}`} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{e.name}</span>
                    <span className="text-[9.5px] text-ink3">{e.line} · {e.type}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold ${on ? 'bg-panel text-teal' : 'bg-panel-alt text-ink3'}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <div className="flex gap-2.5">
            <Stat label="총 점검 항목" value={items.length} color="text-ink" />
            <Stat label="일상 점검" value={daily} color="text-blue" />
            <Stat label="주간 점검" value={weekly} color="text-teal" />
            <Stat label="월간 점검" value={monthly} color="text-amber" />
          </div>

          <Card title={`${eq.name} · 점검 항목`} action={<span className="text-[10.5px] text-ink3">점검부위 {groups.length} · 항목 {items.length}</span>} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {['No', '점검 항목', '유형', '주기', '방법', '합격 기준', '사용'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 || (i >= 2 && i <= 4) || i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.area}>
                      <tr>
                        <td colSpan={7} className="bg-navy px-3 py-1.5 text-[11px] font-bold text-white"><span className="text-[#8fb3ff]">▣ </span>{g.area} <span className="font-medium opacity-60">· {g.rows.length}개 항목</span></td>
                      </tr>
                      {g.rows.map(({ item: x, idx }) => {
                        const on = idx === pick;
                        return (
                          <tr key={idx} onClick={() => setPick(idx)} className={`cursor-pointer ${on ? 'bg-teal-soft' : idx % 2 ? 'bg-panel-alt' : 'bg-panel'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                            <td className="border-b border-border px-3 py-2.5 text-center text-ink3">{idx + 1}</td>
                            <td className={`border-b border-border px-3 py-2.5 font-bold ${on ? 'text-teal' : 'text-ink'}`}>{x.name}</td>
                            <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={kindTone(x.kind)}>{x.kind}</Pill></td>
                            <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={cycleTone(x.cycle)}>{x.cycle}</Pill></td>
                            <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{x.method}</td>
                            <td className="border-b border-border px-3 py-2.5 text-ink">{x.pass}</td>
                            <td className="border-b border-border px-3 py-2.5 text-center"><span className="inline-block h-2 w-2 rounded-full bg-ok" /></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {item && (
            <Card title="판정 기준 상세" action={<ActionButton icon="save" label="기준 저장" variant="primary" />}>
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <span className="text-[14px] font-extrabold text-ink">{item.name}</span>
                  <Pill tone={kindTone(item.kind)}>{item.kind}</Pill>
                  <Pill tone={cycleTone(item.cycle)}>{item.cycle} 주기</Pill>
                  <span className="ml-auto text-[11px] text-ink3">점검 부위 · {item.area}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {([['기준값', item.std || '—', item.unit !== '-' ? item.unit : ''], ['하한(LSL)', item.lo || '—', item.lo && item.unit !== '-' ? item.unit : ''], ['상한(USL)', item.hi || '—', item.hi && item.unit !== '-' ? item.unit : ''], ['점검 방법', item.method, '']] as const).map(([k, v, u]) => (
                    <div key={k} className="flex flex-col gap-1.5 rounded-[9px] border border-border bg-panel-alt px-3.5 py-3">
                      <span className="text-[10.5px] font-semibold text-ink3">{k}</span>
                      <span className="text-base font-extrabold tabular-nums text-ink">{v}{u && <span className="ml-0.5 text-[10.5px] font-semibold text-ink3">{u}</span>}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5 rounded-[9px] border border-ok/30 bg-[#eafaf5] px-4 py-3.5">
                    <span className="text-[11px] font-bold text-ok">✓ 합격(OK) 조건</span>
                    <span className="text-[13px] font-bold text-ink">{item.pass}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-[9px] border border-border bg-[#fdf1f0] px-4 py-3.5">
                    <span className="text-[11px] font-bold text-danger">✕ 불합격(NG) 시 조치</span>
                    <span className="text-[13px] font-bold text-ink">{item.action}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
