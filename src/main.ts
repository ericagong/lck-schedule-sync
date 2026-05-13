/**
 * 진입점.
 *
 * side effect 모음:
 * 1) lolesports API fetch (LCK · MSI · Worlds · First Stand)
 * 2) T1 ICS 생성
 * 3) public/t1.ics에 쓰기
 *
 * GitHub Actions에서 `pnpm dev` 또는 `tsx src/main.ts`로 실행.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { fetchAllMatches } from './lolesports.js';
import { buildIcsForTeam } from './pipeline.js';

const OUTPUT_PATH = resolve(process.cwd(), 'public', 't1.ics');
const TEAM_CODE = 'T1';

async function main(): Promise<void> {
  console.log(`[lck-schedule-sync] Fetching schedules (LCK + MSI + Worlds + First Stand)...`);
  const allMatches = await fetchAllMatches();
  console.log(`[lck-schedule-sync] Fetched ${allMatches.length} matches across 4 leagues.`);

  const { ics, count } = buildIcsForTeam({
    matches: allMatches,
    teamCode: TEAM_CODE,
    icsOptions: { calendarName: 'T1 LCK 일정' },
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, ics, 'utf-8');

  console.log(`[lck-schedule-sync] Wrote ${count} ${TEAM_CODE} matches → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('[lck-schedule-sync] FATAL:', err);
  process.exit(1);
});
