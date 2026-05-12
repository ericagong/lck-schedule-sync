import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseScheduleResponse } from '../../src/lolesports.js';

const fixturePath = resolve(__dirname, '../../fixtures/lck-schedule-sample.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Parameters<
  typeof parseScheduleResponse
>[0];

describe('parseScheduleResponse', () => {
  it('type !== "match"인 event는 제외한다', () => {
    const { matches } = parseScheduleResponse(fixture);
    // fixture에 show 1개 포함, match 3개
    expect(matches).toHaveLength(3);
  });

  it('match.id를 그대로 보존한다 (UID 멱등성)', () => {
    const { matches } = parseScheduleResponse(fixture);
    expect(matches[0]?.id).toBe('115548128962840643');
  });

  it('영문 팀명을 한국어로 변환한다', () => {
    const { matches } = parseScheduleResponse(fixture);
    const gen_t1 = matches.find((m) => m.id === '115548128962840643');
    expect(gen_t1?.teamA.displayName).toBe('젠지');
    expect(gen_t1?.teamB.displayName).toBe('T1');
  });

  it('startTime을 startsAt으로 그대로 보존한다 (UTC ISO 8601)', () => {
    const { matches } = parseScheduleResponse(fixture);
    expect(matches[0]?.startsAt).toBe('2026-04-08T10:00:00Z');
  });

  it('state를 status로 정규화한다', () => {
    const { matches } = parseScheduleResponse(fixture);
    expect(matches[0]?.status).toBe('completed'); // state: "completed"
    expect(matches[1]?.status).toBe('scheduled'); // state: "unstarted"
  });

  it('strategy.count를 bestOf로 보존한다', () => {
    const { matches } = parseScheduleResponse(fixture);
    expect(matches[0]?.bestOf).toBe(3);
  });

  it('blockName을 tournament.stage로 보존한다', () => {
    const { matches } = parseScheduleResponse(fixture);
    expect(matches[0]?.tournament.stage).toBe('2주 차');
  });

  it('league.name을 tournament.displayName으로 보존한다', () => {
    const { matches } = parseScheduleResponse(fixture);
    expect(matches[0]?.tournament.displayName).toBe('LCK');
  });
});
