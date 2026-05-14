/**
 * 네이버 esports JSON API fetcher.
 *
 * Phase 3 primary 데이터 소스. side effect 진입점.
 * 응답 파싱은 순수 함수로 분리 (parseNaverResponse) — 테스트 가능.
 *
 * Endpoint: GET /service/v2/schedule/month?month=YYYY-MM&topLeagueId=<id>&relay=false
 * - 200 + content.matches=[] 형태로 invalid topLeagueId·미래 빈 월 모두 응답
 * - matches/teams 구조는 시즌·대회 무관 동일 (Step A 정찰 검증 완료)
 */

import type { Match, MatchStatus } from './core/types.js';
import { normalizeBestOf } from './core/types.js';

const API_BASE = 'https://esports-api.game.naver.com/service/v2';

const USER_AGENT = 'lck-schedule-sync/0.1 (+https://github.com/ericagong/lck-schedule-sync)';

/**
 * Phase 3 자동화 대상 6 대회의 네이버 topLeagueId.
 *
 * 출처: game.naver.com/esports HTML scrape (2026-05-13 Step A 정찰). 추정 X.
 * 아시안 게임(asi_lol)은 4년 주기·데이터 부재로 자동화 범위 외 — 추후 별도 처리.
 */
// TODO: 우선 모두 추가해놓고, 필요없는 것은 제거하기.
// TODO: 그리고 에러를 좀 더 세분화해서 어느 단계에서 에러가 발생하는지 명확히 로그를 찍어야겠다.
export const NAVER_LEAGUE_IDS = {
  LCK: 'lck',
  MSI: 'msi',
  WORLDS: 'world_championship',
  FIRST_STAND: 'first_stand_lol',
  EWC: 'ewc_lol',
  KESPA: 'lol_kespa',
} as const;

/**
 * topLeagueId → ICS SUMMARY 표시명.
 *
 * 네이버 응답에 inline displayName 필드 없음 → parser 호출부에서 주입.
 * (응답에는 topLeagueId만 있고 사람이 읽을 league.name 필드는 없음)
 */
// TODO: 대체 이 용도가 뭔지 모르겠어. 이거 안쓰고 네이버 응답에 있는 데이터를 그대로 쓰면 되는거 아닌가?
export const NAVER_LEAGUE_DISPLAY_NAMES: Record<string, string> = {
  lck: 'LCK',
  msi: 'MSI',
  world_championship: '월드 챔피언십',
  first_stand_lol: 'First Stand',
  ewc_lol: 'EWC',
  lol_kespa: 'KeSPA Cup',
};

/**
 * fetch 대상 월 범위 — 과거 N개월 + 현재월 + M 미래 월.
 *
 * 정책 (5차 결정 — 3 + 2 = 5 month rolling):
 * - 캘린더 본질은 "다가오는 일정 관리". 80 매치(12+2)는 list view·검색 노이즈가 큼.
 * - 직전 LCK split (3개월) 추억 + 현재 진행 split + 다음 lead time 1개월 = T1 ~25 매치
 *   → 캘린더 부담 거의 0, "다가오는 매치" 본질에 집중.
 * - 과거 큰 대회 추억(Worlds 우승 등) 보존은 캘린더 본질 외 — Phase 4에서 "응원팀별
 *   추억 캘린더" 별도 발행 검토. 일단 단일 t1.ics는 가볍게.
 *
 * 과거 3 + 현재 1 + 미래 1 = 5 month × 6 league = 30 호출/회 × 250ms ≈ 8초.
 *
 * 자세한 trade-off·결정 진화는 CLAUDE.md "Phase 3 lookback window 결정" 참조.
 */
// TODO: 이거 우선 3 + 2로 하되, 나중에는 로직을 가지고 수정이 필요한 부분임
// TODO: 근데 소비자의 니즈가 과거 데이터 보는 것도 있을 거 같다는 느낌이 들어서 향후 고민해 볼 부분임
// TODO: 전체 데이터를 가저가는 행위가 큰 짐이 되는지 파악 필요
const MONTHS_BEFORE = 3;
const MONTHS_AHEAD = 2;

/**
 * 호출 간 throttle — 네이버 burst rate limit(실측 429) 회피.
 */
const THROTTLE_MS = 250;

/* ============================================================
 * Side effect (fetch)
 * ============================================================ */

/**
 * 하나의 (topLeagueId, YYYY-MM) 조합을 호출.
 *
 * 200 외 응답은 throw → main()까지 propagate되어 워크플로 실패.
 * invalid ID·빈 월은 200 + matches=[] → 자연 빈 배열 반환.
 */
export async function fetchNaverScheduleMonth(
  topLeagueId: string,
  yearMonth: string,
): Promise<Match[]> {
  // TODO: 아니 relay는 대체 무슨 역할일까?
  const url = `${API_BASE}/schedule/month?month=${yearMonth}&topLeagueId=${topLeagueId}&relay=false`;
  // TODO: 원래 user-agent 필드가 이걸 넣는게 맞나?
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!response.ok) {
    // TODO: 이 부분도 응답 케이스에 따라 좀 세분화해서 나누는게 나을지? 아니면 지금 단계에서는 외부의 영역이므로 생길 때마다 넣는게 나을지?
    // TODO: 나는 후자라고 보는데, 최소한 에러 코드는 알려줘야 할듯.
    throw new Error(
      `Naver esports API failed: ${response.status} ${response.statusText} (topLeagueId=${topLeagueId}, month=${yearMonth})`,
    );
  }

  const json = (await response.json()) as NaverScheduleResponse;
  const displayName = NAVER_LEAGUE_DISPLAY_NAMES[topLeagueId] ?? 'Unknown';
  const { matches } = parseNaverResponse(json, displayName);
  return matches;
}

/**
 * 6 대회 × (현재월-3 ~ 현재월+1) = 5개월 순차 fetch → 단일 Match[].
 *
 * 순차 호출(병렬 X) + 250ms throttle: CLAUDE.md 모범사례. 네이버 burst rate
 * limit 회피(실측 429), 부담 최소. 한 호출 실패 시 throw → 호출부(main.ts)가
 * 그대로 propagate해 워크플로 실패로 인지 (GitHub Pages는 마지막 성공본 유지).
 */
// TODO: promise.all()로 나중에 병렬처리 해보는게 좋지 않을까? 왜 순차 처리를 택했는지?
export async function fetchAllNaverMatches(): Promise<Match[]> {
  const months = enumerateMonths(new Date(), MONTHS_BEFORE, MONTHS_AHEAD);
  const leagueIds = Object.values(NAVER_LEAGUE_IDS);
  const all: Match[] = [];

  // 한 번에 (league, month) 쌍을 평탄화 → 첫 호출만 throttle 면제.
  const calls = leagueIds.flatMap((id) => months.map((ym) => ({ id, ym })));
  for (const [i, { id, ym }] of calls.entries()) {
    if (i > 0) await sleep(THROTTLE_MS);
    const matches = await fetchNaverScheduleMonth(id, ym);
    all.push(...matches);
  }
  return all;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// TODO: 왜 enumerateMonths로 배열화해야하는지?
/**
 * `start`의 UTC 월을 기준으로 (현재월-before … 현재월 … 현재월+after-1) "YYYY-MM" 배열.
 * UTC 기준 — TZ 영향 회피, 결정성 확보 (테스트 가능).
 *
 * 음수·12 초과 월은 `Date.UTC`의 overflow 처리에 위임 (표준 동작):
 * `new Date(Date.UTC(2026, -1, 1))` → 2025-12-01.
 *
 * 예: enumerateMonths(2026-05-13, 3, 2) = [2026-02, 03, 04, 05, 06]
 */
export function enumerateMonths(start: Date, before: number, after: number): string[] {
  const year = start.getUTCFullYear();
  const monthIndex = start.getUTCMonth();
  const out: string[] = [];

  for (let i = -before; i < after; i++) {
    const d = new Date(Date.UTC(year, monthIndex + i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
  }
  return out;
}

/* ============================================================
 * Pure parser (테스트 가능)
 * ============================================================ */

export interface NaverScheduleResponse {
  readonly code: number;
  readonly message: string | null;
  readonly content: {
    readonly matches: readonly NaverMatch[];
    readonly teams: readonly unknown[];
    readonly userMatchPushGameIds: readonly unknown[];
  } | null;
}

interface NaverMatch {
  readonly gameId: string;
  readonly topLeagueId: string;
  readonly leagueId: string;
  readonly title: string;
  readonly startDate: number;
  readonly maxMatchCount: number;
  readonly matchStatus: string;
  readonly homeTeam: NaverTeam | null;
  readonly awayTeam: NaverTeam | null;
}

interface NaverTeam {
  readonly name: string;
  readonly nameEngAcronym: string;
}

/**
 * 네이버 응답 → 도메인 Match[] (순수 함수).
 *
 * 변환 규칙:
 * - content 또는 matches 없으면 빈 배열
 * - homeTeam/awayTeam 누락이거나 이름 비어있으면 skip (TBD 안전)
 * - maxMatchCount 1/3/5 외는 skip (Bo2/Bo7 안전)
 * - id는 "naver:" 접두 → 다른 소스로 전환 시 UID 충돌 회피용 namespace
 * - startDate(epoch ms, UTC) → ISO 8601 UTC string
 */
export function parseNaverResponse(
  response: NaverScheduleResponse,
  displayName: string,
): { readonly matches: Match[] } {
  const matches: Match[] = [];
  const items = response.content?.matches ?? [];
  for (const item of items) {
    const m = toMatch(item, displayName);
    if (m !== null) matches.push(m);
  }
  return { matches };
}

// TODO: 결국 이게 우리 DTO로 바꾸는건데, 위에 너무 함수분리가 많은 거 같음...
function toMatch(item: NaverMatch, displayName: string): Match | null {
  const home = item.homeTeam;
  const away = item.awayTeam;
  if (!home || !away) return null;
  if (!home.nameEngAcronym || !away.nameEngAcronym) return null;
  if (!home.name || !away.name) return null;

  const bestOf = normalizeBestOf(item.maxMatchCount);
  if (bestOf === null) return null;

  if (!Number.isFinite(item.startDate)) return null;

  return {
    id: `naver:${item.gameId}`,
    tournament: {
      displayName,
      stage: item.title ?? '',
    },
    teamA: {
      code: home.nameEngAcronym,
      displayName: home.name,
    },
    teamB: {
      code: away.nameEngAcronym,
      displayName: away.name,
    },
    startsAt: new Date(item.startDate).toISOString(),
    bestOf,
    status: normalizeStatus(item.matchStatus),
  };
}

function normalizeStatus(status: string): MatchStatus {
  switch (status) {
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
