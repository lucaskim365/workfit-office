import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

    assert.equal(result.usedDays, 0.5, '반차 건은 DB 저장값이 1일이라도 usedDays가 0.5일이어야 함');
    assert.equal(result.remainingDays, result.totalGrantedDays - 0.5, '잔여 연차에서 정확히 0.5일만 차감되어야 함');
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

    assert.equal(result.usedDays, 0.25, '반반차는 usedDays가 0.25일이어야 함');
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

    assert.equal(result.usedDays, 0, '대체휴무와 공가는 법정 연차 usedDays에 가산되지 않아야 함');
    assert.equal(result.otherUsedDays, 1, '공가는 otherUsedDays에 1일 집계되어야 함');
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

    assert.equal(singleBalance.usedDays, 1.0, '반차 2건 합산 = 1.0일 (단일 엔진)');
    assert.equal(ledgerEntry.usedDays, 1.0, '전사 원장에서도 반차 2건 합산 = 1.0일');
    assert.equal(singleBalance.remainingDays, ledgerEntry.remainingDays, '단일 엔진과 전사 원장의 잔여 연차가 완벽히 일치해야 함');
    assert.equal(singleBalance.totalGrantedDays, ledgerEntry.totalGrantedDays, '총 부여 일수 일치');
  });
});
