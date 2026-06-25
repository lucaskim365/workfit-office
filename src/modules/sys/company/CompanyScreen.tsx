import { useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Toggle } from '@/shared/ui/Toggle';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { useCompanySites, useSaveCompanySite } from '@/features/companySite/useCompanySites';
import type { CompanySite } from '@/domain/companySite/schema';

/** 라벨(좌) + 입력(우) 행 — 회사정보 폼 공통. */
function FRow({ label, required, children, multiline }: { label: string; required?: boolean; children: ReactNode; multiline?: boolean }) {
  return (
    <div className={`grid grid-cols-[112px_1fr] gap-3.5 ${multiline ? 'items-start' : 'items-center'}`}>
      <span className={`text-[12px] font-bold text-ink2 ${multiline ? 'pt-2' : ''}`}>
        {label}{required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </div>
  );
}

const AL = { left: 'text-left', center: 'text-center' } as const;
const th = (al: keyof typeof AL) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: keyof typeof AL) => `border-b border-border px-3 py-2.5 ${AL[al]}`;

/** 회사 정보 — 시스템 관리 / 회사 기준정보(법인·사업장·표기) 관리. */
export default function CompanyScreen() {
  const [active, setActive] = useState(true);
  const [mask, setMask] = useState(true);
  const { data: sites, isLoading } = useCompanySites();
  const save = useSaveCompanySite();
  const rows = sites ?? [];

  // 사업장 인라인 편집 — name(PK)별로 변경분을 draft에 보관, 저장 시 Firestore로 영구 반영.
  const [draft, setDraft] = useState<Record<string, Partial<CompanySite>>>({});
  const edit = (name: string, patch: Partial<CompanySite>) =>
    setDraft((d) => ({ ...d, [name]: { ...d[name], ...patch } }));
  const dirty = Object.keys(draft).length > 0;
  const onSave = () => {
    rows.forEach((s) => {
      if (draft[s.name]) save.mutate({ ...s, ...draft[s.name] });
    });
    setDraft({});
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">회사 정보</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 회사 정보</p>
        </div>
        <ActionBar actions={['refresh', { preset: 'save', label: save.isPending ? '저장 중…' : dirty ? '저장 *' : '저장', onClick: onSave, disabled: !dirty || save.isPending }]} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <Card title="기본 정보">
          <div className="flex flex-col gap-3">
            <FRow label="회사명" required><TextField defaultValue="워크핏테크놀로지(주)" /></FRow>
            <FRow label="영문 회사명"><TextField defaultValue="WorkFit Technology Co., Ltd." /></FRow>
            <FRow label="사업자등록번호"><TextField defaultValue="142-81-04567" className="font-mono tabular-nums" /></FRow>
            <FRow label="법인등록번호"><TextField defaultValue="110111-3456789" className="font-mono tabular-nums" /></FRow>
            <div className="grid grid-cols-2 gap-3">
              <FRow label="대표자" required><TextField defaultValue="김경영" /></FRow>
              <FRow label="설립일"><TextField defaultValue="2011-03-02" className="tabular-nums" /></FRow>
            </div>
          </div>
        </Card>

        <Card title="업종 / 분류">
          <div className="flex flex-col gap-3">
            <FRow label="업태"><TextField defaultValue="제조업" /></FRow>
            <FRow label="종목"><TextField defaultValue="반도체 모듈 · 전자부품 제조" /></FRow>
            <FRow label="회사 구분">
              <SelectField defaultValue="법인" options={[{ value: '법인', label: '법인사업자' }, { value: '개인', label: '개인사업자' }]} />
            </FRow>
            <FRow label="회계연도 시작">
              <SelectField defaultValue="1" options={[{ value: '1', label: '1월' }, { value: '3', label: '3월' }, { value: '4', label: '4월' }]} />
            </FRow>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div><div className="text-[12.5px] font-bold text-ink">사용 여부</div><div className="mt-0.5 text-[10.5px] text-ink3">미사용 시 신규 전표 발행 제한</div></div>
              <Toggle on={active} onChange={setActive} />
            </div>
          </div>
        </Card>

        <Card title="연락처 / 주소">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FRow label="대표 전화"><TextField defaultValue="031-8000-1200" className="tabular-nums" /></FRow>
              <FRow label="팩스"><TextField defaultValue="031-8000-1209" className="tabular-nums" /></FRow>
            </div>
            <FRow label="대표 이메일"><TextField defaultValue="contact@workfit.co.kr" /></FRow>
            <FRow label="홈페이지"><TextField defaultValue="https://www.workfit.co.kr" /></FRow>
            <FRow label="본사 주소" multiline>
              <textarea defaultValue="경기도 화성시 동탄첨단산업1로 27, 메가센터 7층 (우 18469)" rows={2}
                className="resize-none rounded-md border border-border-hi bg-panel px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none transition-colors focus:border-teal" />
            </FRow>
          </div>
        </Card>

        <Card title="시스템 표기 / 문서">
          <div className="flex flex-col gap-3">
            <FRow label="시스템 표기명"><TextField defaultValue="WorkFit MES" /></FRow>
            <FRow label="보고서 머리말"><TextField defaultValue="WorkFitMES" /></FRow>
            <FRow label="문서 푸터"><TextField defaultValue="본 문서는 WorkFitMES에서 발행되었습니다." /></FRow>
            <FRow label="회사 로고" multiline>
              <div className="flex items-center gap-3">
                <div className="grid h-[52px] w-[120px] place-items-center rounded-md border border-dashed border-border-hi bg-panel-alt text-[11px] font-bold text-ink3">LOGO</div>
                <span className="text-[10.5px] text-ink3">PNG · 권장 240×80px<br />보고서·로그인 화면에 사용</span>
              </div>
            </FRow>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div><div className="text-[12.5px] font-bold text-ink">민감정보 마스킹</div><div className="mt-0.5 text-[10.5px] text-ink3">사업자번호·연락처 마스킹 표기</div></div>
              <Toggle on={mask} onChange={setMask} />
            </div>
          </div>
        </Card>
      </div>

      <Card title="사업장 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">총 {rows.length}개 사업장</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['사업장명', '구분', '주소', '대표 전화', '관리자', '상태'].map((c, i) => <th key={c} className={th(i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className={`${td('center')} text-ink3`}>불러오는 중…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className={`${td('center')} text-ink3`}>등록된 사업장이 없습니다.</td></tr>
            )}
            {rows.map((s0, i) => {
              const s = { ...s0, ...draft[s0.name] };
              const inp = 'w-full rounded-md border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none focus:border-teal';
              return (
                <tr key={s0.name} style={{ background: i % 2 ? '#f7f9fc' : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`}>{s.name}</td>
                  <td className={td('left')}><Pill tone={s.kind === '본점' ? 'info' : s.kind === '제조장' ? 'ok' : 'mute'}>{s.kind}</Pill></td>
                  <td className={`${td('left')} text-ink2`}>{s.addr}</td>
                  <td className={`${td('left')} tabular-nums`}>
                    <input value={s.tel} onChange={(e) => edit(s0.name, { tel: e.target.value })} className={`${inp} tabular-nums`} />
                  </td>
                  <td className={td('left')}>
                    <input value={s.mgr} onChange={(e) => edit(s0.name, { mgr: e.target.value })} className={inp} />
                  </td>
                  <td className={td('center')}>
                    <button onClick={() => edit(s0.name, { active: !s.active })} title="클릭하여 상태 변경">
                      <Pill tone={s.active ? 'ok' : 'mute'}>{s.active ? '사용' : '미사용'}</Pill>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
