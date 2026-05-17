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
const LOG_PREFIX = '[lck-schedule-sync]';

const log = {
  info: (msg: string) => console.log(`${LOG_PREFIX} ${msg}`),
  error: (msg: string, err: unknown) => console.error(`${LOG_PREFIX} FATAL: ${msg}`, err),
};

function icsFilename(teamCode: LckTeamCode): string {
  return `${teamCode.toLowerCase()}.ics`;
}

function calendarName(teamCode: LckTeamCode): string {
  return `${LCK_TEAM_DISPLAY_NAME[teamCode]} 경기 일정`;
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

  // Sanity check — fetch는 성공했지만 모든 매치가 parse fail이면 silent fail.
  // 빈 ICS 발행 시 사용자 캘린더 통째 비어지므로 명시적으로 워크플로 실패시킴.
  // 시즌 외 기간(LCK 휴식기)에도 KeSPA·국제대회 등 어딘가에 매치가 있어야 정상.
  if (matches.length === 0) {
    throw new Error(
      'Suspicious: 0 matches from naver — silent fail 의심 (네이버 응답 구조 변경 가능성)',
    );
  }

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
