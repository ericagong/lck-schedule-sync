import { describe, expect, it } from 'vitest';
import { getScheduleMonths, toMatch } from '../../src/naver.js';
import { ALL_LEAGUES, LEAGUE_DISPLAY_NAME } from '../../src/league.js';

/** 네이버 raw 매치 fixture — 필수 필드만. */
function rawMatch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gameId: '2026052017nPNMH9y8539lol',
    topLeagueId: 'lck',
    title: '정규시즌 2R',
    startDate: 1779264000000,
    maxMatchCount: 3,
    matchStatus: 'BEFORE',
    winner: 'NONE',
    homeScore: 0,
    awayScore: 0,
    stadium: '치지직 롤파크',
    chzzkChannelId: '9381e7d6816e6d915a44a13c0195b202',
    replayVideoId: null,
    homeTeam: { name: 'T1', nameEngAcronym: 'T1' },
    awayTeam: { name: 'KRX', nameEngAcronym: 'KRX' },
    ...overrides,
  };
}

describe('getScheduleMonths — rolling 5 month window (과거 3 + 현재 + 미래 1)', () => {
  it('항상 5개월 반환', () => {
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

describe('toMatch — winner 값 회귀 (네이버는 예정 매치에 NONE 응답)', () => {
  it('예정 매치 winner="NONE"도 parse 통과 (silent 누락 회귀 방지)', () => {
    const match = toMatch(rawMatch({ matchStatus: 'BEFORE', winner: 'NONE' }));
    expect(match).not.toBeNull();
    expect(match?.status).toBe('scheduled');
    expect(match?.score).toBeUndefined(); // NONE → score 없음
  });

  it('완료 매치 winner="HOME"은 score 포함', () => {
    const match = toMatch(
      rawMatch({ matchStatus: 'RESULT', winner: 'HOME', homeScore: 2, awayScore: 0 }),
    );
    expect(match?.score).toEqual({ home: 2, away: 0, winner: 'HOME' });
  });

  it('완료 매치 winner="AWAY"도 score 포함', () => {
    const match = toMatch(
      rawMatch({ matchStatus: 'RESULT', winner: 'AWAY', homeScore: 1, awayScore: 2 }),
    );
    expect(match?.score).toEqual({ home: 1, away: 2, winner: 'AWAY' });
  });
});

describe('ALL_LEAGUES — 6 대회 도메인 식별자', () => {
  it('정확히 6개 — LCK, MSI, WORLDS, FIRST_STAND, EWC, KESPA_CUP', () => {
    expect([...ALL_LEAGUES].sort()).toEqual(
      ['EWC', 'FIRST_STAND', 'KESPA_CUP', 'LCK', 'MSI', 'WORLDS'].sort(),
    );
  });

  it('모든 League에 표시명이 정의됨 (비어있지 않음)', () => {
    for (const league of ALL_LEAGUES) {
      expect(LEAGUE_DISPLAY_NAME[league].length).toBeGreaterThan(0);
    }
  });
});
