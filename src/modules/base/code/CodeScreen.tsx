import { z } from 'zod';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { CrudListPage, type CrudListConfig } from '@/shared/ui/crud/CrudListPage';

interface CommonCode {
  id: string;
  group: string;
  groupName: string;
  code: string;
  name: string;
  sortOrder: string;
  use: '사용' | '미사용';
}

const SEED: CommonCode[] = [
  { id: 'C01', group: 'EQ_STATUS', groupName: '설비상태', code: 'RUN', name: '가동', sortOrder: '10', use: '사용' },
  { id: 'C02', group: 'EQ_STATUS', groupName: '설비상태', code: 'IDLE', name: '대기', sortOrder: '20', use: '사용' },
  { id: 'C03', group: 'EQ_STATUS', groupName: '설비상태', code: 'STOP', name: '정지', sortOrder: '30', use: '사용' },
  { id: 'C04', group: 'EQ_STATUS', groupName: '설비상태', code: 'MNT', name: '점검', sortOrder: '40', use: '사용' },
  { id: 'C05', group: 'WO_STATUS', groupName: '작업지시상태', code: 'WAIT', name: '대기', sortOrder: '10', use: '사용' },
  { id: 'C06', group: 'WO_STATUS', groupName: '작업지시상태', code: 'RUN', name: '진행', sortOrder: '20', use: '사용' },
  { id: 'C07', group: 'WO_STATUS', groupName: '작업지시상태', code: 'DONE', name: '완료', sortOrder: '30', use: '사용' },
  { id: 'C08', group: 'UNIT', groupName: '단위', code: 'EA', name: '개', sortOrder: '10', use: '사용' },
  { id: 'C09', group: 'UNIT', groupName: '단위', code: 'KG', name: '킬로그램', sortOrder: '20', use: '사용' },
  { id: 'C10', group: 'UNIT', groupName: '단위', code: 'BOX', name: '박스', sortOrder: '30', use: '미사용' },
];

const USE_TONE: Record<CommonCode['use'], Tone> = { 사용: 'ok', 미사용: 'mute' };
const GROUPS = ['EQ_STATUS', 'WO_STATUS', 'UNIT'] as const;

const schema = z.object({
  group: z.string().min(1, '코드그룹을 입력하세요').max(30),
  groupName: z.string().min(1, '그룹명을 입력하세요').max(40),
  code: z.string().min(1, '코드를 입력하세요').max(20),
  name: z.string().min(1, '코드명을 입력하세요').max(40),
  sortOrder: z.string().max(10).optional().or(z.literal('')),
  use: z.enum(['사용', '미사용']),
});
type Form = z.infer<typeof schema>;

const config: CrudListConfig<CommonCode, typeof schema> = {
  title: '공통코드정보',
  breadcrumb: '기준 정보 / 마스터 정보',
  seed: SEED,
  rowKey: (r) => r.id,
  searchKeys: ['group', 'code', 'name'],
  searchPlaceholder: '그룹·코드·코드명',
  filters: [
    {
      key: 'group',
      label: '코드그룹',
      width: 150,
      options: [{ value: '', label: '전체' }, ...GROUPS.map((g) => ({ value: g, label: g }))],
    },
  ],
  columns: [
    { key: 'group', header: '코드그룹', mono: true, sortable: true, width: 130 },
    { key: 'groupName', header: '그룹명', width: 140 },
    { key: 'code', header: '코드', mono: true, align: 'center', sortable: true, width: 100 },
    { key: 'name', header: '코드명', sortable: true },
    { key: 'sortOrder', header: '정렬순서', align: 'right', mono: true, sortable: true, width: 90 },
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
  emptyForm: { group: '', groupName: '', code: '', name: '', sortOrder: '', use: '사용' },
  formFields: [
    { name: 'group', label: '코드그룹', required: true, placeholder: 'GROUP_KEY' },
    { name: 'groupName', label: '그룹명', required: true },
    { name: 'code', label: '코드', required: true },
    { name: 'name', label: '코드명', required: true },
    { name: 'sortOrder', label: '정렬순서', placeholder: '10' },
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
  toEntity: (v: Form, prev?: CommonCode): CommonCode => ({
    id: prev?.id ?? `C${Date.now()}`,
    group: v.group,
    groupName: v.groupName,
    code: v.code,
    name: v.name,
    sortOrder: v.sortOrder ?? '',
    use: v.use,
  }),
  toForm: (r: CommonCode): Form => ({
    group: r.group,
    groupName: r.groupName,
    code: r.code,
    name: r.name,
    sortOrder: r.sortOrder,
    use: r.use,
  }),
};

export default function CodeScreen() {
  return <CrudListPage<CommonCode, typeof schema> {...config} />;
}
