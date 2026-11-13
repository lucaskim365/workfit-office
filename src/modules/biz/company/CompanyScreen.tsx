import { useMemo, useState } from 'react';
import { Plus, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Pill';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { bizNoDigits, formatBizNo, type Company } from '@/domain/company/schema';
import { useBankNames, useCompanies, useCompanyAccounts } from '@/features/company/useCompanies';
import { BizEmptyRow, BizHead, BizListCard, BizPager, bizTd, bizTh } from '../_biz';
import { CompanyFormModal } from './CompanyFormModal';
import { CompanyDetailModal } from './CompanyDetailModal';

const EMPTY = { use: '', q: '' };

/** 사업관리 › 기업 정보 — 도입·매입을 가리지 않는 기업 목록·등록·수정, 기업별 계좌. */
export default function CompanyScreen() {
  const { canAction } = usePermission();
  const canCreate = canAction('S_BIZ_VENDOR', 'create');
  const canUpdate = canAction('S_BIZ_VENDOR', 'update');
  const { user } = useAuth();

  const { data: companies = [], isLoading } = useCompanies();
  const { data: accounts = [] } = useCompanyAccounts();
  const bankNames = useBankNames();

  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const accountsOf = useMemo(() => {
    const m = new Map<string, typeof accounts>();
    for (const a of accounts) m.set(a.companyId, [...(m.get(a.companyId) ?? []), a]);
    return m;
  }, [accounts]);

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    const kwDigits = bizNoDigits(applied.q);
    return companies
      .filter((c) => !applied.use || (applied.use === 'Y') === c.use)
      .filter((c) => !kw || c.name.toLowerCase().includes(kw) || (kwDigits.length >= 3 && c.bizNo.includes(kwDigits)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [companies, applied]);

  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const search = () => { setApplied(draft); setPage(1); };
  const reset = () => { setDraft(EMPTY); setApplied(EMPTY); setPage(1); };

  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<{ company: Company | null } | null>(null);
  const detail = companies.find((c) => c.id === detailId) ?? null;

  const defaultAccount = (id: string) => {
    const a = accountsOf.get(id)?.find((x) => x.use && x.isDefault);
    return a ? `${bankNames.get(a.bankCode) ?? ''} ${a.accountNo}`.trim() : '-';
  };

  return (
    <div className="flex flex-col gap-4">
      <BizHead group="기업" title="기업 정보" desc="도입기업·매입기업 등 거래하는 기업의 사업자 정보와 계좌를 관리합니다." />

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-border bg-panel p-4">
        <div className="w-28">
          <Field label="사용 여부">
            <SelectField value={draft.use} onChange={(e) => setDraft({ ...draft, use: e.target.value })} options={[{ value: '', label: '전체' }, { value: 'Y', label: '사용' }, { value: 'N', label: '사용 안 함' }]} />
          </Field>
        </div>
        <div className="min-w-[240px] flex-1">
          <Field label="기업명·사업자등록번호 검색">
            <TextField
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="기업명 또는 사업자등록번호를 입력하세요."
              className="w-full"
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={search}><Search size={13} /> 검색</Button>
          <Button onClick={reset}><RotateCcw size={13} /> 초기화</Button>
          {canCreate && <Button variant="accent" onClick={() => setForm({ company: null })}><Plus size={13} /> 신규 등록</Button>}
        </div>
      </div>

      <BizListCard
        title="기업 목록"
        count={`총 ${rows.length}개 기업`}
        footer={<BizPager total={rows.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {['No.', '기업명', '사업자등록번호', '대표자', '대표번호', '기본 계좌', '사용', '관리'].map((h, i) => (
                <th key={h} className={`${bizTh} ${i === 0 || i >= 6 ? 'text-center' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <BizEmptyRow colSpan={8}>불러오는 중…</BizEmptyRow>}
            {!isLoading && rows.length === 0 && <BizEmptyRow colSpan={8}>{companies.length ? '검색 조건에 맞는 기업이 없습니다.' : '등록된 기업이 없습니다.'}</BizEmptyRow>}
            {pageRows.map((c, i) => (
              <tr key={c.id} onClick={() => setDetailId(c.id)} className="cursor-pointer transition-colors hover:bg-panel-alt/60">
                <td className={`${bizTd} text-center text-ink3`}>{(page - 1) * pageSize + i + 1}</td>
                <td className={`${bizTd} font-bold text-ink`}>{c.name}</td>
                <td className={`${bizTd} font-mono text-ink2`}>{formatBizNo(c.bizNo) || '-'}</td>
                <td className={`${bizTd} text-ink2`}>{c.ceoName || '-'}</td>
                <td className={`${bizTd} text-ink2`}>{c.phone || '-'}</td>
                <td className={`${bizTd} text-ink2`}>{defaultAccount(c.id)}</td>
                <td className={`${bizTd} text-center`}><Pill tone={c.use ? 'ok' : 'mute'}>{c.use ? '사용' : '사용 안 함'}</Pill></td>
                <td className={`${bizTd} text-center`} onClick={(e) => e.stopPropagation()}>
                  {canUpdate ? (
                    <Button size="sm" onClick={() => setForm({ company: c })}>수정</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setDetailId(c.id)}>보기</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BizListCard>

      {detail && !form && (
        <CompanyDetailModal
          company={detail}
          accounts={accountsOf.get(detail.id) ?? []}
          canEdit={canUpdate}
          onEdit={() => setForm({ company: detail })}
          onClose={() => setDetailId(null)}
        />
      )}
      {form && (
        <CompanyFormModal
          key={form.company?.id ?? 'new'}
          company={form.company}
          accounts={form.company ? (accountsOf.get(form.company.id) ?? []) : []}
          allCompanies={companies}
          actorId={user?.id ?? ''}
          onClose={() => setForm(null)}
          onSaved={(c) => { setForm(null); setDetailId(c.id); }}
          onOpenCompany={(id) => { setForm(null); setDetailId(id); }}
        />
      )}
    </div>
  );
}
