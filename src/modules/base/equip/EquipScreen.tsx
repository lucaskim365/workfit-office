import { z } from 'zod';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { CrudListPage, type CrudListConfig } from '@/shared/ui/crud/CrudListPage';

interface Equip {
  id: string;
  code: string;
  name: string;
  line: string;
  type: string;
  maker: string;
  installDate: string;
  status: '가동' | '대기' | '정지' | '점검';
}

const SEED: Equip[] = [
  { id: 'E01', code: 'EQ-PHO05', name: 'Photo 05호기', line: 'A라인', type: '노광기', maker: 'Nikon', installDate: '2022-03-14', status: '가동' },
  { id: 'E02', code: 'EQ-CMP02', name: 'CMP 02호기', line: 'A라인', type: '연마기', maker: 'AMAT', installDate: '2021-11-02', status: '가동' },
  { id: 'E03', code: 'EQ-ETCH01', name: 'Etch 01호기', line: 'A라인', type: '식각기', maker: 'LamResearch', installDate: '2020-07-21', status: '대기' },
  { id: 'E04', code: 'EQ-IMP02', name: 'Implant 02호기', line: 'B라인', type: '이온주입기', maker: 'AMAT', installDate: '2023-01-09', status: '가동' },
  { id: 'E05', code: 'EQ-DEP03', name: 'Depo 03호기', line: 'B라인', type: '증착기', maker: 'TEL', installDate: '2019-09-30', status: '정지' },
  { id: 'E06', code: 'EQ-CLN04', name: 'Clean 04호기', line: 'C라인', type: '세정기', maker: 'SCREEN', installDate: '2022-06-18', status: '가동' },
  { id: 'E07', code: 'EQ-OVEN05', name: 'Thermal 05호기', line: 'C라인', type: '열처리로', maker: 'Koyo', installDate: '2018-12-05', status: '점검' },
];

const STATUS_TONE: Record<Equip['status'], Tone> = { 가동: 'ok', 대기: 'info', 정지: 'warn', 점검: 'mute' };
const LINES = ['A라인', 'B라인', 'C라인'] as const;
const STATUSES = ['가동', '대기', '정지', '점검'] as const;

const schema = z.object({
  code: z.string().min(1, '설비코드를 입력하세요').max(20),
  name: z.string().min(1, '설비명을 입력하세요').max(40),
  line: z.enum(LINES),
  type: z.string().min(1, '설비유형을 입력하세요').max(30),
  maker: z.string().max(30).optional().or(z.literal('')),
  installDate: z.string().max(20).optional().or(z.literal('')),
  status: z.enum(STATUSES),
});
type Form = z.infer<typeof schema>;

const config: CrudListConfig<Equip, typeof schema> = {
  title: '설비정보',
  breadcrumb: '기준 정보 / 마스터 정보',
  seed: SEED,
  rowKey: (r) => r.id,
  searchKeys: ['code', 'name', 'maker'],
  searchPlaceholder: '설비코드·설비명·제조사',
  filters: [
    {
      key: 'line',
      label: '라인',
      options: [{ value: '', label: '전체' }, ...LINES.map((l) => ({ value: l, label: l }))],
    },
    {
      key: 'status',
      label: '상태',
      options: [{ value: '', label: '전체' }, ...STATUSES.map((s) => ({ value: s, label: s }))],
    },
  ],
  columns: [
    { key: 'code', header: '설비코드', mono: true, sortable: true, width: 110 },
    { key: 'name', header: '설비명', sortable: true },
    { key: 'line', header: '라인', align: 'center', sortable: true, width: 80 },
    { key: 'type', header: '설비유형', width: 110 },
    { key: 'maker', header: '제조사', width: 120 },
    { key: 'installDate', header: '설치일', align: 'right', mono: true, sortable: true, width: 110 },
    {
      key: 'status',
      header: '상태',
      align: 'center',
      sortable: true,
      width: 80,
      render: (r) => <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>,
    },
  ],
  schema,
  emptyForm: { code: '', name: '', line: 'A라인', type: '', maker: '', installDate: '', status: '대기' },
  formFields: [
    { name: 'code', label: '설비코드', required: true, placeholder: 'EQ-XXX00' },
    { name: 'name', label: '설비명', required: true },
    { name: 'line', label: '라인', type: 'select', required: true, options: LINES.map((l) => ({ value: l, label: l })) },
    { name: 'type', label: '설비유형', required: true },
    { name: 'maker', label: '제조사' },
    { name: 'installDate', label: '설치일', placeholder: 'YYYY-MM-DD' },
    { name: 'status', label: '상태', type: 'select', required: true, colSpan: 2, options: STATUSES.map((s) => ({ value: s, label: s })) },
  ],
  toEntity: (v: Form, prev?: Equip): Equip => ({
    id: prev?.id ?? `E${Date.now()}`,
    code: v.code,
    name: v.name,
    line: v.line,
    type: v.type,
    maker: v.maker ?? '',
    installDate: v.installDate ?? '',
    status: v.status,
  }),
  toForm: (r: Equip): Form => ({
    code: r.code,
    name: r.name,
    line: r.line as Form['line'],
    type: r.type,
    maker: r.maker,
    installDate: r.installDate,
    status: r.status,
  }),
};

export default function EquipScreen() {
  return <CrudListPage<Equip, typeof schema> {...config} />;
}
