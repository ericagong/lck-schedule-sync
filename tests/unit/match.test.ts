import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Match } from '../../src/match.js';
import { toMatch, toMatches } from '../../src/naver.js';
import { LEAGUE_DISPLAY_NAME } from '../../src/league.js';

type NaverEnvelope = { content: { matches: unknown[] } | null };

function loadFixture(name: string): NaverEnvelope {
  const path = resolve(__dirname, `../../fixtures/${name}`);
  return JSON.parse(readFileSync(path, 'utf-8')) as NaverEnvelope;
}

function parseFixture(name: string): Match[] {
  const response = loadFixture(name);
  return toMatches(response.content?.matches ?? []);
}

/**
 * 테스트 raw 빌더 — Naver 응답 모양(unknown raw)을 만듦.
 * 새 toMatch는 zod safeParse를 통과해야 통과 — 빈 문자열·null·non-Bo 모두 검증 시나리오.
 */
type RawOverrides = {
  gameId?: string;
  topLeagueId?: string;
  title?: string;
  startDate?: number;
  maxMatchCount?: number;
  matchStatus?: string;
  homeTeam?: { name: string; nameEngAcronym: string } | null;
  awayTeam?: { name: string; nameEngAcronym: string } | null;
};

function makeRaw(overrides: RawOverrides = {}): unknown {
  return {
    gameId: overrides.gameId ?? 'g1',
    topLeagueId: overrides.topLeagueId ?? 'lck',
    title: overrides.title ?? '정규시즌 1R',
    startDate: overrides.startDate ?? 1777622400000,
    maxMatchCount: overrides.maxMatchCount ?? 3,
    matchStatus: overrides.matchStatus ?? 'BEFORE',
    homeTeam:
      overrides.homeTeam === undefined ? { name: 'T1', nameEngAcronym: 'T1' } : overrides.homeTeam,
    awayTeam:
      overrides.awayTeam === undefined
        ? { name: '젠지', nameEngAcronym: 'GEN' }
        : overrides.awayTeam,
  };
}

describe('toMatch — LCK sample fixture', () => {
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

  it('title → stage', () => {
    expect(matches[0]?.stage).toBe('정규시즌 1R');
  });

  it('topLeagueId → 도메인 League (LCK)', () => {
    expect(matches[0]?.league).toBe('LCK');
  });

  it('homeTeam → teamA (LCK 도메인 표준 — code = LckTeamCode, displayName = 도메인 표준)', () => {
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

describe('toMatch — status enum 매핑', () => {
  it('BEFORE → scheduled', () => {
    expect(toMatch(makeRaw({ matchStatus: 'BEFORE' }))?.status).toBe('scheduled');
  });

  it('RESULT → completed', () => {
    expect(toMatch(makeRaw({ matchStatus: 'RESULT' }))?.status).toBe('completed');
  });

  it('CANCEL → canceled', () => {
    expect(toMatch(makeRaw({ matchStatus: 'CANCEL' }))?.status).toBe('canceled');
  });

  it('알려지지 않은 상태(DELAYED 등) → scheduled (안전 기본값)', () => {
    expect(toMatch(makeRaw({ matchStatus: 'DELAYED' }))?.status).toBe('scheduled');
  });
});

describe('toMatch — maxMatchCount (1/3/5 통과, 그 외 throw)', () => {
  it('Bo1 → 통과', () => {
    expect(toMatch(makeRaw({ maxMatchCount: 1 }))).not.toBeNull();
  });
  it('Bo3 → 통과', () => {
    expect(toMatch(makeRaw({ maxMatchCount: 3 }))).not.toBeNull();
  });
  it('Bo5 → 통과', () => {
    expect(toMatch(makeRaw({ maxMatchCount: 5 }))).not.toBeNull();
  });
  it('Bo2 → throw (BestOf 계약 위반)', () => {
    expect(() => toMatch(makeRaw({ maxMatchCount: 2 }))).toThrow(/bestOf 계약 위반/);
  });
  it('Bo7 → throw (BestOf 계약 위반)', () => {
    expect(() => toMatch(makeRaw({ maxMatchCount: 7 }))).toThrow(/bestOf 계약 위반/);
  });
});

describe('toMatch — TBD/팀 누락 안전 처리 (silent skip)', () => {
  it('homeTeam null → null', () => {
    expect(toMatch(makeRaw({ homeTeam: null }))).toBeNull();
  });
  it('awayTeam null → null', () => {
    expect(toMatch(makeRaw({ awayTeam: null }))).toBeNull();
  });
  it('nameEngAcronym 비어있으면 null', () => {
    expect(toMatch(makeRaw({ homeTeam: { name: 'T1', nameEngAcronym: '' } }))).toBeNull();
  });
  it('name(한국어) 비어있으면 null', () => {
    expect(toMatch(makeRaw({ homeTeam: { name: '', nameEngAcronym: 'T1' } }))).toBeNull();
  });
});

describe('toMatch — alien topLeagueId (도메인 미등록)', () => {
  it('NAVER_TO_LEAGUE에 없는 topLeagueId → null (silent skip)', () => {
    expect(toMatch(makeRaw({ topLeagueId: 'unknown_xyz' }))).toBeNull();
  });

  it('빈 문자열 topLeagueId → null', () => {
    expect(toMatch(makeRaw({ topLeagueId: '' }))).toBeNull();
  });
});

describe('toMatches — envelope unwrap 빈 응답 안전 처리', () => {
  it('content가 null인 경우(상위 호출자 통과 패턴) → 빈 배열', () => {
    const response: NaverEnvelope = { content: null };
    expect(toMatches(response.content?.matches ?? [])).toEqual([]);
  });

  it('invalid topLeagueId (matches=[]) → 빈 배열', () => {
    expect(parseFixture('naver-empty-sample.json')).toEqual([]);
  });
});

describe('toMatches — 6 대회 fixture smoke (DTO 안정성 + 도메인 League 매핑)', () => {
  const cases: ReadonlyArray<readonly [string, string, number]> = [
    ['naver-lck-sample.json', 'LCK', 4],
    ['naver-msi-sample.json', 'MSI', 3],
    ['naver-worlds-sample.json', 'WORLDS', 3],
    ['naver-first-stand-sample.json', 'FIRST_STAND', 3],
    ['naver-ewc-sample.json', 'EWC', 3],
    ['naver-kespa-sample.json', 'KESPA_CUP', 3],
  ];

  it.each(cases)('%s → League %s, %i 매치', (file, league, expected) => {
    const matches = parseFixture(file);
    expect(matches).toHaveLength(expected);
    expect(matches.every((m) => m.league === league)).toBe(true);
    expect(matches.every((m) => m.id.startsWith('naver:'))).toBe(true);
  });

  it('display 이름은 LEAGUE_DISPLAY_NAME으로 lookup (도메인 표준)', () => {
    expect(LEAGUE_DISPLAY_NAME.LCK).toBe('LCK');
    expect(LEAGUE_DISPLAY_NAME.WORLDS).toBe('월드 챔피언십');
    expect(LEAGUE_DISPLAY_NAME.FIRST_STAND).toBe('First Stand');
    expect(LEAGUE_DISPLAY_NAME.KESPA_CUP).toBe('KeSPA Cup');
  });
});

describe('toMatch — LCK 팀 displayName 도메인 표준 (Naver 표기 변화 흔들림 X)', () => {
  it('Naver name이 "Gen.G Esports"여도 LCK 표준 "젠지"로 override', () => {
    const m = toMatch(
      makeRaw({
        homeTeam: { name: 'Gen.G Esports', nameEngAcronym: 'GEN' },
      }),
    );
    expect(m?.teamA.displayName).toBe('젠지');
    expect(m?.teamA.code).toBe('GEN');
  });

  it('KRX (2026 키움증권 후원 — Naver 응답 name 무시, 도메인 표준 적용)', () => {
    const m = toMatch(
      makeRaw({
        homeTeam: { name: '아무거나', nameEngAcronym: 'KRX' },
      }),
    );
    expect(m?.teamA.code).toBe('KRX');
    expect(m?.teamA.displayName).toBe('KRX');
  });

  it('Naver acronym이 소문자/공백 섞여 있어도 정규화 후 LCK 표준 적용', () => {
    const m = toMatch(
      makeRaw({
        homeTeam: { name: 'whatever', nameEngAcronym: '  t1  ' },
      }),
    );
    expect(m?.teamA.code).toBe('T1');
    expect(m?.teamA.displayName).toBe('T1');
  });

  it('International 팀(LCK 외)은 Naver 값 그대로 (열린 집합)', () => {
    const m = toMatch(
      makeRaw({
        topLeagueId: 'msi',
        homeTeam: { name: 'G2 Esports', nameEngAcronym: 'G2' },
      }),
    );
    expect(m?.teamA.code).toBe('G2');
    expect(m?.teamA.displayName).toBe('G2 Esports');
  });
});

describe('Match 도메인 술어 + inline filter', () => {
  function makeMatch(opts: {
    id: string;
    teamA: { code: string; name: string };
    teamB: { code: string; name: string };
    startsAt: string;
    status: 'scheduled' | 'completed' | 'canceled';
  }): Match {
    return Match.create({
      id: `naver:${opts.id}`,
      league: 'LCK',
      stage: '1주 차',
      teamA: { code: opts.teamA.code, displayName: opts.teamA.name },
      teamB: { code: opts.teamB.code, displayName: opts.teamB.name },
      startsAt: opts.startsAt,
      bestOf: 3,
      status: opts.status,
    });
  }

  const matches = [
    makeMatch({
      id: 'm1',
      teamA: { code: 'T1', name: 'T1' },
      teamB: { code: 'GEN', name: '젠지' },
      startsAt: '2026-05-15T10:00:00.000Z',
      status: 'scheduled',
    }),
    makeMatch({
      id: 'm2',
      teamA: { code: 'HLE', name: '한화생명' },
      teamB: { code: 'KRX', name: 'KRX' },
      startsAt: '2026-05-16T10:00:00.000Z',
      status: 'scheduled',
    }),
    makeMatch({
      id: 'm3',
      teamA: { code: 'GEN', name: '젠지' },
      teamB: { code: 'T1', name: 'T1' },
      startsAt: '2026-05-10T10:00:00.000Z',
      status: 'canceled',
    }),
    makeMatch({
      id: 'm4',
      teamA: { code: 'T1', name: 'T1' },
      teamB: { code: 'KT', name: 'KT' },
      startsAt: '2026-05-12T10:00:00.000Z',
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

describe('Match — ICS 출력 표현 (도메인 응집)', () => {
  function makeMatch(
    overrides: {
      bestOf?: 1 | 3 | 5;
      stage?: string;
      league?: 'LCK' | 'WORLDS';
      startsAt?: string;
      status?: 'scheduled' | 'completed' | 'canceled';
    } = {},
  ): Match {
    return Match.create({
      id: 'naver:x',
      league: overrides.league ?? 'LCK',
      stage: overrides.stage ?? '1주 차',
      teamA: { code: 'T1', displayName: 'T1' },
      teamB: { code: 'GEN', displayName: '젠지' },
      startsAt: overrides.startsAt ?? '2026-05-15T10:00:00.000Z',
      bestOf: overrides.bestOf ?? 3,
      status: overrides.status ?? 'scheduled',
    });
  }

  describe('endDate: startDate + Bo별 길이 (Bo* 의 * × 30분)', () => {
    it('Bo1 → +30분', () => {
      expect(makeMatch({ bestOf: 1 }).endDate.toISOString()).toBe('2026-05-15T10:30:00.000Z');
    });
    it('Bo3 → +90분', () => {
      expect(makeMatch({ bestOf: 3 }).endDate.toISOString()).toBe('2026-05-15T11:30:00.000Z');
    });
    it('Bo5 → +150분', () => {
      expect(makeMatch({ bestOf: 5 }).endDate.toISOString()).toBe('2026-05-15T12:30:00.000Z');
    });
  });

  describe('summary: "matchup — tournamentLabel (BoN)"', () => {
    it('정규시즌 Bo3', () => {
      expect(makeMatch().summary).toBe('T1 vs 젠지 — LCK 1주 차 (Bo3)');
    });
    it('결승 Bo5', () => {
      expect(makeMatch({ stage: '결승', bestOf: 5 }).summary).toBe('T1 vs 젠지 — LCK 결승 (Bo5)');
    });
    it('stage 없을 때 display명만', () => {
      expect(makeMatch({ league: 'WORLDS', stage: '', bestOf: 5 }).summary).toBe(
        'T1 vs 젠지 — 월드 챔피언십 (Bo5)',
      );
    });
  });

  describe('description: 상태별 본문 (예정/완료/취소)', () => {
    it('예정 매치 (메타 없음): 매치업·대회·BoN한국어만, 빈 줄 trailing 없음', () => {
      const desc = makeMatch({ status: 'scheduled' }).description;
      expect(desc).toBe(['T1 vs 젠지', 'LCK 1주 차', '3판 2선승제'].join('\n'));
    });

    it('예정 매치 + 치지직 채널: 라이브 링크 표시', () => {
      const desc = makeMatchWithMeta({
        status: 'scheduled',
        chzzkChannelId: 'ch123',
      }).description;
      expect(desc).toContain('📺 치지직 라이브: https://chzzk.naver.com/live/ch123');
      expect(desc).not.toContain('lolesports');
    });

    it('완료 매치 + 점수 + replayVideoId: 결과 + 다시보기 (라이브 X)', () => {
      const desc = makeMatchWithMeta({
        status: 'completed',
        score: { home: 2, away: 0, winner: 'HOME' },
        replayVideoId: 999,
      }).description;
      expect(desc).toContain('경기 결과: 2 vs 0 (T1 승)');
      expect(desc).toContain(
        '🎬 다시보기: https://game.naver.com/esports/League_of_Legends/videos/999',
      );
      expect(desc).not.toContain('치지직 라이브');
      expect(desc).not.toContain('lolesports');
    });

    it('완료 매치 + 점수 AWAY 승: winnerName이 teamB', () => {
      const desc = makeMatchWithMeta({
        status: 'completed',
        score: { home: 1, away: 2, winner: 'AWAY' },
      }).description;
      expect(desc).toContain('경기 결과: 1 vs 2 (젠지 승)');
    });

    it('취소 매치: 위치만 (중계·결과·다시보기 모두 X)', () => {
      const desc = makeMatchWithMeta({ status: 'canceled', stadium: '치지직 롤파크' }).description;
      expect(desc).toContain('📍 치지직 롤파크');
      expect(desc).not.toContain('📺');
      expect(desc).not.toContain('🎬');
      expect(desc).not.toContain('경기 결과');
    });

    it('LOCATION 데이터 있으면 📍 행 추가', () => {
      const desc = makeMatchWithMeta({ stadium: '치지직 롤파크' }).description;
      expect(desc).toContain('📍 치지직 롤파크');
    });

    it('LOCATION 데이터 없으면 📍 행 누락', () => {
      const desc = makeMatchWithMeta({ stadium: undefined }).description;
      expect(desc).not.toContain('📍');
    });

    it('월드 결승 Bo5: 한국어 본문', () => {
      const desc = makeMatch({ league: 'WORLDS', stage: '결승', bestOf: 5 }).description;
      expect(desc).toContain('월드 챔피언십 결승');
      expect(desc).toContain('5판 3선승제');
    });

    // EWC raw title이 이미 "Road to EWC 1R" 형태로 도메인명을 포함 → "EWC Road to EWC ..." 중복 회피.
    it('EWC: stage가 leagueName 포함하면 prefix 생략 (중복 회피)', () => {
      const ewc = Match.create({
        id: 'naver:e1',
        league: 'EWC',
        stage: 'Road to EWC 1R',
        teamA: { code: 'T1', displayName: 'T1' },
        teamB: { code: 'GEN', displayName: '젠지' },
        startsAt: '2026-05-15T10:00:00.000Z',
        bestOf: 3,
        status: 'scheduled',
      });
      expect(ewc.summary).toBe('T1 vs 젠지 — Road to EWC 1R (Bo3)');
      expect(ewc.description.split('\n')[1]).toBe('Road to EWC 1R');
    });
  });

  describe('외부 노출 게터', () => {
    it('location은 stadium 그대로', () => {
      expect(makeMatchWithMeta({ stadium: '치지직 롤파크' }).location).toBe('치지직 롤파크');
      expect(makeMatchWithMeta({ stadium: undefined }).location).toBeUndefined();
    });

    it('url: 완료 매치 → VOD, 예정 매치 → 라이브, 둘 다 없으면 null', () => {
      expect(makeMatchWithMeta({ status: 'completed', replayVideoId: 12345 }).url).toBe(
        'https://game.naver.com/esports/League_of_Legends/videos/12345',
      );
      expect(makeMatchWithMeta({ status: 'scheduled', chzzkChannelId: 'abc' }).url).toBe(
        'https://chzzk.naver.com/live/abc',
      );
      expect(makeMatchWithMeta({ status: 'scheduled' }).url).toBeNull();
      expect(makeMatchWithMeta({ status: 'completed' }).url).toBeNull();
    });
  });

  // Phase 4 새 필드 받는 헬퍼
  function makeMatchWithMeta(
    overrides: {
      status?: 'scheduled' | 'completed' | 'canceled';
      score?: { home: number; away: number; winner: 'HOME' | 'AWAY' };
      stadium?: string;
      chzzkChannelId?: string;
      replayVideoId?: number;
    } = {},
  ): Match {
    return Match.create({
      id: 'naver:x',
      league: 'LCK',
      stage: '1주 차',
      teamA: { code: 'T1', displayName: 'T1' },
      teamB: { code: 'GEN', displayName: '젠지' },
      startsAt: '2026-05-15T10:00:00.000Z',
      bestOf: 3,
      status: overrides.status ?? 'scheduled',
      score: overrides.score,
      stadium: overrides.stadium,
      chzzkChannelId: overrides.chzzkChannelId,
      replayVideoId: overrides.replayVideoId,
    });
  }
});
