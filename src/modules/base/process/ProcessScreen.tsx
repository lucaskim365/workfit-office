import { z } from 'zod';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { CrudListPage, type CrudListConfig } from '@/shared/ui/crud/CrudListPage';

interface Process {
  id: string;
  code: string;
  name: string;
  type: '가공' | '조립' | '검사' | '포장';
  workcenter: string;
  standardTime: string;
  use: '사용' | '미사용';
}

const SEED: Process[] = [
  { id: 'P01', code: 'OP-010', name: '원자재 정밀 절단', type: '가공', workcenter: 'WC-CUT', standardTime: '45', use: '사용' },
  { id: 'P02', code: 'OP-020', name: 'CNC 가공', type: '가공', workcenter: 'WC-CNC', standardTime: '120', use: '사용' },
  { id: 'P03', code: 'OP-030', name: 'SMT 실장', type: '조립', workcenter: 'WC-SMT', standardTime: '90', use: '사용' },
  { id: 'P04', code: 'OP-040', name: '수삽 조립', type: '조립', workcenter: 'WC-ASSY', standardTime: '150', use: '사용' },
  { id: 'P05', code: 'OP-050', name: 'AOI 검사', type: '검사', workcenter: 'WC-AOI', standardTime: '30', use: '사용' },
  { id: 'P06', code: 'OP-060', name: '기능 검사', type: '검사', workcenter: 'WC-FCT', standardTime: '60', use: '사용' },
  { id: 'P07', code: 'OP-070', name: '최종 포장', type: '포장', workcenter: 'WC-PACK', standardTime: '40', use: '사용' },
  { id: 'P08', code: 'OP-025', name: '버 제거(디버링)', type: '가공', workcenter: 'WC-CNC', standardTime: '25', use: '미사용' },
];

const USE_TONE: Record<Process['use'], Tone> = { 사용: 'ok', 미사용: 'mute' };
const TYPE_TONE: Record<Process['type'], Tone> = { 가공: 'info', 조립: 'warn', 검사: 'ok', 포장: 'mute' };
const TYPES = ['가공', '조립', '검사', '포장'] as const;

const schema = z.object({
  code: z.string().min(1, '공정코드를 입력하세요').max(20),
  name: z.string().min(1, '공정명을 입력하세요').max(40),
  type: z.enum(TYPES),
  workcenter: z.string().min(1, '작업장을 입력하세요').max(20),
  standardTime: z.string().max(10).optional().or(z.literal('')),
  use: z.enum(['사용', '미사용']),
});
type Form = z.infer<typeof schema>;

const config: CrudListConfig<Process, typeof schema> = {
  title: '공정등록',
  breadcrumb: '기준 정보 / 공정 정보',
  seed: SEED,
  rowKey: (r) => r.id,
  searchKeys: ['code', 'name', 'workcenter'],
  searchPlaceholder: '공정코드·공정명·작업장',
  filters: [
    {
      key: 'type',
      label: '공정구분',
      width: 120,
      options: [{ value: '', label: '전체' }, ...TYPES.map((t) => ({ value: t, label: t }))],
    },
    {
      key: 'use',
      label: '사용여부',
      options: [
        { value: '', label: '전체' },
        { value: '사용', label: '사용' },
        { value: '미사용', label: '미사용' },
      ],
    },
  ],
  columns: [
    { key: 'code', header: '공정코드', mono: true, sortable: true, width: 100 },
    { key: 'name', header: '공정명', sortable: true },
    {
      key: 'type',
      header: '구분',
      align: 'center',
      sortable: true,
      width: 80,
      render: (r) => <Pill tone={TYPE_TONE[r.type]}>{r.type}</Pill>,
    },
    { key: 'workcenter', header: '작업장', align: 'center', mono: true, width: 100 },
    { key: 'standardTime', header: '표준시간(초)', align: 'right', mono: true, sortable: true, width: 110 },
    {
      key: 'use',
      header: '사용',
      align: 'center',
      sortable: true,
      width: 80,
      render: (r) => <Pill tone={USE_TONE[r.use]}>{r.use}</Pill>,
    },
  ],
  schema,
  emptyForm: { code: '', name: '', type: '가공', workcenter: '', standardTime: '', use: '사용' },
  formFields: [
    { name: 'code', label: '공정코드', required: true, placeholder: 'OP-000' },
    { name: 'name', label: '공정명', required: true },
    { name: 'type', label: '공정구분', type: 'select', required: true, options: TYPES.map((t) => ({ value: t, label: t })) },
    { name: 'workcenter', label: '작업장', required: true, placeholder: 'WC-XXX' },
    { name: 'standardTime', label: '표준시간(초)', placeholder: '0' },
    {
      name: 'use',
      label: '사용여부',
      type: 'select',
      required: true,
      options: [
        { value: '사용', label: '사용' },
        { value: '미사용', label: '미사용' },
      ],
    },
  ],
  toEntity: (v: Form, prev?: Process): Process => ({
    id: prev?.id ?? `P${Date.now()}`,
    code: v.code,
    name: v.name,
    type: v.type,
    workcenter: v.workcenter,
    standardTime: v.standardTime ?? '',
    use: v.use,
  }),
  toForm: (r: Process): Form => ({
    code: r.code,
    name: r.name,
    type: r.type,
    workcenter: r.workcenter,
    standardTime: r.standardTime,
    use: r.use,
  }),
};

export default function ProcessScreen() {
  return <CrudListPage<Process, typeof schema> {...config} />;
}
