/**
 * Phase 2 시각 검증용 ICS 빌드.
 *
 * 목적: 캡처된 raw fixture(fixtures/phase-2/*)를 그대로 production parser +
 * ics-generator에 통과시켜 팀 필터 없는 ICS를 생성. 4 league 모든 매치가
 * 한 캘린더 안에 들어가므로 SUMMARY·시간·stage 시각 검증 가능.
 *
 * 사용:
 *   pnpm exec tsx scripts/verify-phase-2.ts
 *   open public/phase-2-verify.ics    # macOS — 새 캘린더로 import 권장
 *
 * 산출물은 .gitignore의 `public/*.ics`에 매치되어 트래킹 안 됨.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import type { Match } from '../src/core/types.js';
import { excludeCanceled } from '../src/filter.js';
import { generateIcs } from '../src/ics-generator.js';
import { parseScheduleResponse } from '../src/lolesports.js';

const FIXTURES = [
  'fixtures/phase-2/msi-newer-1.json',
  'fixtures/phase-2/worlds-newer-1.json',
  'fixtures/phase-2/worlds-older-1.json',
  'fixtures/phase-2/first-stand-newer-1.json',
];

const OUTPUT = 'public/phase-2-verify.ics';

const all: Match[] = [];
for (const path of FIXTURES) {
  const json = JSON.parse(readFileSync(path, 'utf-8')) as Parameters<
    typeof parseScheduleResponse
  >[0];
  const { matches } = parseScheduleResponse(json);
  all.push(...matches);
}

const active = excludeCanceled(all);
const sorted = [...active].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

const ics = generateIcs(sorted, {
  calendarName: 'Phase 2 검증 — MSI · Worlds · First Stand 전체',
});
writeFileSync(OUTPUT, ics);

console.log(`✓ ${sorted.length} matches → ${OUTPUT}\n`);

const counts = new Map<string, number>();
const stages = new Map<string, Set<string>>();
for (const m of sorted) {
  const league = m.tournament.displayName;
  counts.set(league, (counts.get(league) ?? 0) + 1);
  if (!stages.has(league)) stages.set(league, new Set());
  stages.get(league)?.add(m.tournament.stage);
}

console.log('--- 대회별 분포 ---');
for (const [league, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(3)} ${league}`);
  console.log(`        stages: ${[...(stages.get(league) ?? [])].join(' / ')}`);
}
