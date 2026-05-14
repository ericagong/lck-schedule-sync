import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Match } from '../../src/match.js';
import type { NaverMatch, NaverScheduleResponse } from '../../src/naver.js';

function loadFixture(name: string): NaverScheduleResponse {
  const path = resolve(__dirname, `../../fixtures/${name}`);
  return JSON.parse(readFileSync(path, 'utf-8')) as NaverScheduleResponse;
}

function parseFixture(name: string): Match[] {
  const response = loadFixture(name);
  return Match.fromList(response.content?.matches ?? []);
}

describe('Match.from — LCK sample', () => {
  const matches = parseFixture('naver-lck-sample.json');

  it('샘플 4개 매치 모두 Match로 변환', () => {
    expect(matches).toHaveLength(4);
  });

  it('UID는 "naver:" 접두', () => {
    expect(matches[0]?.id).toBe('naver:2026050117ii8PCnB4429lol');
  });

  it('startDate epoch ms → ISO 8601 UTC', () => {
    expect(matches[0]?.startsAt).toBe('2026-05-01T08:00:00.000Z');
  });

  it('title → tournament.stage', () => {
    expect(matches[0]?.tournament.stage).toBe('정규시즌 1R');
  });

  it('topLeagueId → LEAGUES 룩업 → tournament.displayName', () => {
    expect(matches[0]?.tournament.displayName).toBe('LCK');
  });

  it('homeTeam → teamA (code = nameEngAcronym, displayName = name)', () => {
    expect(matches[0]?.teamA.code).toBe('DNS');
    expect(matches[0]?.teamA.displayName).toBe('DN 수퍼스');
  });

  it('awayTeam → teamB', () => {
    expect(matches[0]?.teamB.code).toBe('BRO');
    expect(matches[0]?.teamB.displayName).toBe('한진 브리온');
  });

  it('maxMatchCount 3 → bestOf 3', () => {
    expect(matches[0]?.bestOf).toBe(3);
  });

  it('matchStatus RESULT → status completed', () => {
    expect(matches[0]?.status).toBe('completed');
  });
});

describe('Match.from — status enum 매핑', () => {
  const baseRaw: NaverMatch = {
    gameId: 'g1',
    topLeagueId: 'lck',
    leagueId: 'lck_2026',
    title: '정규시즌 1R',
    startDate: 1777622400000,
    maxMatchCount: 3,
    matchStatus: 'BEFORE',
    homeTeam: { name: 'T1', nameEngAcronym: 'T1' },
    awayTeam: { name: '젠지', nameEngAcronym: 'GEN' },
  };

  it('BEFORE → scheduled', () => {
    expect(Match.from({ ...baseRaw, matchStatus: 'BEFORE' })?.status).toBe('scheduled');
  });

  it('RESULT → completed', () => {
    expect(Match.from({ ...baseRaw, matchStatus: 'RESULT' })?.status).toBe('completed');
  });

  it('CANCEL → canceled', () => {
    expect(Match.from({ ...baseRaw, matchStatus: 'CANCEL' })?.status).toBe('canceled');
  });

  it('알려지지 않은 상태(DELAYED 등) → scheduled (안전 기본값)', () => {
    expect(
      // @ts-expect-error — 타입상 알려진 3값만 허용. 런타임 fallback(normalizeStatus default) 검증.
      Match.from({ ...baseRaw, matchStatus: 'DELAYED' })?.status,
    ).toBe('scheduled');
  });
});

describe('Match.from — maxMatchCount (1/3/5 통과, 그 외 throw)', () => {
  // count: number로 열어두고 cast 내장 — 테스트에서 계약 위반 시나리오(2,7) 검증 위해 의도된 escape hatch.
  function makeRaw(count: number): NaverMatch {
    return {
      gameId: 'g1',
      topLeagueId: 'lck',
      leagueId: 'lck_2026',
      title: '결승',
      startDate: 1777622400000,
      maxMatchCount: count as NaverMatch['maxMatchCount'],
      matchStatus: 'BEFORE',
      homeTeam: { name: 'T1', nameEngAcronym: 'T1' },
      awayTeam: { name: '젠지', nameEngAcronym: 'GEN' },
    };
  }

  it('Bo1 → 통과', () => {
    expect(Match.from(makeRaw(1))).not.toBeNull();
  });
  it('Bo3 → 통과', () => {
    expect(Match.from(makeRaw(3))).not.toBeNull();
  });
  it('Bo5 → 통과', () => {
    expect(Match.from(makeRaw(5))).not.toBeNull();
  });
  it('Bo2 → throw (Naver 계약 위반)', () => {
    expect(() => Match.from(makeRaw(2))).toThrow(/Naver 계약 위반/);
  });
  it('Bo7 → throw (Naver 계약 위반)', () => {
    expect(() => Match.from(makeRaw(7))).toThrow(/Naver 계약 위반/);
  });
});

describe('Match.from — TBD/팀 누락 안전 처리', () => {
  function makeRaw(home: NaverMatch['homeTeam'], away: NaverMatch['awayTeam']): NaverMatch {
    return {
      gameId: 'g1',
      topLeagueId: 'lck',
      leagueId: 'lck_2026',
      title: '결승',
      startDate: 1777622400000,
      maxMatchCount: 5,
      matchStatus: 'BEFORE',
      homeTeam: home,
      awayTeam: away,
    };
  }

  it('homeTeam null → null', () => {
    expect(Match.from(makeRaw(null, { name: '젠지', nameEngAcronym: 'GEN' }))).toBeNull();
  });
  it('awayTeam null → null', () => {
    expect(Match.from(makeRaw({ name: 'T1', nameEngAcronym: 'T1' }, null))).toBeNull();
  });
  it('nameEngAcronym 비어있으면 null', () => {
    expect(
      Match.from(
        makeRaw({ name: 'T1', nameEngAcronym: '' }, { name: '젠지', nameEngAcronym: 'GEN' }),
      ),
    ).toBeNull();
  });
  it('name(한국어) 비어있으면 null', () => {
    expect(
      Match.from(
        makeRaw({ name: '', nameEngAcronym: 'T1' }, { name: '젠지', nameEngAcronym: 'GEN' }),
      ),
    ).toBeNull();
  });
});

describe('Match.from — alien topLeagueId (LEAGUES 미등록)', () => {
  const baseRaw: NaverMatch = {
    gameId: 'g1',
    topLeagueId: 'unknown_xyz',
    leagueId: 'whatever',
    title: '1주 차',
    startDate: 1777622400000,
    maxMatchCount: 3,
    matchStatus: 'BEFORE',
    homeTeam: { name: 'T1', nameEngAcronym: 'T1' },
    awayTeam: { name: '젠지', nameEngAcronym: 'GEN' },
  };

  it('LEAGUES에 없는 topLeagueId → null (silent skip)', () => {
    expect(Match.from(baseRaw)).toBeNull();
  });

  it('빈 문자열 topLeagueId → null', () => {
    expect(Match.from({ ...baseRaw, topLeagueId: '' })).toBeNull();
  });
});

describe('envelope unwrap — 빈 응답 안전 처리', () => {
  it('content가 null이면 빈 배열', () => {
    const response = { code: 200, message: null, content: null } as NaverScheduleResponse;
    const matches = Match.fromList(response.content?.matches ?? []);
    expect(matches).toEqual([]);
  });

  it('invalid topLeagueId (matches=[]) → 빈 배열', () => {
    expect(parseFixture('naver-empty-sample.json')).toEqual([]);
  });
});

describe('Match.fromList — 6 대회 fixture smoke test (DTO 안정성)', () => {
  const cases: ReadonlyArray<readonly [string, string, number]> = [
    ['naver-lck-sample.json', 'LCK', 4],
    ['naver-msi-sample.json', 'MSI', 3],
    ['naver-worlds-sample.json', '월드 챔피언십', 3],
    ['naver-first-stand-sample.json', 'First Stand', 3],
    ['naver-ewc-sample.json', 'EWC', 3],
    ['naver-kespa-sample.json', 'KeSPA Cup', 3],
  ];

  it.each(cases)('%s → %s display, %i 매치', (file, display, expected) => {
    const matches = parseFixture(file);
    expect(matches).toHaveLength(expected);
    expect(matches.every((m) => m.tournament.displayName === display)).toBe(true);
    expect(matches.every((m) => m.id.startsWith('naver:'))).toBe(true);
  });
});

describe('Match 도메인 술어 + inline filter', () => {
  const STATUS_TO_NAVER = {
    scheduled: 'BEFORE',
    completed: 'RESULT',
    canceled: 'CANCEL',
  } as const;

  function makeMatch(opts: {
    id: string;
    teamA: { code: string; name: string };
    teamB: { code: string; name: string };
    startsAt: string;
    status: keyof typeof STATUS_TO_NAVER;
  }): Match {
    const raw: NaverMatch = {
      gameId: opts.id,
      topLeagueId: 'lck',
      leagueId: 'lck_2026',
      title: '1주 차',
      startDate: new Date(opts.startsAt).getTime(),
      maxMatchCount: 3,
      matchStatus: STATUS_TO_NAVER[opts.status],
      homeTeam: { name: opts.teamA.name, nameEngAcronym: opts.teamA.code },
      awayTeam: { name: opts.teamB.name, nameEngAcronym: opts.teamB.code },
    };
    const m = Match.from(raw);
    if (!m) throw new Error('Match.from returned null');
    return m;
  }

  const matches = [
    makeMatch({
      id: 'm1',
      teamA: { code: 'T1', name: 'T1' },
      teamB: { code: 'GEN', name: '젠지' },
      startsAt: '2026-05-15T10:00:00Z',
      status: 'scheduled',
    }),
    makeMatch({
      id: 'm2',
      teamA: { code: 'HLE', name: '한화생명' },
      teamB: { code: 'DRX', name: 'DRX' },
      startsAt: '2026-05-16T10:00:00Z',
      status: 'scheduled',
    }),
    makeMatch({
      id: 'm3',
      teamA: { code: 'GEN', name: '젠지' },
      teamB: { code: 'T1', name: 'T1' },
      startsAt: '2026-05-10T10:00:00Z',
      status: 'canceled',
    }),
    makeMatch({
      id: 'm4',
      teamA: { code: 'T1', name: 'T1' },
      teamB: { code: 'KT', name: 'KT' },
      startsAt: '2026-05-12T10:00:00Z',
      status: 'completed',
    }),
  ];

  it('involves: 출전 팀 코드면 true', () => {
    expect(matches[0]!.involves('T1')).toBe(true);
    expect(matches[0]!.involves('GEN')).toBe(true);
  });

  it('involves: 미출전 팀이면 false', () => {
    expect(matches[0]!.involves('HLE')).toBe(false);
  });

  it('isActive: scheduled/completed는 true', () => {
    expect(matches[0]!.isActive).toBe(true);
    expect(matches[3]!.isActive).toBe(true);
  });

  it('isActive: canceled는 false', () => {
    expect(matches[2]!.isActive).toBe(false);
  });

  it('inline filter (main.ts 패턴): involves + isActive 합성', () => {
    const result = matches.filter((m) => m.involves('T1') && m.isActive);
    expect(result.map((m) => m.id)).toEqual(['naver:m1', 'naver:m4']);
  });

  it('inline filter: 해당 팀 없으면 빈 배열', () => {
    expect(matches.filter((m) => m.involves('NONEXISTENT') && m.isActive)).toEqual([]);
  });

  it('inline filter: 입력 배열 불변', () => {
    const before = matches.map((m) => m.id);
    matches.filter((m) => m.involves('T1') && m.isActive);
    expect(matches.map((m) => m.id)).toEqual(before);
  });
});
