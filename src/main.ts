/**
 * 진입점 — fetch → 팀별 filter + ICS 발행 + landing page 발행.
 * 실패 시 process.exit(1) → 워크플로 실패 → GitHub Pages는 마지막 성공본 유지.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { generateIcs } from './ics.js';
import { buildIndexHtml } from './landing.js';
import type { Match } from './match.js';
import { fetchAllMatches } from './naver.js';
import { LCK_TEAM_DISPLAY_NAME, LCK_TEAMS, type LckTeamCode } from './team.js';

const PUBLIC_DIR = resolve('public');
const BASE_URL = 'https://ericagong.github.io/lck-schedule-sync';
const LOG_PREFIX = '[lol-schedule-sync]';

const log = {
  info: (msg: string) => console.log(`${LOG_PREFIX} ${msg}`),
  error: (msg: string, err: unknown) => console.error(`${LOG_PREFIX} FATAL: ${msg}`, err),
};

function icsFilename(teamCode: LckTeamCode): string {
  return `${teamCode.toLowerCase()}.ics`;
}

function calendarName(teamCode: LckTeamCode): string {
  return `${LCK_TEAM_DISPLAY_NAME[teamCode]} LCK 일정`;
}

async function publishTeamIcs(matches: readonly Match[], teamCode: LckTeamCode): Promise<number> {
  const teamMatches = matches.filter((m) => m.involves(teamCode) && m.isActive);
  const ics = generateIcs(teamMatches, { calendarName: calendarName(teamCode) });
  await writeFile(resolve(PUBLIC_DIR, icsFilename(teamCode)), ics, 'utf-8');
  return teamMatches.length;
}

async function publishLandingPage(): Promise<void> {
  const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
  await writeFile(resolve(PUBLIC_DIR, 'index.html'), html, 'utf-8');
}

async function main(): Promise<void> {
  log.info('Fetch Match Schedules from NaverEsports...');
  const matches = await fetchAllMatches();
  log.info(`Got ${matches.length} matches.`);

  await mkdir(PUBLIC_DIR, { recursive: true });

  for (const teamCode of LCK_TEAMS) {
    const count = await publishTeamIcs(matches, teamCode);
    log.info(`${count.toString().padStart(2)} ${teamCode.padEnd(4)} → ${icsFilename(teamCode)}`);
  }

  await publishLandingPage();
  log.info(`landing page → index.html`);
}

main().catch((err) => {
  log.error('Failed to publish ICS', err);
  process.exit(1);
});
