/**
 * 진입점.
 *
 * side effect:
 * 1) 네이버 esports에서 6 대회 매치 fetch (naver.ts)
 * 2) T1 ICS 생성 (pipeline.ts)
 * 3) public/t1.ics 기록
 *
 * GitHub Actions에서 `pnpm dev` 또는 `tsx src/main.ts`로 실행.
 *
 * 실패 시 정책:
 *   fetchAllNaverMatches가 throw하면 main()이 그대로 propagate → process.exit(1).
 *   GitHub Actions 워크플로가 실패로 인지하고 자동 알림. ICS 파일은 갱신되지
 *   않으므로 GitHub Pages는 마지막 성공본을 계속 서빙 — 사용자 캘린더에서
 *   기존 매치는 그대로 유지되고 신규 매치만 다음 cron까지 lag.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { fetchAllNaverMatches } from './naver.js';
import { buildIcsForTeam } from './pipeline.js';

const OUTPUT_PATH = resolve(process.cwd(), 'public', 't1.ics');
const TEAM_CODE = 'T1';

const LOG_PREFIX = '[lck-schedule-sync]';
const log = {
  info: (msg: string) => console.log(`${LOG_PREFIX} ${msg}`),
  error: (msg: string, err: unknown) => console.error(`${LOG_PREFIX} FATAL: ${msg}`, err),
};

async function main(): Promise<void> {
  log.info('네이버 esports에서 fetch 시작…');
  const matches = await fetchAllNaverMatches();
  log.info(`네이버 응답 ${matches.length}개 매치 (6 대회 통합).`);

  // TODO: 굳이 파일 분리 불필요함
  const { ics, count } = buildIcsForTeam({
    matches,
    teamCode: TEAM_CODE,
    icsOptions: { calendarName: 'T1 LCK 일정' },
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, ics, 'utf-8');

  log.info(`${count}개 ${TEAM_CODE} 매치 → ${OUTPUT_PATH} 기록 완료.`);
}

main().catch((err) => {
  log.error('main() 실패', err);
  process.exit(1);
});
