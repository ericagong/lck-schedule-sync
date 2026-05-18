/**
 * 네이버 esports API adapter.
 *
 * unknown raw → 도메인 Match 변환과 월별 fetch 합성.
 * Naver 식별자(topLeagueId·nameEngAcronym)는 이 모듈 안에서만 살고,
 * 도메인 식별자로 번역되어 외부로 나감.
 */

import { z } from 'zod';
import { Match, assertBestOf, type MatchScore, type MatchStatus } from './match.js';
import { type League } from './league.js';
import { LCK_TEAM_DISPLAY_NAME, type LckTeamCode, type Team } from './team.js';

/** 외부 string → 닫힌 enum lookup. 미등록 키는 null. as 캐스팅 한 곳에 응집. */
function lookup<V>(table: Readonly<Record<string, V>>, key: string): V | null {
  return (table as Record<string, V>)[key] ?? null;
}

/* ─────────── Fetch 윈도우 ─────────── */

/** Phase 3 5차 결정 — 과거 3 + 현재 + 미래 1 = 5월 rolling. */
const SCHEDULE_WINDOW = {
  monthsBefore: 3,
  monthsAhead: 1,
} as const;

/* ─────────── Naver → 도메인 매핑 ─────────── */

/** Naver topLeagueId → 도메인 League. */
const NAVER_TO_LEAGUE = {
  lck: 'LCK',
  msi: 'MSI',
  world_championship: 'WORLDS',
  first_stand_lol: 'FIRST_STAND',
  ewc_lol: 'EWC',
  lol_kespa: 'KESPA_CUP',
} as const satisfies Record<string, League>;

type NaverTopLeagueId = keyof typeof NAVER_TO_LEAGUE;

function toLeague(naverTopLeagueId: string): League | null {
  return lookup(NAVER_TO_LEAGUE, naverTopLeagueId);
}

/** Naver nameEngAcronym → 도메인 LckTeamCode. */
const NAVER_TO_LCK_TEAM = {
  T1: 'T1',
  GEN: 'GEN',
  HLE: 'HLE',
  DK: 'DK',
  KT: 'KT',
  KRX: 'KRX',
  BRO: 'BRO',
  BFX: 'BFX',
  NS: 'NS',
  DNS: 'DNS',
} as const satisfies Record<string, LckTeamCode>;

function toLckCode(naverCode: string): LckTeamCode | null {
  return lookup(NAVER_TO_LCK_TEAM, naverCode);
}

function toMatchStatus(naverStatus: string): MatchStatus {
  switch (naverStatus) {
    case 'RESULT':
      return 'completed';
    case 'BEFORE':
      return 'scheduled';
    case 'CANCEL':
      return 'canceled';
    default:
      return 'scheduled';
  }
}

/* ─────────── Schemas ─────────── */

const NaverTeamSchema = z.object({
  name: z.string().min(1),
  nameEngAcronym: z.string().min(1),
});

const NaverMatchSchema = z.object({
  gameId: z.string(),
  title: z.string().default(''),
  startDate: z.number().finite(),
  maxMatchCount: z.number(),
  matchStatus: z.string(),
  homeTeam: NaverTeamSchema.nullable(),
  awayTeam: NaverTeamSchema.nullable(),
  topLeagueId: z.string(),
  // 매치 메타 (optional — 모든 매치에 있는 건 아님. 네이버는 누락 시 null 또는 0)
  homeScore: z.number().int().nonnegative().nullable().optional(),
  awayScore: z.number().int().nonnegative().nullable().optional(),
  winner: z.enum(['HOME', 'AWAY']).nullable().optional(),
  stadium: z.string().nullable().optional(),
  chzzkChannelId: z.string().nullable().optional(),
  replayVideoId: z.number().int().positive().nullable().optional(),
});

const NaverResponseSchema = z.object({
  code: z.number(),
  content: z.object({ matches: z.array(z.unknown()) }).nullable(),
});

type NaverTeam = z.infer<typeof NaverTeamSchema>;

/* ─────────── Translation — unknown → Match ─────────── */

export function toMatch(raw: unknown): Match | null {
  const parsed = NaverMatchSchema.safeParse(raw);
  if (!parsed.success) return null;

  const m = parsed.data;
  const league = toLeague(m.topLeagueId);
  if (!league) return null;
  if (!m.homeTeam || !m.awayTeam) return null;

  assertBestOf(m.maxMatchCount, `naver gameId=${m.gameId}`);

  return Match.create({
    id: `naver:${m.gameId}`,
    league,
    stage: m.title,
    teamA: toTeam(m.homeTeam),
    teamB: toTeam(m.awayTeam),
    startsAt: epochMsToIsoUtc(m.startDate),
    bestOf: m.maxMatchCount,
    status: toMatchStatus(m.matchStatus),
    score: toScore(m),
    // null → undefined 정규화 (도메인은 undefined만 다룸)
    stadium: m.stadium ?? undefined,
    chzzkChannelId: m.chzzkChannelId ?? undefined,
    replayVideoId: m.replayVideoId ?? undefined,
  });
}

/** 완료 매치에만 점수 가짐 — 셋 다 있어야 MatchScore 반환. */
function toScore(m: {
  homeScore?: number | null;
  awayScore?: number | null;
  winner?: 'HOME' | 'AWAY' | null;
}): MatchScore | undefined {
  if (m.homeScore == null || m.awayScore == null || !m.winner) return undefined;
  return { home: m.homeScore, away: m.awayScore, winner: m.winner };
}

export function toMatches(raws: readonly unknown[]): Match[] {
  return raws.map(toMatch).filter((m): m is Match => m !== null);
}

function toTeam(raw: NaverTeam): Team {
  const naverCode = raw.nameEngAcronym.trim().toUpperCase();
  const lckCode = toLckCode(naverCode);

  if (lckCode) {
    // LCK 팀: 도메인 표준 사용 (Naver display 무시)
    return {
      code: lckCode,
      displayName: LCK_TEAM_DISPLAY_NAME[lckCode],
    };
  }

  // International: Naver 값 그대로 (열린 집합)
  return {
    code: naverCode,
    displayName: raw.name.trim(),
  };
}

function epochMsToIsoUtc(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/* ─────────── Schedule months ─────────── */

export function getScheduleMonths(now: Date): string[] {
  const { monthsBefore, monthsAhead } = SCHEDULE_WINDOW;
  const length = monthsBefore + 1 + monthsAhead;
  return Array.from({ length }, (_, i) => shiftMonth(now, i - monthsBefore));
}

/** 기준 날짜의 (UTC) 월에서 deltaMonths만큼 이동한 YYYY-MM. */
function shiftMonth(from: Date, deltaMonths: number): string {
  const totalMonths = from.getUTCFullYear() * 12 + from.getUTCMonth() + deltaMonths;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/* ─────────── Fetch — side effect ─────────── */

const API_BASE = 'https://esports-api.game.naver.com/service/v2';
const USER_AGENT = 'lck-teams-schedule/0.1 (+https://github.com/ericagong/lck-teams-schedule)';

/** 호출 사이 의도된 버퍼 — burst가 naver IP rate-limit(429)을 트리거하지 않도록. */
const FETCH_INTERVAL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAllMatches(now: Date = new Date()): Promise<Match[]> {
  const all: Match[] = [];
  let isFirstCall = true;
  for (const { topLeagueId, yearMonth } of scheduleTasks(now)) {
    if (!isFirstCall) await sleep(FETCH_INTERVAL_MS);
    isFirstCall = false;
    const raws = await fetchMonth(topLeagueId, yearMonth);
    all.push(...toMatches(raws));
  }
  return all;
}

function scheduleTasks(now: Date): Array<{ topLeagueId: NaverTopLeagueId; yearMonth: string }> {
  const months = getScheduleMonths(now);
  const leagueIds = Object.keys(NAVER_TO_LEAGUE) as NaverTopLeagueId[];
  return leagueIds.flatMap((topLeagueId) =>
    months.map((yearMonth) => ({ topLeagueId, yearMonth })),
  );
}

async function fetchMonth(topLeagueId: NaverTopLeagueId, yearMonth: string): Promise<unknown[]> {
  const context = `topLeagueId=${topLeagueId}, month=${yearMonth}`;
  const url = buildScheduleUrl(topLeagueId, yearMonth);

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(
      `Naver esports API failed: ${response.status} ${response.statusText} (${context})`,
    );
  }

  const parsed = NaverResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`Naver esports 응답 envelope 위반 (${context})`);
  }

  return parsed.data.content?.matches ?? [];
}

function buildScheduleUrl(topLeagueId: NaverTopLeagueId, yearMonth: string): string {
  const url = new URL(`${API_BASE}/schedule/month`);
  url.searchParams.set('month', yearMonth);
  url.searchParams.set('topLeagueId', topLeagueId);
  url.searchParams.set('relay', 'false');
  return url.toString();
}
