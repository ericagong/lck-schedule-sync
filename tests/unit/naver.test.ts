import { describe, expect, it } from 'vitest';
import { SCHEDULE_WINDOW, getScheduleMonths } from '../../src/naver.js';
import { LEAGUES } from '../../src/match.js';

describe('SCHEDULE_WINDOW — Phase 3 5차 결정', () => {
  it('monthsBefore=3, monthsAhead=1 (5 month rolling)', () => {
    expect(SCHEDULE_WINDOW.monthsBefore).toBe(3);
    expect(SCHEDULE_WINDOW.monthsAhead).toBe(1);
  });
});

describe('getScheduleMonths — rolling 5 month window', () => {
  it('항상 5개월 반환 (monthsBefore + 1 + monthsAhead)', () => {
    expect(getScheduleMonths(new Date(Date.UTC(2026, 4, 13)))).toHaveLength(5);
  });

  it('기준 월 포함 — 과거 3 → 현재 → 미래 1 순서', () => {
    expect(getScheduleMonths(new Date(Date.UTC(2026, 4, 13)))).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('연 경계 — 과거 방향 (Feb 기준 → 작년 Nov까지)', () => {
    expect(getScheduleMonths(new Date(Date.UTC(2026, 1, 13)))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('연 경계 — 미래 방향 (Dec 기준 → 내년 Jan까지)', () => {
    expect(getScheduleMonths(new Date(Date.UTC(2026, 11, 15)))).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });

  it('UTC 기준 — TZ 무관 결정론 (같은 절대 시점이면 환경 무관 동일)', () => {
    const a = getScheduleMonths(new Date(Date.UTC(2026, 4, 13, 0, 0, 0)));
    const b = getScheduleMonths(new Date(Date.UTC(2026, 4, 13, 23, 59, 59)));
    expect(a).toEqual(b);
  });
});

describe('LEAGUES — 6 대회', () => {
  it('6 raw id 정확', () => {
    expect(Object.keys(LEAGUES).sort()).toEqual(
      ['ewc_lol', 'first_stand_lol', 'lck', 'lol_kespa', 'msi', 'world_championship'].sort(),
    );
  });

  it('모든 displayName 비어있지 않음', () => {
    for (const name of Object.values(LEAGUES)) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
