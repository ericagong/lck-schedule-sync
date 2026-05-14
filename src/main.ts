/**
 * 진입점 — fetch → 변환 → filter → ICS → public/t1.ics.
 * 실패 시 process.exit(1) → GitHub Actions 워크플로 실패 → GitHub Pages는 마지막 성공본 유지.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { generateIcs } from './ics.js';
import { Match } from './match.js';
import { fetchAll } from './naver.js';

const LOG_PREFIX = '[lol-schedule-sync]';
const log = {
  info: (msg: string) => console.log(`${LOG_PREFIX} ${msg}`),
  error: (msg: string, err: unknown) => console.error(`${LOG_PREFIX} FATAL: ${msg}`, err),
};

const OUTPUT_PATH = resolve('public', 't1.ics');
async function createFile(content: string, path: string = OUTPUT_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf-8');
}

const TEAM_CODE = 'T1';
const CALENDAR_NAME = 'T1 LCK 일정';
async function main(): Promise<void> {
  log.info('Fetch Match Schedules from NaverEsports...');

  const rawMatches = await fetchAll();

  log.info(`Got ${rawMatches.length} Matches Successfully!`);

  const matches = Match.fromList(rawMatches);

  const teamMatches = matches.filter((m) => m.involves(TEAM_CODE) && m.isActive);

  const ics = generateIcs(teamMatches, { calendarName: CALENDAR_NAME });

  await createFile(ics);

  log.info(`${teamMatches.length}개 ${TEAM_CODE} 매치 → ${OUTPUT_PATH} 기록 완료.`);
}

main().catch((err) => {
  log.error('Failed to publish T1 ICS — GitHub Pages는 마지막 성공본 유지', err);
  process.exit(1);
});
