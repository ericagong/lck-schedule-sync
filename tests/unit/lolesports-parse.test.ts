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

  it('Bo1/Bo3/Bo5가 아닌 매치는 silent drop 한다 (Bo2/Bo7 회귀)', () => {
    // lolesports 실측상 Bo1/3/5만 관찰되지만 — 정책 회귀 방지용
    const response = {
      data: {
        schedule: {
          pages: { older: null, newer: null },
          events: [
            {
              startTime: '2026-10-01T10:00:00Z',
              state: 'unstarted',
              type: 'match',
              blockName: '결승',
              league: { name: '월드 챔피언십', slug: 'worlds' },
              match: {
                id: 'bo7-fake-final',
                teams: [
                  { name: 'T1', code: 'T1' },
                  { name: 'Gen.G Esports', code: 'GEN' },
                ],
                strategy: { type: 'bestOf', count: 7 },
              },
            },
            {
              startTime: '2026-04-01T10:00:00Z',
              state: 'unstarted',
              type: 'match',
              blockName: '쇼매치',
              league: { name: 'LCK', slug: 'lck' },
              match: {
                id: 'bo2-fake-show',
                teams: [
                  { name: 'T1', code: 'T1' },
                  { name: 'KT Rolster', code: 'KT' },
                ],
                strategy: { type: 'bestOf', count: 2 },
              },
            },
          ],
        },
      },
    } as Parameters<typeof parseScheduleResponse>[0];

    const { matches } = parseScheduleResponse(response);
    expect(matches).toHaveLength(0);
  });
});

describe('parseScheduleResponse — Phase 2 leagues (MSI · Worlds · First Stand)', () => {
  function loadFixture(name: string): Parameters<typeof parseScheduleResponse>[0] {
    return JSON.parse(
      readFileSync(resolve(__dirname, `../../fixtures/${name}`), 'utf-8'),
    ) as Parameters<typeof parseScheduleResponse>[0];
  }

  describe('MSI', () => {
    const fixture = loadFixture('msi-schedule-sample.json');

    it('sample 3 매치를 동일 parser로 모두 변환한다 (DTO 동일성 회귀)', () => {
      const { matches } = parseScheduleResponse(fixture);
      expect(matches).toHaveLength(3);
    });

    it('league.name "MSI"가 tournament.displayName으로 흐른다', () => {
      const { matches } = parseScheduleResponse(fixture);
      expect(matches.every((m) => m.tournament.displayName === 'MSI')).toBe(true);
    });

    it('MSI blockName(플레이-인 / 토너먼트 스테이지 / 결승)이 stage로 흐른다', () => {
      const { matches } = parseScheduleResponse(fixture);
      const stages = new Set(matches.map((m) => m.tournament.stage));
      expect(stages.size).toBeGreaterThanOrEqual(2); // sample이 1-per-blockName 추출
    });
  });

  describe('Worlds', () => {
    const fixture = loadFixture('worlds-schedule-sample.json');

    it('sample 5 매치를 동일 parser로 모두 변환한다', () => {
      const { matches } = parseScheduleResponse(fixture);
      expect(matches).toHaveLength(5);
    });

    it('한국어 league.name "월드 챔피언십"이 tournament.displayName으로 흐른다', () => {
      const { matches } = parseScheduleResponse(fixture);
      expect(matches.every((m) => m.tournament.displayName === '월드 챔피언십')).toBe(true);
    });

    it('Worlds blockName(스위스 / 8강 / 4강 / 결승 등)이 stage로 흐른다', () => {
      const { matches } = parseScheduleResponse(fixture);
      const stages = new Set(matches.map((m) => m.tournament.stage));
      expect(stages.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('First Stand', () => {
    const fixture = loadFixture('first-stand-schedule-sample.json');

    it('sample 4 매치를 동일 parser로 모두 변환한다', () => {
      const { matches } = parseScheduleResponse(fixture);
      expect(matches).toHaveLength(4);
    });

    it('league.name "First Stand"가 tournament.displayName으로 흐른다', () => {
      const { matches } = parseScheduleResponse(fixture);
      expect(matches.every((m) => m.tournament.displayName === 'First Stand')).toBe(true);
    });

    it('First Stand blockName(1라운드 / 그룹 / 4강 / 결승)이 stage로 흐른다', () => {
      const { matches } = parseScheduleResponse(fixture);
      const stages = new Set(matches.map((m) => m.tournament.stage));
      expect(stages.size).toBeGreaterThanOrEqual(2);
    });
  });

  it('events가 빈 배열이면 빈 Match[]을 반환한다 (시즌 미발표 시점 처리)', () => {
    const empty = {
      data: {
        schedule: {
          pages: { older: null, newer: null },
          events: [],
        },
      },
    } as Parameters<typeof parseScheduleResponse>[0];
    const { matches } = parseScheduleResponse(empty);
    expect(matches).toHaveLength(0);
  });
});
