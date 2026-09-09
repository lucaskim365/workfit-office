import type { CommuteRecord, CommuteMonthSummary } from '@/domain/commute/schema';

export type CommuteAdminTab = 'all_matrix' | 'dept_summary' | 'anomaly' | 'leave' | 'leave_ledger';

export interface CommutePersonRow {
  empId: number;
  name: string;
  empNo?: string;
  dept: string;
  position: string;
  hireDate: string | null;
  active: boolean;
  records: CommuteRecord[];
  recordsMap: Map<string, CommuteRecord>;
  summary: CommuteMonthSummary;
  anomalyRecords: CommuteRecord[];
  anomalyCount: number;
}

export interface DeptSummary {
  dept: string;
  memberCount: number;
  presentDays: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  anomalyCount: number;
  attendanceRate: number;
}

export interface AnomalyItem {
  id: string;
  date: string;
  empId: number;
  name: string;
  dept: string;
  position: string;
  status: CommuteRecord['status'];
  typeLabel: string;
  inAt: string | null;
  outAt: string | null;
  lateMin: number;
  note: string;
  record: CommuteRecord;
}
