/**
 * Phase 3 시각 검증용 ICS 빌드 (네이버 데이터 소스).
 *
 * 목적: 캡처된 raw fixture(fixtures/phase-3/*)를 그대로 production parser +
 * ics-generator에 통과시켜 팀 필터 없는 ICS를 생성. 6 league 모든 매치가
 * 한 캘린더 안에 들어가므로 SUMMARY·시간·stage·한국어 팀명 시각 검증 가능.
 *
 * 특이점:
 * - 데이터 소스: 네이버 esports JSON (fixtures/phase-3/*.json)
 * - UID: 네이버 매치는 `naver:` 접두 (소스 namespace)
 * - displayName 주입: topLeagueId → 한국어 매핑 (응답에 inline 없음)
 *
 * 사용:
 *   pnpm exec tsx scripts/verify-phase-3.ts
 *   open public/phase-3-verify.ics    # macOS — 새 캘린더로 구독·import
 *
 * 산출물은 .gitignore의 `public/*.ics`에 매치되어 트래킹 안 됨.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Match } from '../src/core/types.js';
import { excludeCanceled } from '../src/filter.js';
import { generateIcs } from '../src/ics-generator.js';
import {
  NAVER_LEAGUE_DISPLAY_NAMES,
  parseNaverResponse,
  type NaverScheduleResponse,
} from '../src/naver.js';

const FIXTURE_DIR = resolve('fixtures/phase-3');
const OUTPUT = 'public/phase-3-verify.ics';

// fixtures/phase-3/<topLeagueId>-<YYYY-MM>.json 형식의 파일 자동 탐지.
// invalid ID baseline 캡처 (lol_msi-*)도 포함되지만 displayName 'Unknown' 부여.
const files = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

const all: Match[] = [];
const perFile: Array<{ file: string; topLeagueId: string; count: number }> = [];

for (const file of files) {
  // 파일명에서 topLeagueId 추출: "<topLeagueId>-YYYY-MM.json"
  // topLeagueId 자체에 하이픈은 없으므로 마지막 "-YYYY-MM" 부분만 분리.
  const m = file.match(/^(.+)-\d{4}-\d{2}\.json$/);
  if (!m) continue;
  const topLeagueId = m[1] ?? 'unknown';
  const displayName = NAVER_LEAGUE_DISPLAY_NAMES[topLeagueId] ?? 'Unknown';

  const json = JSON.parse(
    readFileSync(resolve(FIXTURE_DIR, file), 'utf-8'),
  ) as NaverScheduleResponse;
  const { matches } = parseNaverResponse(json, displayName);
  all.push(...matches);
  perFile.push({ file, topLeagueId, count: matches.length });
}

const active = excludeCanceled(all);
const sorted = [...active].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

const ics = generateIcs(sorted, {
  calendarName: 'Phase 3 검증 — Naver 6 대회 전체 (무필터)',
});
writeFileSync(OUTPUT, ics);

console.log(`✓ ${sorted.length} matches → ${OUTPUT}\n`);

console.log('--- 파일별 캡처 분포 ---');
for (const r of perFile) {
  console.log(
    `  ${r.count.toString().padStart(3)} ${r.file}  (display=${NAVER_LEAGUE_DISPLAY_NAMES[r.topLeagueId] ?? 'Unknown'})`,
  );
}

const counts = new Map<string, number>();
const stages = new Map<string, Set<string>>();
for (const m of sorted) {
  const league = m.tournament.displayName;
  counts.set(league, (counts.get(league) ?? 0) + 1);
  if (!stages.has(league)) stages.set(league, new Set());
  stages.get(league)?.add(m.tournament.stage);
}

console.log('\n--- 대회별 분포 (parseNaverResponse 후) ---');
for (const [league, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(3)} ${league}`);
  console.log(`        stages: ${[...(stages.get(league) ?? [])].join(' / ')}`);
}
