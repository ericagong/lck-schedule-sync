/**
 * Phase 2 fixture 캡처: MSI · Worlds · First Stand raw 응답을
 * fixtures/phase-2/ 아래에 저장.
 *
 * 사용:
 *   pnpm exec tsx scripts/capture-phase-2.ts
 *
 * 출력 파일명 규칙:
 *   {league}-newer-{N}.json — 초기 응답 + newer 토큰 따라가기 (production 관련)
 *   {league}-older-{N}.json — older 토큰 따라가기 (historical 시각 검증용)
 *
 * 안전장치:
 *   - 방향당 최대 MAX_PAGES_PER_DIRECTION 페이지
 *   - 호출 사이 sleep으로 rate-limit 부담 최소화
 */

import { mkdirSync, writeFileSync } from 'node:fs';

const API_BASE = 'https://esports-api.lolesports.com/persisted/gw';
const API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';
const OUTPUT_DIR = 'fixtures/phase-2';
const MAX_PAGES_PER_DIRECTION = 5;
const DELAY_MS = 200;

const LEAGUES: Record<string, string> = {
  msi: '98767991325878492',
  worlds: '98767975604431411',
  'first-stand': '113464388705111224',
};

interface SchedulePages {
  readonly older?: string | null;
  readonly newer?: string | null;
}

interface ScheduleResponse {
  readonly data: {
    readonly schedule: {
      readonly pages?: SchedulePages;
      readonly events: readonly unknown[];
    };
  };
}

async function fetchPage(leagueId: string, pageToken?: string): Promise<ScheduleResponse> {
  const params = new URLSearchParams({ hl: 'ko-KR', leagueId });
  if (pageToken !== undefined) params.set('pageToken', pageToken);
  const url = `${API_BASE}/getSchedule?${params.toString()}`;

  const response = await fetch(url, { headers: { 'x-api-key': API_KEY } });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status} ${response.statusText}): ${url}`);
  }
  return (await response.json()) as ScheduleResponse;
}

function writeFixture(name: string, json: ScheduleResponse): void {
  const path = `${OUTPUT_DIR}/${name}.json`;
  writeFileSync(path, JSON.stringify(json, null, 2));
  const eventCount = json.data.schedule.events.length;
  console.log(`  ✓ ${path}  (events: ${eventCount})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureLeague(slug: string, leagueId: string): Promise<void> {
  console.log(`\n=== ${slug} (${leagueId}) ===`);

  const initial = await fetchPage(leagueId);
  writeFixture(`${slug}-newer-1`, initial);

  let token = initial.data.schedule.pages?.newer ?? undefined;
  let pageIndex = 2;
  while (token && pageIndex <= MAX_PAGES_PER_DIRECTION) {
    await sleep(DELAY_MS);
    const page = await fetchPage(leagueId, token);
    writeFixture(`${slug}-newer-${pageIndex}`, page);
    token = page.data.schedule.pages?.newer ?? undefined;
    pageIndex++;
  }
  if (token) {
    console.log(`  (newer 더 있음 — safety guard ${MAX_PAGES_PER_DIRECTION}에서 중단)`);
  }

  token = initial.data.schedule.pages?.older ?? undefined;
  pageIndex = 1;
  while (token && pageIndex <= MAX_PAGES_PER_DIRECTION) {
    await sleep(DELAY_MS);
    const page = await fetchPage(leagueId, token);
    writeFixture(`${slug}-older-${pageIndex}`, page);
    token = page.data.schedule.pages?.older ?? undefined;
    pageIndex++;
  }
  if (token) {
    console.log(`  (older 더 있음 — safety guard ${MAX_PAGES_PER_DIRECTION}에서 중단)`);
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const [slug, id] of Object.entries(LEAGUES)) {
  await captureLeague(slug, id);
}

console.log('\n캡처 완료.');
