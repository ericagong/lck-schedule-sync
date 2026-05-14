/**
 * Phase 3 시각 검증 — fixtures/phase-3/* → 무필터 ICS (6 대회 전체).
 *
 * 사용:
 *   pnpm exec tsx scripts/verify-phase-3.ts
 *   open public/phase-3-verify.ics
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEAGUES, Match } from '../src/match.js';
import { generateIcs } from '../src/ics.js';
import type { NaverScheduleResponse } from '../src/naver.js';

const FIXTURE_DIR = resolve('fixtures/phase-3');
const OUTPUT = 'public/phase-3-verify.ics';

const files = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

const all: Match[] = [];
const perFile: Array<{ file: string; topLeagueId: string; count: number }> = [];

for (const file of files) {
  const m = file.match(/^(.+)-\d{4}-\d{2}\.json$/);
  if (!m) continue;
  const topLeagueId = m[1] ?? 'unknown';

  const json = JSON.parse(
    readFileSync(resolve(FIXTURE_DIR, file), 'utf-8'),
  ) as NaverScheduleResponse;
  const items = json.content?.matches ?? [];
  const matches = Match.fromList([...items]);
  all.push(...matches);
  perFile.push({ file, topLeagueId, count: matches.length });
}

const active = all.filter((m) => m.isActive);

const ics = generateIcs(active, {
  calendarName: 'Phase 3 검증 — Naver 6 대회 전체 (무필터)',
});
writeFileSync(OUTPUT, ics);

console.log(`✓ ${active.length} matches → ${OUTPUT}\n`);

console.log('--- 파일별 캡처 분포 ---');
for (const r of perFile) {
  const display = LEAGUES[r.topLeagueId as keyof typeof LEAGUES] ?? 'Unknown';
  console.log(`  ${r.count.toString().padStart(3)} ${r.file}  (display=${display})`);
}

const counts = new Map<string, number>();
const stages = new Map<string, Set<string>>();
for (const m of active) {
  const league = m.tournament.displayName;
  counts.set(league, (counts.get(league) ?? 0) + 1);
  if (!stages.has(league)) stages.set(league, new Set());
  stages.get(league)?.add(m.tournament.stage);
}

console.log('\n--- 대회별 분포 ---');
for (const [league, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(3)} ${league}`);
  console.log(`        stages: ${[...(stages.get(league) ?? [])].join(' / ')}`);
}
