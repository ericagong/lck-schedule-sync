/**
 * 네이버 esports JSON API client.
 * invalid topLeagueId·미래 빈 월 모두 200 + content.matches=[] (HTTP로 구별 불가).
 */

import { LEAGUES } from './match.js';
import type { TeamCode, TeamDisplayName } from './team.js';

export type NaverScheduleResponse = {
  readonly code: number;
  readonly message: string | null;
  readonly content: {
    readonly matches: readonly NaverMatch[];
    readonly teams: readonly unknown[];
    readonly userMatchPushGameIds: readonly unknown[];
  } | null;
};

export type NaverMatch = {
  readonly gameId: string;
  readonly title: string;
  readonly startDate: number; // ms since Unix epoch (UTC)
  readonly maxMatchCount: 1 | 3 | 5; // Bo1·Bo3·Bo5 외 값은 Match.from에서 throw
  readonly matchStatus: 'BEFORE' | 'RESULT' | 'CANCEL';
  readonly homeTeam: NaverTeam | null;
  readonly awayTeam: NaverTeam | null;
  readonly topLeagueId: string;
  readonly leagueId: string;
};

export type NaverTeam = {
  readonly name: TeamDisplayName;
  readonly nameEngAcronym: TeamCode;
};

/**
 * Phase 3 5차 결정 — 과거 3 + 현재 + 미래 1 = 5 month rolling window.
 * T1 ~25 매치 유지, 다가오는 일정에 집중.
 */
export const SCHEDULE_WINDOW = {
  monthsBefore: 3,
  monthsAhead: 1,
} as const;

function getYearMonth(date: Date, offsetMonths: number): string {
  const absoluteMM = date.getUTCFullYear() * 12 + date.getUTCMonth() + offsetMonths;
  const YY = Math.floor(absoluteMM / 12);
  const MM = (absoluteMM % 12) + 1;
  return `${YY}-${String(MM).padStart(2, '0')}`;
}

export function getScheduleMonths(now: Date): string[] {
  const { monthsBefore, monthsAhead } = SCHEDULE_WINDOW;
  return Array.from({ length: monthsBefore + 1 + monthsAhead }, (_, i) =>
    getYearMonth(now, i - monthsBefore),
  );
}

const API_BASE = 'https://esports-api.game.naver.com/service/v2';
const USER_AGENT = 'lck-schedule-sync/0.1 (+https://github.com/ericagong/lck-schedule-sync)';

function buildScheduleUrl(topLeagueId: string, yearMonth: string): string {
  const url = new URL(`${API_BASE}/schedule/month`);
  url.searchParams.set('month', yearMonth);
  url.searchParams.set('topLeagueId', topLeagueId);
  url.searchParams.set('relay', 'false');
  return url.toString();
}

function describeFetchFailure(response: Response, topLeagueId: string, yearMonth: string): string {
  const context = `topLeagueId=${topLeagueId}, month=${yearMonth}`;
  const status = `${response.status} ${response.statusText}`;
  if (response.status === 429) return `Naver esports rate limit. ${status} (${context})`;
  if (response.status >= 500) {
    return `Naver esports 서버 장애 — 다음 cron 재시도 시 성공 예정. ${status} (${context})`;
  }
  return `Naver esports API failed. ${status} (${context})`;
}

async function fetchMonth(topLeagueId: string, yearMonth: string): Promise<readonly NaverMatch[]> {
  const response = await fetch(buildScheduleUrl(topLeagueId, yearMonth), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(describeFetchFailure(response, topLeagueId, yearMonth));
  }

  const json = (await response.json()) as NaverScheduleResponse;
  return json.content?.matches ?? [];
}

export async function fetchAll(
  now: Date = new Date(),
  leagueIds: readonly string[] = Object.keys(LEAGUES),
): Promise<NaverMatch[]> {
  const months = getScheduleMonths(now);
  const all: NaverMatch[] = [];
  for (const topLeagueId of leagueIds) {
    for (const yearMonth of months) {
      const matches = await fetchMonth(topLeagueId, yearMonth);
      all.push(...matches);
    }
  }
  return all;
}
