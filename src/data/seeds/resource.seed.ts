import type { Resource } from '@/domain/resource/schema';

const CREATED_AT = '2026-08-11T00:00:00.000Z';
const BASE_POLICY = {
  minDurationMinutes: 30,
  maxDurationMinutes: 480,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  maxAdvanceDays: 60,
  cancelDeadlineMinutes: 30,
  availableFrom: '08:00',
  availableTo: '20:00',
  status: 'ACTIVE' as const,
  imageUrl: null,
  notes: '',
  createdBy: 'U001',
  createdAt: CREATED_AT,
  updatedBy: 'U001',
  updatedAt: CREATED_AT,
};

export const RESOURCE_SEED: Resource[] = [
  {
    ...BASE_POLICY,
    id: 'RES-0001', code: 'ROOM-A', name: '대회의실', typeCode: 'ROOM', bookingMode: 'TIME_SLOT',
    location: '본사 3층', description: '화상회의 장비와 대형 디스플레이 구비', capacity: 16,
    totalQuantity: 1, unitCode: 'EA', managerUserId: 'U009', ownerDeptId: 'D230',
    approvalMode: 'INSTANT', slotMinutes: 30,
  },
  {
    ...BASE_POLICY,
    id: 'RES-0002', code: 'ROOM-B', name: '소회의실', typeCode: 'ROOM', bookingMode: 'TIME_SLOT',
    location: '본사 2층', description: '소규모 미팅 및 화상회의용', capacity: 6,
    totalQuantity: 1, unitCode: 'EA', managerUserId: 'U009', ownerDeptId: 'D230',
    approvalMode: 'INSTANT', slotMinutes: 30,
  },
  {
    ...BASE_POLICY,
    id: 'RES-0003', code: 'CAR-01', name: '법인차량 1호', typeCode: 'VEHICLE', bookingMode: 'TIME_SLOT',
    location: '본사 지하주차장', description: '9인승 업무용 차량', capacity: 9,
    totalQuantity: 1, unitCode: 'EA', managerUserId: 'U009', ownerDeptId: 'D230',
    approvalMode: 'APPROVAL', slotMinutes: 60, minDurationMinutes: 60, maxDurationMinutes: 720,
  },
  {
    ...BASE_POLICY,
    id: 'RES-0004', code: 'BEAM-01', name: '공용 빔프로젝터', typeCode: 'EQUIPMENT', bookingMode: 'TIME_SLOT',
    location: '사업관리팀 보관함', description: 'HDMI·USB-C 연결 지원', capacity: null,
    totalQuantity: 1, unitCode: 'EA', managerUserId: 'U009', ownerDeptId: 'D230',
    approvalMode: 'INSTANT', slotMinutes: 30,
  },
  {
    ...BASE_POLICY,
    id: 'RES-0005', code: 'LAPTOP-POOL', name: '공용 노트북', typeCode: 'SUPPLY', bookingMode: 'QUANTITY',
    location: 'S/W 개발팀 보관함', description: '교육·회의 대여용 노트북', capacity: null,
    totalQuantity: 5, unitCode: '대', managerUserId: 'U011', ownerDeptId: 'D240',
    approvalMode: 'APPROVAL', slotMinutes: 60, minDurationMinutes: 60,
  },
];
