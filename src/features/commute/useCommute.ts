import { useQuery, useQueryClient } from '@tanstack/react-query';
import { commuteRepo } from '@/data/commute/commute.repo';

/**
 * 근태 화면을 열 때 필요한 것을 요청 하나로 받아, 아래 각 조회의 캐시에 채워 둔다.
 *
 * 화면이 viewer·employees·month·month-all 을 따로 부르면 요청 4~5개가 동시에 서버를 붙잡고 기다려
 * 함수가 DB 를 읽을 서버 작업자가 모자라 30초씩 멈췄다(caps-ingest 'bootstrap' 주석). 이걸 먼저 부르고,
 * 끝나면(isSettled) 각 조회를 켠다 — 캐시가 채워져 있어 각 조회는 서버에 다시 묻지 않는다.
 * 실패하면(예: 아직 'bootstrap' 을 모르는 예전 함수) 각 조회가 예전처럼 따로 받는다.
 */
export function useCommuteBootstrap(month: string, includeAll: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['commute', 'bootstrap', month, includeAll],
    queryFn: async () => {
      const b = await commuteRepo.bootstrap(month, includeAll);
      qc.setQueryData(['commute', 'viewer'], b.viewer);
      qc.setQueryData(['commute', 'employees'], b.employees);
      if (b.viewer.empId !== null && b.myMonth) qc.setQueryData(['commute', 'month', b.viewer.empId, month], b.myMonth);
      if (b.monthAll) qc.setQueryData(['commute', 'month-all', month], b.monthAll);
      return true;
    },
    staleTime: COMMUTE_REFETCH_INTERVAL_MS,
    // 실패하면 바로 각 조회로 넘어간다 — 다시 시도하느라 화면을 더 붙잡지 않는다
    retry: false,
  });
  return { isSettled: query.isSuccess || query.isError };
}

interface CommuteQueryOptions {
  /** false 면 아직 묻지 않는다(useCommuteBootstrap 이 끝나기를 기다릴 때). 기본 true */
  enabled?: boolean;
}

/**
 * 내 열람 범위. 화면 구성(탭 노출·범위 표기)이 여기 달려 있어 먼저 온다.
 * 로그인 세션 안에서는 안 바뀌는 값이라 길게 캐시한다.
 */
export function useCommuteViewer({ enabled = true }: CommuteQueryOptions = {}) {
  return useQuery({
    queryKey: ['commute', 'viewer'],
    queryFn: () => commuteRepo.viewerScope(),
    enabled,
    staleTime: 10 * 60_000,
  });
}

/** 근태 조회 훅 — 읽기 전용이라 mutation이 없다. */
export function useCommuteEmployees({ enabled = true }: CommuteQueryOptions = {}) {
  return useQuery({
    queryKey: ['commute', 'employees'],
    queryFn: () => commuteRepo.listEmployees(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

const COMMUTE_REFETCH_INTERVAL_MS = 5 * 60_000; // 5분 주기 자동 갱신

export function useCommuteMonth(empId: number | null, month: string, { enabled = true }: CommuteQueryOptions = {}) {
  return useQuery({
    queryKey: ['commute', 'month', empId, month],
    queryFn: () => commuteRepo.listMonth(empId as number, month),
    enabled: enabled && empId !== null,
    staleTime: COMMUTE_REFETCH_INTERVAL_MS,
    refetchInterval: COMMUTE_REFETCH_INTERVAL_MS,
  });
}

/** 하루치 전 직원. 일별 현황 화면이 쓴다. */
export function useCommuteDay(date: string | null) {
  return useQuery({
    queryKey: ['commute', 'day', date],
    queryFn: () => commuteRepo.listDay(date as string),
    enabled: date !== null,
    staleTime: COMMUTE_REFETCH_INTERVAL_MS,
    refetchInterval: COMMUTE_REFETCH_INTERVAL_MS,
  });
}

/** 한 달치 전 직원. 월별 집계 화면이 쓴다. */
export function useCommuteMonthAll(month: string | null, { enabled = true }: CommuteQueryOptions = {}) {
  return useQuery({
    queryKey: ['commute', 'month-all', month],
    queryFn: () => commuteRepo.listMonthAll(month as string),
    enabled: enabled && month !== null,
    staleTime: COMMUTE_REFETCH_INTERVAL_MS,
    refetchInterval: COMMUTE_REFETCH_INTERVAL_MS,
  });
}
