import type { Holiday } from '@/domain/holiday/schema';

const STORAGE_KEY = 'workfit_holidays_v1';

export const INITIAL_HOLIDAYS: Holiday[] = [
  // ── 2025년 ──
  { id: 'hol-20250101', date: '2025-01-01', name: '신정', type: 'legal', isPaid: true },
  { id: 'hol-20250128', date: '2025-01-28', name: '설날 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20250129', date: '2025-01-29', name: '설날', type: 'legal', isPaid: true },
  { id: 'hol-20250130', date: '2025-01-30', name: '설날 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20250301', date: '2025-03-01', name: '삼일절', type: 'legal', isPaid: true },
  { id: 'hol-20250303', date: '2025-03-03', name: '삼일절 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20250505', date: '2025-05-05', name: '어린이날', type: 'legal', isPaid: true },
  { id: 'hol-20250506', date: '2025-05-06', name: '부처님오신날', type: 'legal', isPaid: true },
  { id: 'hol-20250606', date: '2025-06-06', name: '현충일', type: 'legal', isPaid: true },
  { id: 'hol-20250815', date: '2025-08-15', name: '광복절', type: 'legal', isPaid: true },
  { id: 'hol-20251003', date: '2025-10-03', name: '개천절', type: 'legal', isPaid: true },
  { id: 'hol-20251005', date: '2025-10-05', name: '추석 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20251006', date: '2025-10-06', name: '추석', type: 'legal', isPaid: true },
  { id: 'hol-20251007', date: '2025-10-07', name: '추석 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20251008', date: '2025-10-08', name: '추석 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20251009', date: '2025-10-09', name: '한글날', type: 'legal', isPaid: true },
  { id: 'hol-20251225', date: '2025-12-25', name: '성탄절', type: 'legal', isPaid: true },

  // ── 2026년 ──
  { id: 'hol-20260101', date: '2026-01-01', name: '신정', type: 'legal', isPaid: true },
  { id: 'hol-20260216', date: '2026-02-16', name: '설날 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20260217', date: '2026-02-17', name: '설날', type: 'legal', isPaid: true },
  { id: 'hol-20260218', date: '2026-02-18', name: '설날 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20260301', date: '2026-03-01', name: '삼일절', type: 'legal', isPaid: true },
  { id: 'hol-20260302', date: '2026-03-02', name: '삼일절 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20260501', date: '2026-05-01', name: '근로자의 날', type: 'legal', isPaid: true },
  { id: 'hol-20260505', date: '2026-05-05', name: '어린이날', type: 'legal', isPaid: true },
  { id: 'hol-20260524', date: '2026-05-24', name: '부처님오신날', type: 'legal', isPaid: true },
  { id: 'hol-20260525', date: '2026-05-25', name: '부처님오신날 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20260603', date: '2026-06-03', name: '제9회 전국동시지방선거', type: 'special', isPaid: true },
  { id: 'hol-20260606', date: '2026-06-06', name: '현충일', type: 'legal', isPaid: true },
  { id: 'hol-20260815', date: '2026-08-15', name: '광복절', type: 'legal', isPaid: true },
  { id: 'hol-20260817', date: '2026-08-17', name: '광복절 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20260924', date: '2026-09-24', name: '추석 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20260925', date: '2026-09-25', name: '추석', type: 'legal', isPaid: true },
  { id: 'hol-20260926', date: '2026-09-26', name: '추석 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20260928', date: '2026-09-28', name: '추석 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20261003', date: '2026-10-03', name: '개천절', type: 'legal', isPaid: true },
  { id: 'hol-20261005', date: '2026-10-05', name: '개천절 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20261009', date: '2026-10-09', name: '한글날', type: 'legal', isPaid: true },
  { id: 'hol-20261225', date: '2026-12-25', name: '성탄절', type: 'legal', isPaid: true },
  // 회사 지정 창립기념일 예시
  { id: 'hol-20261115', date: '2026-11-15', name: '회사 창립기념일', type: 'company', isPaid: true, memo: 'WorkFit 창립기념 휴일' },

  // ── 2027년 ──
  { id: 'hol-20270101', date: '2027-01-01', name: '신정', type: 'legal', isPaid: true },
  { id: 'hol-20270206', date: '2027-02-06', name: '설날 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20270207', date: '2027-02-07', name: '설날', type: 'legal', isPaid: true },
  { id: 'hol-20270208', date: '2027-02-08', name: '설날 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20270209', date: '2027-02-09', name: '설날 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20270301', date: '2027-03-01', name: '삼일절', type: 'legal', isPaid: true },
  { id: 'hol-20270501', date: '2027-05-01', name: '근로자의 날', type: 'legal', isPaid: true },
  { id: 'hol-20270505', date: '2027-05-05', name: '어린이날', type: 'legal', isPaid: true },
  { id: 'hol-20270513', date: '2027-05-13', name: '부처님오신날', type: 'legal', isPaid: true },
  { id: 'hol-20270606', date: '2027-06-06', name: '현충일', type: 'legal', isPaid: true },
  { id: 'hol-20270607', date: '2027-06-07', name: '현충일 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20270815', date: '2027-08-15', name: '광복절', type: 'legal', isPaid: true },
  { id: 'hol-20270816', date: '2027-08-16', name: '광복절 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20270914', date: '2027-09-14', name: '추석 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20270915', date: '2027-09-15', name: '추석', type: 'legal', isPaid: true },
  { id: 'hol-20270916', date: '2027-09-16', name: '추석 연휴', type: 'legal', isPaid: true },
  { id: 'hol-20271003', date: '2027-10-03', name: '개천절', type: 'legal', isPaid: true },
  { id: 'hol-20271004', date: '2027-10-04', name: '개천절 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20271009', date: '2027-10-09', name: '한글날', type: 'legal', isPaid: true },
  { id: 'hol-20271011', date: '2027-10-11', name: '한글날 대체공휴일', type: 'substitute', isPaid: true },
  { id: 'hol-20271225', date: '2027-12-25', name: '성탄절', type: 'legal', isPaid: true },
];

export class HolidayRepo {
  private load(): Holiday[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_HOLIDAYS;
  }

  private save(data: Holiday[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  async list(year?: string): Promise<Holiday[]> {
    const list = this.load();
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    if (!year || year === 'all') return sorted;
    return sorted.filter((h) => h.date.startsWith(year));
  }

  async get(id: string): Promise<Holiday | null> {
    const list = this.load();
    return list.find((h) => h.id === id) ?? null;
  }

  async getByDate(dateStr: string): Promise<Holiday | null> {
    const list = this.load();
    return list.find((h) => h.date === dateStr) ?? null;
  }

  async create(data: Omit<Holiday, 'id' | 'createdAt'>): Promise<Holiday> {
    const list = this.load();
    const newId = `hol-${data.date.replace(/-/g, '')}-${Math.random().toString(36).substr(2, 4)}`;
    const newHoliday: Holiday = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    const updated = [...list, newHoliday];
    this.save(updated);
    return newHoliday;
  }

  async update(id: string, patch: Partial<Omit<Holiday, 'id'>>): Promise<Holiday> {
    const list = this.load();
    const idx = list.findIndex((h) => h.id === id);
    if (idx === -1) throw new Error(`공휴일 정보를 찾을 수 없습니다: ${id}`);
    const updatedItem = {
      ...list[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updatedItem;
    this.save(list);
    return updatedItem;
  }

  async delete(id: string): Promise<void> {
    const list = this.load();
    const filtered = list.filter((h) => h.id !== id);
    this.save(filtered);
  }

  async resetToDefault(): Promise<Holiday[]> {
    this.save(INITIAL_HOLIDAYS);
    return INITIAL_HOLIDAYS;
  }
}

export const holidayRepo = new HolidayRepo();
