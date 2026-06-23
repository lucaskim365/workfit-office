import { z } from 'zod';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { CrudListPage, type CrudListConfig } from '@/shared/ui/crud/CrudListPage';

interface Vendor {
  id: string;
  code: string;
  name: string;
  bizNo: string;
  type: '매입처' | '매출처' | '외주처';
  manager: string;
  tel: string;
  status: '거래중' | '거래중지';
}

const SEED: Vendor[] = [
  { id: 'V01', code: 'VEN-1001', name: '대성정밀공업', bizNo: '124-81-00123', type: '매입처', manager: '김상우', tel: '031-555-1001', status: '거래중' },
  { id: 'V02', code: 'VEN-1002', name: '한라소재', bizNo: '210-81-44521', type: '매입처', manager: '이정민', tel: '032-700-2210', status: '거래중' },
  { id: 'V03', code: 'VEN-2001', name: '삼우테크', bizNo: '305-81-77810', type: '외주처', manager: '박도현', tel: '041-330-7781', status: '거래중' },
  { id: 'V04', code: 'VEN-2002', name: '동방코팅', bizNo: '128-86-22019', type: '외주처', manager: '정하늘', tel: '031-260-2201', status: '거래중지' },
  { id: 'V05', code: 'VEN-3001', name: '글로벌일렉트로닉스', bizNo: '220-87-90011', type: '매출처', manager: '최유나', tel: '02-3478-9001', status: '거래중' },
  { id: 'V06', code: 'VEN-3002', name: 'NEXT반도체', bizNo: '119-81-55230', type: '매출처', manager: '한지석', tel: '02-6000-5523', status: '거래중' },
  { id: 'V07', code: 'VEN-1003', name: '우진화학', bizNo: '610-81-13345', type: '매입처', manager: '오세훈', tel: '055-260-1334', status: '거래중지' },
  { id: 'V08', code: 'VEN-2003', name: '미래열처리', bizNo: '514-81-30022', type: '외주처', manager: '신아름', tel: '053-580-3002', status: '거래중' },
];

const STATUS_TONE: Record<Vendor['status'], Tone> = { 거래중: 'ok', 거래중지: 'mute' };
const TYPE_TONE: Record<Vendor['type'], Tone> = { 매입처: 'info', 매출처: 'warn', 외주처: 'mute' };

const schema = z.object({
  code: z.string().min(1, '거래처코드를 입력하세요').max(20),
  name: z.string().min(1, '거래처명을 입력하세요').max(40),
  bizNo: z.string().min(1, '사업자번호를 입력하세요').max(20),
  type: z.enum(['매입처', '매출처', '외주처']),
  manager: z.string().min(1, '담당자를 입력하세요').max(20),
  tel: z.string().min(1, '연락처를 입력하세요').max(20),
  status: z.enum(['거래중', '거래중지']),
});
type Form = z.infer<typeof schema>;

const config: CrudListConfig<Vendor, typeof schema> = {
  title: '거래처관리',
  breadcrumb: '기준 정보 / 사용자·거래처',
  seed: SEED,
  rowKey: (r) => r.id,
  searchKeys: ['code', 'name', 'manager'],
  searchPlaceholder: '코드·거래처명·담당자',
  filters: [
    {
      key: 'type',
      label: '구분',
      options: [
        { value: '', label: '전체 구분' },
        { value: '매입처', label: '매입처' },
        { value: '매출처', label: '매출처' },
        { value: '외주처', label: '외주처' },
      ],
    },
    {
      key: 'status',
      label: '상태',
      options: [
        { value: '', label: '전체 상태' },
        { value: '거래중', label: '거래중' },
        { value: '거래중지', label: '거래중지' },
      ],
    },
  ],
  columns: [
    { key: 'code', header: '거래처코드', mono: true, sortable: true, width: 110 },
    { key: 'name', header: '거래처명', sortable: true },
    {
      key: 'type',
      header: '구분',
      align: 'center',
      sortable: true,
      width: 80,
      render: (r) => <Pill tone={TYPE_TONE[r.type]}>{r.type}</Pill>,
    },
    { key: 'bizNo', header: '사업자번호', mono: true, width: 130 },
    { key: 'manager', header: '담당자', align: 'center', width: 90 },
    { key: 'tel', header: '연락처', mono: true, width: 130 },
    {
      key: 'status',
      header: '상태',
      align: 'center',
      sortable: true,
      width: 90,
      render: (r) => (
        <Pill tone={STATUS_TONE[r.status]} solid={r.status === '거래중지'}>
          {r.status}
        </Pill>
      ),
    },
  ],
  schema,
  emptyForm: { code: '', name: '', bizNo: '', type: '매입처', manager: '', tel: '', status: '거래중' },
  formFields: [
    { name: 'code', label: '거래처코드', required: true, placeholder: 'VEN-0000' },
    { name: 'name', label: '거래처명', required: true },
    {
      name: 'type',
      label: '구분',
      type: 'select',
      required: true,
      options: [
        { value: '매입처', label: '매입처' },
        { value: '매출처', label: '매출처' },
        { value: '외주처', label: '외주처' },
      ],
    },
    {
      name: 'status',
      label: '상태',
      type: 'select',
      required: true,
      options: [
        { value: '거래중', label: '거래중' },
        { value: '거래중지', label: '거래중지' },
      ],
    },
    { name: 'bizNo', label: '사업자번호', required: true, placeholder: '000-00-00000' },
    { name: 'manager', label: '담당자', required: true },
    { name: 'tel', label: '연락처', required: true, colSpan: 2, placeholder: '02-0000-0000' },
  ],
  toEntity: (v: Form, prev?: Vendor): Vendor => ({ id: prev?.id ?? `V${Date.now()}`, ...v }),
  toForm: (r: Vendor): Form => ({
    code: r.code,
    name: r.name,
    bizNo: r.bizNo,
    type: r.type,
    manager: r.manager,
    tel: r.tel,
    status: r.status,
  }),
};

export default function VendorScreen() {
  return <CrudListPage<Vendor, typeof schema> {...config} />;
}
