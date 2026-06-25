import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { Toggle } from '@/shared/ui/Toggle';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { useCompanyInfo, useSaveCompanyInfo, useUploadCompanyLogo } from '@/features/companyInfo/useCompanyInfo';
import type { CompanyInfo } from '@/domain/companyInfo/schema';
import { useCompanySites, useSaveCompanySite, useRemoveCompanySite } from '@/features/companySite/useCompanySites';
import type { CompanySite } from '@/domain/companySite/schema';

/** 사업장 구분 선택지 — 추가/인라인 편집 공용. */
const SITE_KINDS = ['본점', '제조장', '물류장', '영업소', '기타'] as const;
/** 사업장 표 셀 입력/선택 공통 스타일(컴팩트). */
const CELL = 'w-full rounded-md border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none focus:border-teal';

/** 라벨(좌) + 입력(우) 행 — 회사정보 폼 공통. compact: 2단 배치용(라벨 폭 자동·간격 확보). */
function FRow({ label, required, children, multiline, compact }: { label: string; required?: boolean; children: ReactNode; multiline?: boolean; compact?: boolean }) {
  return (
    <div className={`grid ${compact ? 'grid-cols-[auto_1fr] gap-2.5' : 'grid-cols-[112px_1fr] gap-3.5'} ${multiline ? 'items-start' : 'items-center'}`}>
      <span className={`whitespace-nowrap text-[12px] font-bold text-ink2 ${multiline ? 'pt-2' : ''}`}>
        {label}{required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </div>
  );
}

/** 자동저장 상태 표시 — 저장 버튼을 대체. 변경 시 디바운스 후 자동 반영됨을 안내. */
function SaveStatus({ pending, dirty }: { pending: boolean; dirty: boolean }) {
  const [text, tone, dot] =
    pending ? ['저장 중…', 'text-teal', 'bg-teal animate-pulse']
    : dirty ? ['변경됨 · 곧 저장', 'text-ink3', 'bg-amber-400']
    : ['모든 변경 저장됨', 'text-ink3', 'bg-emerald-500'];
  return (
    <div className="flex items-center gap-2 text-[11.5px] font-bold">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className={tone}>{text}</span>
    </div>
  );
}

const AL = { left: 'text-left', center: 'text-center' } as const;
const th = (al: keyof typeof AL) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: keyof typeof AL) => `border-b border-border px-3 py-2.5 ${AL[al]}`;

/** 회사 정보 — 시스템 관리 / 회사 기준정보(법인·사업장·표기) 관리. */
export default function CompanyScreen() {
  // 기본정보(싱글톤) — Firestore 로드분을 폼 state로 복제, 편집 후 저장 시 영구 반영.
  const { data: info } = useCompanyInfo();
  const saveInfo = useSaveCompanyInfo();
  const [form, setForm] = useState<CompanyInfo | null>(null);
  useEffect(() => { if (info) setForm(info); }, [info]);
  const set = <K extends keyof CompanyInfo>(k: K, v: CompanyInfo[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));
  const infoDirty = !!form && !!info && JSON.stringify(form) !== JSON.stringify(info);

  // 회사 로고 업로드 — 이미지는 Storage, 결과 URL·경로는 폼에 반영(자동저장이 Firestore에 영구화).
  const uploadLogo = useUploadCompanyLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!f) return;
    if (!f.type.startsWith('image/')) { alert('이미지 파일만 업로드할 수 있습니다.'); return; }
    if (f.size > 5 * 1024 * 1024) { alert('5MB 이하 이미지만 업로드할 수 있습니다.'); return; }
    uploadLogo.mutate(
      { file: f, prevPath: form?.logoPath || undefined },
      {
        onSuccess: ({ url, path }) => setForm((f0) => (f0 ? { ...f0, logoUrl: url, logoPath: path } : f0)),
        onError: () => alert('로고 업로드에 실패했습니다. 네트워크·Storage 설정을 확인하세요.'),
      },
    );
  };
  const onRemoveLogo = () => setForm((f0) => (f0 ? { ...f0, logoUrl: '', logoPath: '' } : f0));

  // 사업장 인라인 편집 — name(PK)별로 변경분을 draft에 보관, 저장 시 Firestore로 영구 반영.
  const { data: sites, isLoading } = useCompanySites();
  const saveSite = useSaveCompanySite();
  const removeSite = useRemoveCompanySite();
  const rows = sites ?? [];
  const [draft, setDraft] = useState<Record<string, Partial<CompanySite>>>({});
  const edit = (name: string, patch: Partial<CompanySite>) =>
    setDraft((d) => ({ ...d, [name]: { ...d[name], ...patch } }));
  const sitesDirty = Object.keys(draft).length > 0;

  // 사업장 추가 — 신규 행 입력 폼(이름이 PK라 추가는 명시 버튼으로 처리, 인라인 자동저장과 분리).
  const [adding, setAdding] = useState(false);
  const [neu, setNeu] = useState<Partial<CompanySite>>({ kind: '제조장', active: true });
  const onAdd = () => {
    const name = (neu.name ?? '').trim();
    if (!name) { alert('사업장명을 입력하세요.'); return; }
    if (rows.some((r) => r.name === name)) { alert('이미 존재하는 사업장명입니다.'); return; }
    saveSite.mutate({
      name, kind: neu.kind || '기타', addr: neu.addr ?? '',
      tel: neu.tel ?? '', mgr: neu.mgr ?? '', active: neu.active ?? true,
    });
    setNeu({ kind: '제조장', active: true });
    setAdding(false);
  };
  const onRemove = (name: string) => {
    if (!window.confirm(`'${name}' 사업장을 삭제하시겠습니까?\n삭제 후 되돌릴 수 없습니다.`)) return;
    setDraft((d) => { const next = { ...d }; delete next[name]; return next; });
    removeSite.mutate(name);
  };

  const dirty = infoDirty || sitesDirty;
  const pending = saveInfo.isPending || saveSite.isPending || removeSite.isPending;

  // 자동저장 — 기본정보: 입력이 멈춘 뒤(700ms) 변경분을 Firestore로 반영.
  // 저장 성공 시 info가 form과 같아져 effect가 재저장하지 않음(루프 없음).
  useEffect(() => {
    if (!form || !info || !infoDirty) return;
    const t = setTimeout(() => saveInfo.mutate(form), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, info, infoDirty]);

  // 자동저장 — 사업장 표: 편집이 멈춘 뒤(700ms) 변경 행만 반영 후 draft 비움.
  useEffect(() => {
    if (!sitesDirty) return;
    const t = setTimeout(() => {
      rows.forEach((s) => { if (draft[s.name]) saveSite.mutate({ ...s, ...draft[s.name] }); });
      setDraft({});
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, sitesDirty]);

  // 폼 로드 전(초기 1프레임)엔 빈 값으로 렌더 — 값 헬퍼.
  const v = (k: keyof CompanyInfo) => (form?.[k] ?? '') as string;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">회사 정보</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 회사 정보</p>
        </div>
        <SaveStatus pending={pending} dirty={dirty} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <Card title="기본 정보">
          <div className="flex flex-col gap-3">
            <FRow label="회사명" required><TextField value={v('name')} onChange={(e) => set('name', e.target.value)} /></FRow>
            <FRow label="영문 회사명"><TextField value={v('nameEn')} onChange={(e) => set('nameEn', e.target.value)} /></FRow>
            <FRow label="사업자등록번호"><TextField value={v('bizNo')} onChange={(e) => set('bizNo', e.target.value)} className="font-mono tabular-nums" /></FRow>
            <FRow label="법인등록번호"><TextField value={v('corpNo')} onChange={(e) => set('corpNo', e.target.value)} className="font-mono tabular-nums" /></FRow>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <FRow label="대표자" required compact><TextField value={v('ceo')} onChange={(e) => set('ceo', e.target.value)} /></FRow>
              <FRow label="설립일" compact><TextField value={v('foundedDate')} onChange={(e) => set('foundedDate', e.target.value)} className="tabular-nums" /></FRow>
            </div>
          </div>
        </Card>

        <Card title="업종 / 분류">
          <div className="flex flex-col gap-3">
            <FRow label="업태"><TextField value={v('bizType')} onChange={(e) => set('bizType', e.target.value)} /></FRow>
            <FRow label="종목"><TextField value={v('bizItem')} onChange={(e) => set('bizItem', e.target.value)} /></FRow>
            <FRow label="회사 구분">
              <SelectField value={v('companyType')} onChange={(e) => set('companyType', e.target.value as CompanyInfo['companyType'])} options={[{ value: '법인', label: '법인사업자' }, { value: '개인', label: '개인사업자' }]} />
            </FRow>
            <FRow label="회계연도 시작">
              <SelectField value={v('fiscalStart')} onChange={(e) => set('fiscalStart', e.target.value)} options={[{ value: '1', label: '1월' }, { value: '3', label: '3월' }, { value: '4', label: '4월' }]} />
            </FRow>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div><div className="text-[12.5px] font-bold text-ink">사용 여부</div><div className="mt-0.5 text-[10.5px] text-ink3">미사용 시 신규 전표 발행 제한</div></div>
              <Toggle on={form?.active ?? true} onChange={(b) => set('active', b)} />
            </div>
          </div>
        </Card>

        <Card title="연락처 / 주소">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <FRow label="대표 전화" compact><TextField value={v('tel')} onChange={(e) => set('tel', e.target.value)} className="tabular-nums" /></FRow>
              <FRow label="팩스" compact><TextField value={v('fax')} onChange={(e) => set('fax', e.target.value)} className="tabular-nums" /></FRow>
            </div>
            <FRow label="대표 이메일"><TextField value={v('email')} onChange={(e) => set('email', e.target.value)} /></FRow>
            <FRow label="홈페이지"><TextField value={v('homepage')} onChange={(e) => set('homepage', e.target.value)} /></FRow>
            <FRow label="본사 주소" multiline>
              <textarea value={v('address')} onChange={(e) => set('address', e.target.value)} rows={2}
                className="resize-none rounded-md border border-border-hi bg-panel px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none transition-colors focus:border-teal" />
            </FRow>
          </div>
        </Card>

        <Card title="시스템 표기 / 문서">
          <div className="flex flex-col gap-3">
            <FRow label="시스템 표기명"><TextField value={v('sysName')} onChange={(e) => set('sysName', e.target.value)} /></FRow>
            <FRow label="보고서 머리말"><TextField value={v('reportHeader')} onChange={(e) => set('reportHeader', e.target.value)} /></FRow>
            <FRow label="문서 푸터"><TextField value={v('docFooter')} onChange={(e) => set('docFooter', e.target.value)} /></FRow>
            <FRow label="회사 로고" multiline>
              <div className="flex items-center gap-3">
                <div className="grid h-[52px] w-[120px] place-items-center overflow-hidden rounded-md border border-dashed border-border-hi bg-panel-alt text-[11px] font-bold text-ink3">
                  {form?.logoUrl
                    ? <img src={form.logoUrl} alt="회사 로고" className="h-full w-full object-contain" />
                    : 'LOGO'}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadLogo.isPending}
                      className="rounded-md border border-border-hi bg-panel px-2.5 py-1 text-[11px] font-bold text-ink transition-colors hover:bg-panel-alt disabled:opacity-50"
                    >
                      {uploadLogo.isPending ? '업로드 중…' : form?.logoUrl ? '변경' : '이미지 선택'}
                    </button>
                    {form?.logoUrl && !uploadLogo.isPending && (
                      <button
                        type="button"
                        onClick={onRemoveLogo}
                        className="rounded-md border border-border-hi px-2.5 py-1 text-[11px] font-bold text-danger transition-colors hover:border-danger hover:bg-danger/10"
                      >
                        제거
                      </button>
                    )}
                  </div>
                  <span className="text-[10.5px] text-ink3">PNG · 권장 240×80px · 5MB 이하<br />보고서·로그인 화면에 사용</span>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickLogo} className="hidden" />
              </div>
            </FRow>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div><div className="text-[12.5px] font-bold text-ink">민감정보 마스킹</div><div className="mt-0.5 text-[10.5px] text-ink3">사업자번호·연락처 마스킹 표기</div></div>
              <Toggle on={form?.mask ?? true} onChange={(b) => set('mask', b)} />
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="사업장 현황"
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-2.5">
            <span className="text-[10.5px] text-ink3">총 {rows.length}개 사업장</span>
            {!adding && (
              <button onClick={() => setAdding(true)}
                className="rounded-md border border-teal bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal transition-colors hover:bg-teal/20">
                + 사업장 추가
              </button>
            )}
          </div>
        }
      >
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['사업장명', '구분', '주소', '대표 전화', '관리자', '상태', '관리'].map((c, i) => <th key={c} className={th(i >= 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className={`${td('center')} text-ink3`}>불러오는 중…</td></tr>
            )}
            {!isLoading && rows.length === 0 && !adding && (
              <tr><td colSpan={7} className={`${td('center')} text-ink3`}>등록된 사업장이 없습니다.</td></tr>
            )}
            {rows.map((s0, i) => {
              const s = { ...s0, ...draft[s0.name] };
              return (
                <tr key={s0.name} style={{ background: i % 2 ? '#f7f9fc' : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`}>{s.name}</td>
                  <td className={td('left')}>
                    <select value={s.kind} onChange={(e) => edit(s0.name, { kind: e.target.value })} className={CELL}>
                      {SITE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </td>
                  <td className={td('left')}>
                    <input value={s.addr} onChange={(e) => edit(s0.name, { addr: e.target.value })} className={CELL} />
                  </td>
                  <td className={`${td('left')} tabular-nums`}>
                    <input value={s.tel} onChange={(e) => edit(s0.name, { tel: e.target.value })} className={`${CELL} tabular-nums`} />
                  </td>
                  <td className={td('left')}>
                    <input value={s.mgr} onChange={(e) => edit(s0.name, { mgr: e.target.value })} className={CELL} />
                  </td>
                  <td className={td('center')}>
                    <button onClick={() => edit(s0.name, { active: !s.active })} title="클릭하여 상태 변경">
                      <Pill tone={s.active ? 'ok' : 'mute'}>{s.active ? '사용' : '미사용'}</Pill>
                    </button>
                  </td>
                  <td className={td('center')}>
                    <button onClick={() => onRemove(s0.name)} title="사업장 삭제"
                      className="rounded-md border border-border-hi px-2 py-1 text-[11px] font-bold text-danger transition-colors hover:border-danger hover:bg-danger/10">
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            {adding && (
              <tr className="bg-teal/5">
                <td className={td('left')}>
                  <input autoFocus value={neu.name ?? ''} onChange={(e) => setNeu((n) => ({ ...n, name: e.target.value }))}
                    placeholder="사업장명*" className={CELL} />
                </td>
                <td className={td('left')}>
                  <select value={neu.kind ?? '제조장'} onChange={(e) => setNeu((n) => ({ ...n, kind: e.target.value }))} className={CELL}>
                    {SITE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </td>
                <td className={td('left')}>
                  <input value={neu.addr ?? ''} onChange={(e) => setNeu((n) => ({ ...n, addr: e.target.value }))}
                    placeholder="주소" className={CELL} />
                </td>
                <td className={td('left')}>
                  <input value={neu.tel ?? ''} onChange={(e) => setNeu((n) => ({ ...n, tel: e.target.value }))}
                    placeholder="대표 전화" className={`${CELL} tabular-nums`} />
                </td>
                <td className={td('left')}>
                  <input value={neu.mgr ?? ''} onChange={(e) => setNeu((n) => ({ ...n, mgr: e.target.value }))}
                    placeholder="관리자" className={CELL} />
                </td>
                <td className={td('center')}>
                  <button onClick={() => setNeu((n) => ({ ...n, active: !(n.active ?? true) }))} title="클릭하여 상태 변경">
                    <Pill tone={(neu.active ?? true) ? 'ok' : 'mute'}>{(neu.active ?? true) ? '사용' : '미사용'}</Pill>
                  </button>
                </td>
                <td className={td('center')}>
                  <div className="flex items-center justify-center gap-1.5">
                    <button onClick={onAdd}
                      className="rounded-md border border-teal bg-teal/10 px-2 py-1 text-[11px] font-bold text-teal transition-colors hover:bg-teal/20">추가</button>
                    <button onClick={() => { setAdding(false); setNeu({ kind: '제조장', active: true }); }}
                      className="rounded-md border border-border-hi px-2 py-1 text-[11px] font-bold text-ink3 transition-colors hover:bg-panel-alt">취소</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
