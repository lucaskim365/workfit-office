import { z } from 'zod';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { CrudListPage, type CrudListConfig } from '@/shared/ui/crud/CrudListPage';

interface DefectItem {
  id: string;
  code: string;
  name: string;
  category: '외관' | '치수' | '기능' | '포장';
  process: string;
  severity: '치명' | '중' | '경';
  use: '사용' | '미사용';
}

const SEED: DefectItem[] = [
  { id: 'D01', code: 'LB-1001', name: 'Scratch (스크래치)', category: '외관', process: 'Photo', severity: '중', use: '사용' },
  { id: 'D02', code: 'LB-1002', name: 'Particle (이물)', category: '외관', process: 'Clean', severity: '중', use: '사용' },
  { id: 'D03', code: 'A-2210', name: 'Misalign (정렬불량)', category: '치수', process: 'Implant', severity: '치명', use: '사용' },
  { id: 'D04', code: 'A-0521', name: 'Crack (크랙)', category: '기능', process: 'CMP', severity: '치명', use: '사용' },
  { id: 'D05', code: 'C-3300', name: 'Stain (얼룩)', category: '외관', process: 'Etch', severity: '경', use: '사용' },
  { id: 'D06', code: 'F-7100', name: 'Open/Short (단선)', category: '기능', process: 'Test', severity: '치명', use: '사용' },
  { id: 'D07', code: 'P-9001', name: 'Label 오부착', category: '포장', process: 'Packing', severity: '경', use: '미사용' },
  { id: 'D08', code: 'D-4400', name: '두께 편차', category: '치수', process: 'Depo', severity: '중', use: '사용' },
];

const USE_TONE: Record<DefectItem['use'], Tone> = { 사용: 'ok', 미사용: 'mute' };
const SEV_TONE: Record<DefectItem['severity'], Tone> = { 치명: 'err', 중: 'warn', 경: 'info' };
const CATS = ['외관', '치수', '기능', '포장'] as const;
const SEVS = ['치명', '중', '경'] as const;

const schema = z.object({
  code: z.string().min(1, '불량코드를 입력하세요').max(20),
  name: z.string().min(1, '불량명을 입력하세요').max(40),
  category: z.enum(CATS),
  process: z.string().min(1, '발생공정을 입력하세요').max(30),
  severity: z.enum(SEVS),
  use: z.enum(['사용', '미사용']),
});
type Form = z.infer<typeof schema>;

const config: CrudListConfig<DefectItem, typeof schema> = {
  title: '불량항목정보',
  breadcrumb: '기준 정보 / 마스터 정보',
  seed: SEED,
  rowKey: (r) => r.id,
  searchKeys: ['code', 'name'],
  searchPlaceholder: '불량코드·불량명',
  filters: [
    {
      key: 'category',
      label: '분류',
      options: [{ value: '', label: '전체' }, ...CATS.map((c) => ({ value: c, label: c }))],
    },
    {
      key: 'severity',
      label: '심각도',
      options: [{ value: '', label: '전체' }, ...SEVS.map((s) => ({ value: s, label: s }))],
    },
  ],
  columns: [
    { key: 'code', header: '불량코드', mono: true, sortable: true, width: 100 },
    { key: 'name', header: '불량명', sortable: true },
    {
      key: 'category',
      header: '분류',
      align: 'center',
      sortable: true,
      width: 80,
      render: (r) => <Pill tone="mute">{r.category}</Pill>,
    },
    { key: 'process', header: '발생공정', align: 'center', width: 100 },
    {
      key: 'severity',
      header: '심각도',
      align: 'center',
      sortable: true,
      width: 80,
      render: (r) => (
        <Pill tone={SEV_TONE[r.severity]} solid={r.severity === '치명'}>
          {r.severity}
        </Pill>
      ),
    },
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
  emptyForm: { code: '', name: '', category: '외관', process: '', severity: '중', use: '사용' },
  formFields: [
    { name: 'code', label: '불량코드', required: true, placeholder: 'XX-0000' },
    { name: 'name', label: '불량명', required: true },
    { name: 'category', label: '분류', type: 'select', required: true, options: CATS.map((c) => ({ value: c, label: c })) },
    { name: 'severity', label: '심각도', type: 'select', required: true, options: SEVS.map((s) => ({ value: s, label: s })) },
    { name: 'process', label: '발생공정', required: true },
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
  toEntity: (v: Form, prev?: DefectItem): DefectItem => ({ id: prev?.id ?? `D${Date.now()}`, ...v }),
  toForm: (r: DefectItem): Form => ({
    code: r.code,
    name: r.name,
    category: r.category,
    process: r.process,
    severity: r.severity,
    use: r.use,
  }),
};

export default function DefectScreen() {
  return <CrudListPage<DefectItem, typeof schema> {...config} />;
}
