/**
 * 진입점.
 *
 * side effect 모음:
 * 1) 데이터 fetch — 네이버 esports primary + lolesports fallback (data-source.ts에 합성 추출)
 * 2) T1 ICS 생성
 * 3) public/t1.ics에 쓰기
 * 4) `.fetch-source` marker 파일 기록 — GitHub Actions가 fallback 발동 감지 시 Issue 자동 생성
 *
 * GitHub Actions에서 `pnpm dev` 또는 `tsx src/main.ts`로 실행.
 *
 * Fallback 정책 (Phase 3):
 *   네이버 호출 중 어느 한 (league, month) 조합이라도 throw하면 전체를 lolesports로
 *   재시도. partial 혼합은 "어떤 매치는 naver:..., 어떤 매치는 lolesports..." UID 충돌
 *   위험 + 운영자 혼란이라 피함. 매일 2회 cron이 다음 회차에서 정상 회복.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { fetchWithFallback } from './data-source.js';
import { fetchAllMatches as fetchFromLolesports } from './lolesports.js';
import { fetchAllNaverMatches } from './naver.js';
import { buildIcsForTeam } from './pipeline.js';

const OUTPUT_PATH = resolve(process.cwd(), 'public', 't1.ics');
// public/ 밖에 두는 이유: GitHub Pages에 marker가 함께 배포되지 않게.
// GitHub Actions가 같은 워크플로 안에서 읽고 폴백 알람 트리거.
const FALLBACK_MARKER_PATH = resolve(process.cwd(), '.fetch-source');
const TEAM_CODE = 'T1';

async function main(): Promise<void> {
  console.log('[lck-schedule-sync] Fetching from Naver esports (primary)…');
  const fetched = await fetchWithFallback(fetchAllNaverMatches, fetchFromLolesports, {
    primaryName: 'Naver esports',
    fallbackName: 'lolesports (Phase 2 코드)',
  });

  if (fetched.source === 'primary') {
    console.log(
      `[lck-schedule-sync] Naver returned ${fetched.matches.length} matches across 6 leagues.`,
    );
  } else {
    console.warn(
      `[lck-schedule-sync] ⚠️  Lolesports fallback returned ${fetched.matches.length} matches. KeSPA·EWC는 lolesports 미커버라 누락됨 — 다음 cron에서 정상 회복 기대.`,
    );
  }

  const { ics, count } = buildIcsForTeam({
    matches: fetched.matches,
    teamCode: TEAM_CODE,
    icsOptions: { calendarName: 'T1 LCK 일정' },
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, ics, 'utf-8');
  await writeFile(FALLBACK_MARKER_PATH, fetched.source, 'utf-8');

  console.log(
    `[lck-schedule-sync] Wrote ${count} ${TEAM_CODE} matches → ${OUTPUT_PATH} (source=${fetched.source})`,
  );
}

main().catch((err) => {
  console.error('[lck-schedule-sync] FATAL:', err);
  process.exit(1);
});
