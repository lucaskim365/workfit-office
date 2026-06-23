import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '@/modules/prod/_bits';
import { T } from '@/shared/theme/tokens';

interface Vendor {
  code: string;
  name: string;
  kind: '제조사' | '보전외주' | '부품공급' | '캘리브레이션';
  scope: string;
  mgr: string;
  phone: string;
  email: string;
  start: string;
  end: string;
  sla: string;
  fee: string;
  state: '계약중' | '갱신예정' | '만료임박' | '만료';
  grade: 'A' | 'B' | 'C';
  delivery: number;
  quality: number;
  response: number;
  jobs: number;
}

const VENDORS: Vendor[] = [
  { code: 'VD-AMAT', name: 'Applied Materials Korea', kind: '제조사', scope: 'CMP · Etch · Depo · Implant', mgr: 'J. Kim', phone: '031-8064-0000', email: 'amat.kr@appliedmaterials.com', start: '2019-05-01', end: '2026-04-30', sla: '4시간(긴급) / 24시간(일반)', fee: '연 1,580', state: '계약중', grade: 'A', delivery: 96, quality: 96, response: 89, jobs: 142 },
  { code: 'VD-NIKON', name: 'Nikon Precision Korea', kind: '제조사', scope: 'Photo', mgr: 'T. Sato', phone: '02-2188-9500', email: 'npk.service@nikon.com', start: '2021-03-01', end: '2027-02-28', sla: '4시간(긴급) / 24시간(일반)', fee: '연 1,250', state: '계약중', grade: 'A', delivery: 97, quality: 98, response: 92, jobs: 76 },
  { code: 'VD-TEL', name: 'Tokyo Electron Korea', kind: '제조사', scope: 'Etch · Clean', mgr: '이도현', phone: '031-739-2000', email: 'tel.kr@tel.com', start: '2020-09-01', end: '2026-08-31', sla: '4시간(긴급) / 24시간(일반)', fee: '연 980', state: '계약중', grade: 'A', delivery: 95, quality: 95, response: 90, jobs: 89 },
  { code: 'VD-HSEMI', name: '한세미텍', kind: '보전외주', scope: '전 설비 일상·정기 보전', mgr: '박정만', phone: '031-555-7820', email: 'service@hansemi.co.kr', start: '2023-01-01', end: '2025-12-31', sla: '2시간(긴급) / 8시간(일반)', fee: '연 2,400', state: '계약중', grade: 'A', delivery: 96, quality: 92, response: 97, jobs: 318 },
  { code: 'VD-MIRAE', name: '미래엔지니어링', kind: '보전외주', scope: 'CMP · Clean 보전', mgr: '최영호', phone: '031-322-4410', email: 'mirae@mr-eng.co.kr', start: '2022-07-01', end: '2025-06-30', sla: '4시간(긴급) / 12시간(일반)', fee: '연 1,150', state: '만료임박', grade: 'B', delivery: 89, quality: 90, response: 86, jobs: 174 },
  { code: 'VD-DWPRC', name: '동우정밀', kind: '부품공급', scope: '연마 패드 · O-Ring · 소모품', mgr: '정수민', phone: '032-811-6300', email: 'sales@dwprecision.kr', start: '2021-11-01', end: '2026-10-31', sla: '납기 3일(재고) / 14일(주문)', fee: '단가계약', state: '계약중', grade: 'B', delivery: 93, quality: 94, response: 90, jobs: 226 },
  { code: 'VD-KCAL', name: '케이씨캘리브레이션', kind: '캘리브레이션', scope: '계측기 교정 · 센서 캘리', mgr: '오현철', phone: '042-934-1180', email: 'cal@kc-lab.co.kr', start: '2022-04-01', end: '2025-03-31', sla: '교정 7일', fee: '건당계약', state: '갱신예정', grade: 'A', delivery: 99, quality: 97, response: 91, jobs: 64 },
];

const KIND: Record<Vendor['kind'], Tone> = { 제조사: 'info', 보전외주: 'ok', 부품공급: 'warn', 캘리브레이션: 'mute' };
const stTone = (s: string): Tone => (s === '계약중' ? 'ok' : s === '갱신예정' ? 'info' : s === '만료임박' ? 'warn' : 'err');
const gradeColor = (g: string) => (g === 'A' ? 'text-ok' : g === 'B' ? 'text-blue' : 'text-amber');

const HIST: Array<[string, string, string, string, string]> = [
  ['2026-06-05', 'PM', '월간 예방점검 — 구동부 윤활/소모품 교체', '완료', '2.5h'],
  ['2026-05-22', 'BM', '긴급 출동 — 진공 이상 O-Ring 교체', '완료', '4.0h'],
  ['2026-05-08', 'PM', '주간 예방점검 — 패드 마모 측정', '완료', '1.0h'],
  ['2026-04-19', 'CM', '예지보전 — 베어링 사전 교체', '완료', '3.0h'],
  ['2026-04-02', 'BM', '슬러리 라인 누설 보수', '완료', '2.5h'],
];

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="font-semibold text-ink3">{label}</span>
        <span className="font-extrabold tabular-nums text-ink">{value}%</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-md border border-border bg-panel-alt">
        <div className="h-full rounded-md" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function InfoRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-baseline gap-2.5 border-b border-dashed border-border py-1.5">
      <span className="text-[11px] font-semibold text-ink3">{k}</span>
      <span className={`text-[12.5px] font-semibold text-ink ${mono ? 'font-mono' : ''}`}>{v}</span>
    </div>
  );
}

/** 협력사·유지보수 업체 — 와이어프레임 equip-vendor.jsx 정본. */
export default function EquipVendorScreen() {
  const [sel, setSel] = useState('VD-AMAT');
  const v = VENDORS.find((x) => x.code === sel) ?? VENDORS[0];
  const score = Math.round((v.delivery + v.quality + v.response) / 3);
  const counts = (['제조사', '보전외주', '부품공급', '캘리브레이션'] as const).map((k) => ({ k, n: VENDORS.filter((x) => x.kind === k).length }));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">협력사 · 유지보수 업체</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 기준정보 관리 / 협력사·유지보수 업체</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '업체 등록' }, 'save', { preset: 'delete' }, 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => {}} right={<div className="flex items-center gap-2">{counts.map((c) => <span key={c.k} className="flex items-center gap-1 text-[10.5px] text-ink3"><b className="text-[12px] text-ink">{c.n}</b>{c.k}</span>)}</div>}>
        <FilterField label="업체 구분"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="담당 설비"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="계약 상태"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="업체명 / 담당자" width={160} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[380px_1fr]">
        <Card title="협력사 목록" action={<span className="text-[10.5px] text-ink3">{VENDORS.length}개사</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['업체명', '구분', '상태', '등급'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VENDORS.map((x, i) => {
                  const on = x.code === sel;
                  return (
                    <tr key={x.code} onClick={() => setSel(x.code)} className={`cursor-pointer ${on ? 'bg-teal-soft' : i % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                      <td className="border-b border-border px-3 py-2.5" style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                        <div className="flex flex-col">
                          <span className={`text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{x.name}</span>
                          <span className="font-mono text-[9.5px] text-ink3">{x.code} · {x.scope}</span>
                        </div>
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={KIND[x.kind]}>{x.kind}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(x.state)}>{x.state}</Pill></td>
                      <td className={`border-b border-border px-3 py-2.5 text-center text-[12px] font-extrabold ${gradeColor(x.grade)}`}>{x.grade}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card bodyClassName="p-0">
            <div className="flex items-center gap-3 px-[18px] py-4">
              <div className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[11px] bg-navy text-[18px] font-extrabold text-white">{v.name.replace(/[^A-Za-z가-힣]/g, '').slice(0, 2)}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-ink">{v.name}</span>
                  <Pill tone={KIND[v.kind]}>{v.kind}</Pill>
                  <Pill tone={stTone(v.state)}>{v.state}</Pill>
                </div>
                <span className="font-mono text-[11px] text-ink3">{v.code} · 담당 범위 · {v.scope}</span>
              </div>
              <div className="flex flex-col items-center gap-px border-l border-border px-3.5">
                <span className="text-[9.5px] font-semibold text-ink3">종합 평가</span>
                <span className="text-2xl font-extrabold leading-none text-teal">{score}<span className="text-[11px] text-ink3">점</span></span>
                <span className={`text-[11px] font-extrabold ${v.grade === 'A' ? 'text-ok' : 'text-blue'}`}>{v.grade}등급</span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Card title="기본 · 연락 정보">
              <div className="flex flex-col">
                <InfoRow k="담당자" v={v.mgr} />
                <InfoRow k="연락처" v={v.phone} mono />
                <InfoRow k="이메일" v={v.email} mono />
                <InfoRow k="누적 작업" v={`${v.jobs}건`} />
              </div>
            </Card>
            <Card title="계약 · SLA">
              <div className="flex flex-col">
                <InfoRow k="계약 기간" v={`${v.start} ~ ${v.end}`} mono />
                <InfoRow k="SLA(응답)" v={v.sla} />
                <InfoRow k="계약 금액" v={v.fee.startsWith('연') ? `${v.fee} 백만원` : v.fee} />
                <InfoRow k="평가 등급" v={`${v.grade}등급 (${score}점)`} />
              </div>
            </Card>
          </div>

          <Card title="공급사 평가 지표" action={<span className="text-[10.5px] text-ink3">최근 12개월</span>}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <MetricBar label="납기 준수율" value={v.delivery} color={T.teal} />
              <MetricBar label="품질 만족도" value={v.quality} color={T.blue} />
              <MetricBar label="응답 속도(SLA)" value={v.response} color={T.ok} />
            </div>
          </Card>

          <Card title="최근 작업 · 거래 이력" action={<span className="text-[10.5px] font-bold text-teal">전체 보기</span>} bodyClassName="p-0">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['일자', '구분', '작업 내용', '상태', '소요'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 || i === 1 || i === 3 ? 'text-center' : i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HIST.map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono text-ink2">{r[0]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={r[1] === 'PM' ? 'info' : r[1] === 'BM' ? 'err' : 'ok'}>{r[1]}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-ink">{r[2]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone="ok">{r[3]}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-bold tabular-nums text-ink">{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
