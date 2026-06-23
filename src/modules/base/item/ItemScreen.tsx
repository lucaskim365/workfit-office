import { z } from 'zod';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { CrudListPage, type CrudListConfig } from '@/shared/ui/crud/CrudListPage';

interface Item {
  id: string;
  code: string;
  name: string;
  spec: string;
  unit: string;
  type: '원자재' | '부자재' | '반제품' | '완제품';
  safetyStock: string;
  status: '사용' | '미사용';
}

const SEED: Item[] = [
  { id: 'I01', code: 'AP-09-PRO', name: '메인보드 Assy', spec: '12-Layer / FR4', unit: 'EA', type: '완제품', safetyStock: '500', status: '사용' },
  { id: 'I02', code: 'BR-44-LITE', name: '브래킷 모듈', spec: 'AL6061 / T5', unit: 'EA', type: '반제품', safetyStock: '1,200', status: '사용' },
  { id: 'I03', code: 'SM-77-CABLE', name: '신호 케이블', spec: 'AWG24 / 1.5m', unit: 'EA', type: '반제품', safetyStock: '2,000', status: '사용' },
  { id: 'I04', code: 'RM-FR4-001', name: 'FR4 원판', spec: '1.6T / 1m×1m', unit: 'SHT', type: '원자재', safetyStock: '300', status: '사용' },
  { id: 'I05', code: 'RM-CU-220', name: '동박 Roll', spec: '35um / 520mm', unit: 'ROLL', type: '원자재', safetyStock: '80', status: '사용' },
  { id: 'I06', code: 'SP-SOL-014', name: '솔더 페이스트', spec: 'SAC305 / 500g', unit: 'EA', type: '부자재', safetyStock: '120', status: '사용' },
  { id: 'I07', code: 'SP-FLX-002', name: '플럭스', spec: 'No-Clean / 1L', unit: 'EA', type: '부자재', safetyStock: '60', status: '미사용' },
  { id: 'I08', code: 'AP-12-STD', name: '컨트롤 보드', spec: '8-Layer / FR4', unit: 'EA', type: '완제품', safetyStock: '400', status: '사용' },
];

const STATUS_TONE: Record<Item['status'], Tone> = { 사용: 'ok', 미사용: 'mute' };
const TYPE_TONE: Record<Item['type'], Tone> = { 원자재: 'info', 부자재: 'mute', 반제품: 'warn', 완제품: 'ok' };

const TYPES = ['원자재', '부자재', '반제품', '완제품'] as const;

const schema = z.object({
  code: z.string().min(1, '품번을 입력하세요').max(30),
  name: z.string().min(1, '품명을 입력하세요').max(40),
  spec: z.string().max(40).optional().or(z.literal('')),
  unit: z.string().min(1, '단위를 입력하세요').max(10),
  type: z.enum(TYPES),
  safetyStock: z.string().max(15).optional().or(z.literal('')),
  status: z.enum(['사용', '미사용']),
});
type Form = z.infer<typeof schema>;

const config: CrudListConfig<Item, typeof schema> = {
  title: '품목정보',
  breadcrumb: '기준 정보 / 마스터 정보',
  seed: SEED,
  rowKey: (r) => r.id,
  searchKeys: ['code', 'name'],
  searchPlaceholder: '품번·품명',
  filters: [
    {
      key: 'type',
      label: '품목구분',
      width: 120,
      options: [{ value: '', label: '전체' }, ...TYPES.map((t) => ({ value: t, label: t }))],
    },
    {
      key: 'status',
      label: '상태',
      options: [
        { value: '', label: '전체' },
        { value: '사용', label: '사용' },
        { value: '미사용', label: '미사용' },
      ],
    },
  ],
  columns: [
    { key: 'code', header: '품번', mono: true, sortable: true, width: 120 },
    { key: 'name', header: '품명', sortable: true },
    { key: 'spec', header: '규격', width: 150 },
    { key: 'unit', header: '단위', align: 'center', width: 70 },
    {
      key: 'type',
      header: '구분',
      align: 'center',
      sortable: true,
      width: 80,
      render: (r) => <Pill tone={TYPE_TONE[r.type]}>{r.type}</Pill>,
    },
    { key: 'safetyStock', header: '안전재고', align: 'right', mono: true, sortable: true, width: 90 },
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
  emptyForm: { code: '', name: '', spec: '', unit: 'EA', type: '완제품', safetyStock: '', status: '사용' },
  formFields: [
    { name: 'code', label: '품번', required: true, placeholder: 'AP-00-XXX' },
    { name: 'name', label: '품명', required: true },
    { name: 'spec', label: '규격', colSpan: 2 },
    { name: 'unit', label: '단위', required: true, placeholder: 'EA' },
    { name: 'safetyStock', label: '안전재고', placeholder: '0' },
    {
      name: 'type',
      label: '품목구분',
      type: 'select',
      required: true,
      options: TYPES.map((t) => ({ value: t, label: t })),
    },
    {
      name: 'status',
      label: '상태',
      type: 'select',
      required: true,
      options: [
        { value: '사용', label: '사용' },
        { value: '미사용', label: '미사용' },
      ],
    },
  ],
  toEntity: (v: Form, prev?: Item): Item => ({
    id: prev?.id ?? `I${Date.now()}`,
    code: v.code,
    name: v.name,
    spec: v.spec ?? '',
    unit: v.unit,
    type: v.type,
    safetyStock: v.safetyStock ?? '',
    status: v.status,
  }),
  toForm: (r: Item): Form => ({
    code: r.code,
    name: r.name,
    spec: r.spec,
    unit: r.unit,
    type: r.type,
    safetyStock: r.safetyStock,
    status: r.status,
  }),
};

export default function ItemScreen() {
  return <CrudListPage<Item, typeof schema> {...config} />;
}
