import type { BackupPolicy } from '@/domain/backupPolicy/schema';

/**
 * 백업 정책 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sys-screens-2.DataBackupContent 의 인라인 POLICIES 이관)
 */
export const BACKUP_POLICY_SEED: BackupPolicy[] = [
  { id: 'BP-EQUIP-LOG', name: '설비 가동 로그', cycle: '매일 02:00', keep: '90일', after: '아카이브 후 삭제', size: '1.2 GB/일', on: true },
  { id: 'BP-USER-LOGIN', name: '사용자 접속 로그', cycle: '매일 02:00', keep: '365일', after: '백업 후 삭제', size: '120 MB/일', on: false },
  { id: 'BP-CHANGE-HIST', name: '데이터 변경 이력', cycle: '매일 03:00', keep: '365일', after: '백업 보관', size: '340 MB/일', on: false },
  { id: 'BP-SPC-DATA', name: 'SPC 측정 데이터', cycle: '매주 일 04:00', keep: '180일', after: '아카이브 후 삭제', size: '4.6 GB/주', on: false },
  { id: 'BP-ALARM-HIST', name: '알람 이력', cycle: '매일 02:30', keep: '180일', after: '백업 후 삭제', size: '85 MB/일', on: false },
  { id: 'BP-IFACE-LOG', name: '인터페이스 로그', cycle: '매일 01:00', keep: '30일', after: '즉시 삭제', size: '2.1 GB/일', on: false },
];
