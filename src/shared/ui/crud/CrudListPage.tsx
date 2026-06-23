import { useMemo, useState } from 'react';
import { z } from 'zod';
import type { DefaultValues } from 'react-hook-form';
import { Card } from '@/shared/ui/Card';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { CrudFormModal, type FormFieldConfig } from './CrudFormModal';

export interface SelectFilter {
  /** 엔티티 필드 키(정확히 일치 비교). */
  key: string;
  label: string;
  options: Option[];
  width?: number;
}

export interface CrudListConfig<T, S extends z.ZodType> {
  title: string;
  breadcrumb: string;
  seed: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  /** 셀렉트 필터(정확 일치). */
  filters?: SelectFilter[];
  /** 키워드 검색 대상 필드. */
  searchKeys?: Array<keyof T & string>;
  searchPlaceholder?: string;
  pageSize?: number;
  // 폼
  schema: S;
  formFields: FormFieldConfig<z.infer<S>>[];
  emptyForm: DefaultValues<z.infer<S>>;
  formWidth?: number;
  /** 폼 값 → 엔티티 (id/기본값 부여). prev가 있으면 수정. */
  toEntity: (values: z.infer<S>, prev?: T) => T;
  /** 엔티티 → 폼 값 (수정 시 초기화). */
  toForm: (row: T) => z.infer<S>;
}

/**
 * 설정 기반 제네릭 CRUD 목록 화면.
 * 헤더 + 필터바 + 카드(툴바) + DataTable + 폼 모달을 한 번에 제공한다.
 * 각 화면은 CrudListConfig 만 정의하면 된다.
 */
export function CrudListPage<T, S extends z.ZodType>(config: CrudListConfig<T, S>) {
  const {
    title,
    breadcrumb,
    seed,
    rowKey,
    columns,
    filters = [],
    searchKeys = [],
    searchPlaceholder = '검색어',
    pageSize = 10,
    schema,
    formFields,
    emptyForm,
    formWidth,
    toEntity,
    toForm,
  } = config;

  const [list, setList] = useState<T[]>(seed);
  const emptyFilterState = useMemo(() => {
    const s: Record<string, string> = { __q__: '' };
    filters.forEach((f) => (s[f.key] = ''));
    return s;
  }, [filters]);
  const [draft, setDraft] = useState<Record<string, string>>(emptyFilterState);
  const [applied, setApplied] = useState<Record<string, string>>(emptyFilterState);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [editing, setEditing] = useState<T | null | undefined>(undefined);

  const rows = useMemo(() => {
    const kw = (applied.__q__ ?? '').trim().toLowerCase();
    return list.filter((row) => {
      const rec = row as Record<string, unknown>;
      for (const f of filters) {
        if (applied[f.key] && String(rec[f.key]) !== applied[f.key]) return false;
      }
      if (kw && searchKeys.length > 0) {
        const hit = searchKeys.some((k) => String(rec[k] ?? '').toLowerCase().includes(kw));
        if (!hit) return false;
      }
      return true;
    });
  }, [list, applied, filters, searchKeys]);

  const handleSubmit = (values: z.infer<S>) => {
    if (editing) {
      const prev = editing;
      const updated = toEntity(values, prev);
      const key = rowKey(prev);
      setList((p) => p.map((r) => (rowKey(r) === key ? updated : r)));
    } else {
      setList((p) => [toEntity(values), ...p]);
    }
  };

  const handleDelete = () => {
    if (selected.length === 0) return;
    setList((p) => p.filter((r) => !selected.includes(rowKey(r))));
    setSelected([]);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-0.5 text-xs text-ink3">{breadcrumb}</p>
        </div>
        <ActionBar actions={['refresh', 'upload', 'download']} />
      </div>

      {(filters.length > 0 || searchKeys.length > 0) && (
        <FilterBar onSearch={() => setApplied(draft)}>
          {filters.map((f) => (
            <FilterField key={f.key} label={f.label}>
              <Select
                value={draft[f.key] ?? ''}
                onChange={(v) => setDraft({ ...draft, [f.key]: v })}
                options={f.options}
                width={f.width ?? 130}
              />
            </FilterField>
          ))}
          {searchKeys.length > 0 && (
            <FilterField label="검색어">
              <TextInput
                value={draft.__q__ ?? ''}
                onChange={(v) => setDraft({ ...draft, __q__: v })}
                placeholder={searchPlaceholder}
                width={220}
                onEnter={() => setApplied(draft)}
              />
            </FilterField>
          )}
        </FilterBar>
      )}

      <Card
        title="목록"
        action={
          <ActionBar
            actions={[
              { preset: 'delete', onClick: handleDelete, disabled: selected.length === 0 },
              { preset: 'add', label: '추가', variant: 'primary', onClick: () => setEditing(null) },
            ]}
          />
        }
        bodyClassName="p-3"
      >
        {selected.length > 0 && (
          <div className="mb-2 flex items-center gap-3 rounded-md bg-teal-soft px-3 py-2 text-[11.5px] text-navy">
            <b>{selected.length}</b>건 선택됨
            <button
              className="font-semibold underline-offset-2 hover:underline"
              onClick={() => setSelected([])}
            >
              선택 해제
            </button>
          </div>
        )}
        <DataTable<T>
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          pageSize={pageSize}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onRowClick={(r) => setEditing(r)}
        />
      </Card>

      <CrudFormModal<S>
        open={editing !== undefined}
        titleAdd={`${title} 추가`}
        titleEdit={`${title} 수정`}
        schema={schema}
        fields={formFields}
        empty={emptyForm}
        initial={editing ? toForm(editing) : null}
        width={formWidth}
        onClose={() => setEditing(undefined)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
