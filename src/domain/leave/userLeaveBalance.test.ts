import { describe, it, expect } from 'vitest';
import { calculateUserLeaveBalance } from './userLeaveBalance';
import { buildLeaveLedger } from './ledger';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

describe('calculateUserLeaveBalance (SSOT 연차 잔여 일원화 엔진)', () => {
  it('TEST-01: 반차 신청 건이 usedDays에 정확히 0.5일로 차감 계산되어야 함 (1일 오염값 배제)', () => {
    const mockDocs: ApprovalDoc[] = [
      {
        id: 'doc-1',
        docNo: 'AP-20260907-001',
        docType: '휴가',
        drafterId: 'user-kim',
        drafterName: '김태영',
        title: '연차(오후반차) 신청의 건',
        status: '완료',
        form: {
          leaveType: '반차',
          startDate: '2026-09-07',
          endDate: '2026-09-07',
          days: 1, // DB에 1일로 잘못 들어가 있어도
        },
        createdAt: '2026-09-07T09:00:00Z',
      } as any,
    ];

    const result = calculateUserLeaveBalance({
      user: {
        userId: 'user-kim',
        name: '김태영',
        hireDate: '2024-01-01',
      },
      approvalDocs: mockDocs,
      referenceDate: new Date('2026-09-14'),
    });

    expect(result.usedDays).toBe(0.5);
    expect(result.remainingDays).toBe(result.totalGrantedDays - 0.5);
  });

  it('TEST-02: 반반차 신청 건은 0.25일로 차감되어야 함', () => {
    const mockDocs: ApprovalDoc[] = [
      {
        id: 'doc-quarter',
        docNo: 'AP-20260910-002',
        docType: '휴가',
        drafterId: 'user-heo',
        drafterName: '허진욱',
        title: '개인사정 반반차 신청의 건',
        status: '완료',
        form: {
          leaveType: '반반차',
          startDate: '2026-09-10',
          endDate: '2026-09-10',
          days: 1,
        },
        createdAt: '2026-09-10T09:00:00Z',
      } as any,
    ];

    const result = calculateUserLeaveBalance({
      user: {
        userId: 'user-heo',
        name: '허진욱',
        hireDate: '2023-03-01',
      },
      approvalDocs: mockDocs,
      referenceDate: new Date('2026-09-14'),
    });

    expect(result.usedDays).toBe(0.25);
  });

  it('TEST-03: 대체휴무 및 공가는 법정 연차 usedDays를 갉아먹지 않고 분리 집계되어야 함', () => {
    const mockDocs: ApprovalDoc[] = [
      {
        id: 'doc-sub',
        docNo: 'AP-20260911-003',
        docType: '휴가',
        drafterId: 'user-park',
        drafterName: '박대휴',
        title: '대체휴무 사용의 건',
        status: '완료',
        form: {
          leaveType: '대체휴무',
          startDate: '2026-09-11',
          endDate: '2026-09-11',
          days: 1,
        },
        createdAt: '2026-09-11T09:00:00Z',
      } as any,
      {
        id: 'doc-gong',
        docNo: 'AP-20260912-004',
        docType: '휴가',
        drafterId: 'user-park',
        drafterName: '박대휴',
        title: '민방위 훈련 공가 신청의 건',
        status: '완료',
        form: {
          leaveType: '공가',
          startDate: '2026-09-12',
          endDate: '2026-09-12',
          days: 1,
        },
        createdAt: '2026-09-12T09:00:00Z',
      } as any,
    ];

    const result = calculateUserLeaveBalance({
      user: {
        userId: 'user-park',
        name: '박대휴',
        hireDate: '2022-01-01',
      },
      approvalDocs: mockDocs,
      referenceDate: new Date('2026-09-14'),
    });

    expect(result.usedDays).toBe(0);
    expect(result.otherUsedDays).toBe(1);
  });

  it('TEST-04: buildLeaveLedger(전사 원장)와 calculateUserLeaveBalance의 수치가 100% 동일해야 함', () => {
    const mockDocs: ApprovalDoc[] = [
      {
        id: 'doc-half-1',
        docType: '휴가',
        drafterId: 'user-heo',
        drafterName: '허진욱',
        title: '반차 신청의 건',
        status: '완료',
        form: {
          leaveType: '반차',
          startDate: '2026-09-17',
          endDate: '2026-09-17',
          days: 1,
        },
      } as any,
      {
        id: 'doc-half-2',
        docType: '휴가',
        drafterId: 'user-heo',
        drafterName: '허진욱',
        title: '반차 신청의 건',
        status: '완료',
        form: {
          leaveType: '반차',
          startDate: '2026-09-18',
          endDate: '2026-09-18',
          days: 1,
        },
      } as any,
    ];

    const singleBalance = calculateUserLeaveBalance({
      user: {
        userId: 'user-heo',
        name: '허진욱',
        hireDate: '2024-05-01',
      },
      approvalDocs: mockDocs,
      referenceDate: new Date('2026-09-14'),
    });

    const ledger = buildLeaveLedger(
      [
        {
          name: '허진욱',
          hireDate: '2024-05-01',
        },
      ],
      [
        {
          userId: 'user-heo',
          name: '허진욱',
          hireDate: '2024-05-01',
        } as any,
      ],
      mockDocs,
      [],
      { referenceDate: new Date('2026-09-14') }
    );

    const ledgerEntry = ledger.entries.find((e) => e.name === '허진욱')!;

    expect(singleBalance.usedDays).toBe(1.0);
    expect(ledgerEntry.usedDays).toBe(1.0);
    expect(singleBalance.remainingDays).toBe(ledgerEntry.remainingDays);
    expect(singleBalance.totalGrantedDays).toBe(ledgerEntry.totalGrantedDays);
  });
});
