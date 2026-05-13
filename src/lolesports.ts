/**
 * lolesports.com 비공식 API fetcher.
 *
 * 이 파일이 유일한 side effect 진입점 (plan.md §6.1).
 * 응답 파싱은 순수 함수로 분리 (parseScheduleResponse) — 테스트 가능.
 */

import type { Match, MatchStatus } from './core/types.js';
import { toKoreanTeamName } from './team-names.js';

const API_BASE = 'https://esports-api.lolesports.com/persisted/gw';
const API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';

export const LEAGUE_IDS = {
  LCK: '98767991310872058',
  MSI: '98767991325878492',
  WORLDS: '98767975604431411',
  FIRST_STAND: '113464388705111224',
} as const;

/* ============================================================
 * Side effect (fetch)
 * ============================================================ */

/**
 * 지정 리그의 전체 스케줄을 fetch.
 *
 * pageToken으로 페이지네이션 처리. 모든 페이지를 합쳐서 반환.
 */
export async function fetchSchedule(leagueId: string): Promise<Match[]> {
  const allMatches: Match[] = [];
  let pageToken: string | undefined = undefined;
  let safetyGuard = 0; // 무한 루프 방지

  do {
    const url = buildScheduleUrl(leagueId, pageToken);
    const response = await fetch(url, { headers: { 'x-api-key': API_KEY } });

    if (!response.ok) {
      throw new Error(`lolesports API failed: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as ScheduleApiResponse;
    const { matches, nextPageToken } = parseScheduleResponse(json);
    allMatches.push(...matches);
    pageToken = nextPageToken;

    safetyGuard += 1;
    if (safetyGuard > 50) {
      throw new Error('Pagination safety guard tripped: >50 pages');
    }
  } while (pageToken !== undefined);

  return allMatches;
}

function buildScheduleUrl(leagueId: string, pageToken?: string): string {
  const params = new URLSearchParams({ hl: 'ko-KR', leagueId });
  if (pageToken !== undefined) params.set('pageToken', pageToken);
  return `${API_BASE}/getSchedule?${params.toString()}`;
}

/* ============================================================
 * Pure parser (테스트 가능)
 * ============================================================ */

interface ScheduleApiResponse {
  readonly data: {
    readonly schedule: {
      readonly pages?: { readonly older?: string | null; readonly newer?: string | null };
      readonly events: readonly ScheduleEvent[];
    };
  };
}

interface ScheduleEvent {
  readonly startTime: string;
  readonly state: string;
  readonly type: string;
  readonly blockName?: string;
  readonly league?: { readonly name?: string; readonly slug?: string };
  readonly tournament?: { readonly id?: string };
  readonly match?: {
    readonly id: string;
    readonly teams: readonly EventTeam[];
    readonly strategy?: { readonly type?: string; readonly count?: number };
  };
}

interface EventTeam {
  readonly name?: string;
  readonly code?: string;
}

/**
 * lolesports API 응답을 도메인 Match[]로 변환.
 *
 * 순수 함수. 부수 효과 없음. 단위 테스트의 핵심 대상.
 *
 * 변환 규칙:
 * - type !== "match"인 event는 제외 (show 등)
 * - team.code가 "TBD"인 매치는 제외 (Phase 0 — Phase 1에서 TeamRef union으로 처리 예정)
 * - team 수가 2가 아니면 제외 (방어적)
 */
export function parseScheduleResponse(response: ScheduleApiResponse): {
  readonly matches: Match[];
  readonly nextPageToken: string | undefined;
} {
  const events = response.data.schedule.events;
  const matches: Match[] = [];

  for (const event of events) {
    const match = toMatch(event);
    if (match !== null) matches.push(match);
  }

  // 페이지네이션: newer 방향(현재→미래)만 사용. 과거 매치는 캘린더 관점에서 불필요.
  const newerToken = response.data.schedule.pages?.newer;
  const nextPageToken = newerToken ?? undefined;

  return { matches, nextPageToken };
}

function toMatch(event: ScheduleEvent): Match | null {
  if (event.type !== 'match') return null;
  if (!event.match) return null;
  if (event.match.teams.length !== 2) return null;

  const [rawTeamA, rawTeamB] = event.match.teams;
  if (!rawTeamA || !rawTeamB) return null;
  if (!rawTeamA.code || !rawTeamB.code) return null;
  if (rawTeamA.code === 'TBD' || rawTeamB.code === 'TBD') return null;

  const bestOf = normalizeBestOf(event.match.strategy?.count);
  if (bestOf === null) return null;

  return {
    id: event.match.id,
    tournament: {
      displayName: event.league?.name ?? 'Unknown',
      stage: event.blockName ?? '',
    },
    teamA: {
      code: rawTeamA.code,
      displayName: toKoreanTeamName(rawTeamA.code, rawTeamA.name),
    },
    teamB: {
      code: rawTeamB.code,
      displayName: toKoreanTeamName(rawTeamB.code, rawTeamB.name),
    },
    startsAt: event.startTime,
    bestOf,
    status: normalizeStatus(event.state),
  };
}

function normalizeBestOf(count: number | undefined): 1 | 3 | 5 | null {
  if (count === 1 || count === 3 || count === 5) return count;
  return null;
}

function normalizeStatus(state: string): MatchStatus {
  switch (state) {
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'canceled';
    default:
      return 'scheduled';
  }
}
