import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  enumerateMonths,
  NAVER_LEAGUE_DISPLAY_NAMES,
  NAVER_LEAGUE_IDS,
  parseNaverResponse,
  type NaverScheduleResponse,
} from '../../src/naver.js';

function loadFixture(name: string): NaverScheduleResponse {
  const path = resolve(__dirname, `../../fixtures/${name}`);
  return JSON.parse(readFileSync(path, 'utf-8')) as NaverScheduleResponse;
}

describe('parseNaverResponse — LCK sample', () => {
  const fixture = loadFixture('naver-lck-sample.json');
  const { matches } = parseNaverResponse(fixture, 'LCK');

  it('샘플 4개 매치 모두 Match로 변환', () => {
    expect(matches).toHaveLength(4);
  });

  it('UID는 "naver:" 접두 (lolesports와 namespace 분리)', () => {
    expect(matches[0]?.id).toBe('naver:2026050117ii8PCnB4429lol');
  });

  it('startDate epoch ms → ISO 8601 UTC 변환 (1777622400000 = 2026-05-01T08:00 UTC = 17:00 KST)', () => {
    expect(matches[0]?.startsAt).toBe('2026-05-01T08:00:00.000Z');
  });

  it('title을 tournament.stage로 그대로 흘림', () => {
    expect(matches[0]?.tournament.stage).toBe('정규시즌 1R');
  });

  it('displayName은 호출부 주입 그대로 (네이버 응답에 inline 없음)', () => {
    expect(matches[0]?.tournament.displayName).toBe('LCK');
  });

  it('homeTeam.nameEngAcronym → teamA.code, homeTeam.name(한국어) → teamA.displayName', () => {
    expect(matches[0]?.teamA.code).toBe('DNS');
    expect(matches[0]?.teamA.displayName).toBe('DN 수퍼스');
  });

  it('awayTeam 동일 매핑 (한국어 그대로, team-names.ts 우회)', () => {
    expect(matches[0]?.teamB.code).toBe('BRO');
    expect(matches[0]?.teamB.displayName).toBe('한진 브리온');
  });

  it('maxMatchCount 3 → bestOf 3', () => {
    expect(matches[0]?.bestOf).toBe(3);
  });

  it('matchStatus "RESULT" → status "completed"', () => {
    expect(matches[0]?.status).toBe('completed');
  });
});

describe('parseNaverResponse — status enum 매핑', () => {
  const baseMatch = {
    gameId: 'g1',
    topLeagueId: 'lck',
    leagueId: 'lck_2026',
    title: '정규시즌 1R',
    startDate: 1777622400000,
    maxMatchCount: 3,
    homeTeam: { name: 'T1', nameEngAcronym: 'T1' },
    awayTeam: { name: '젠지', nameEngAcronym: 'GEN' },
  };

  function makeResponse(matchStatus: string) {
    return {
      code: 200,
      message: null,
      content: {
        matches: [{ ...baseMatch, matchStatus }],
        teams: [],
        userMatchPushGameIds: [],
      },
    } as unknown as NaverScheduleResponse;
  }

  it('BEFORE → scheduled', () => {
    const { matches } = parseNaverResponse(makeResponse('BEFORE'), 'LCK');
    expect(matches[0]?.status).toBe('scheduled');
  });

  it('RESULT → completed', () => {
    const { matches } = parseNaverResponse(makeResponse('RESULT'), 'LCK');
    expect(matches[0]?.status).toBe('completed');
  });

  it('CANCEL → canceled', () => {
    const { matches } = parseNaverResponse(makeResponse('CANCEL'), 'LCK');
    expect(matches[0]?.status).toBe('canceled');
  });

  it('알려지지 않은 상태 (예: DELAYED) → scheduled (lolesports와 일관, silent drop X)', () => {
    const { matches } = parseNaverResponse(makeResponse('DELAYED'), 'LCK');
    expect(matches[0]?.status).toBe('scheduled');
  });
});

describe('parseNaverResponse — silent drop (Bo2/Bo7 회귀)', () => {
  function makeResponseBo(count: number) {
    return {
      code: 200,
      message: null,
      content: {
        matches: [
          {
            gameId: 'g1',
            topLeagueId: 'lck',
            leagueId: 'lck_2026',
            title: '결승',
            startDate: 1777622400000,
            maxMatchCount: count,
            matchStatus: 'BEFORE',
            homeTeam: { name: 'T1', nameEngAcronym: 'T1' },
            awayTeam: { name: '젠지', nameEngAcronym: 'GEN' },
          },
        ],
        teams: [],
        userMatchPushGameIds: [],
      },
    } as unknown as NaverScheduleResponse;
  }

  it('Bo1 (maxMatchCount=1) → 통과', () => {
    expect(parseNaverResponse(makeResponseBo(1), 'LCK').matches).toHaveLength(1);
  });
  it('Bo3 → 통과', () => {
    expect(parseNaverResponse(makeResponseBo(3), 'LCK').matches).toHaveLength(1);
  });
  it('Bo5 → 통과', () => {
    expect(parseNaverResponse(makeResponseBo(5), 'LCK').matches).toHaveLength(1);
  });
  it('Bo2 → silent drop (도메인은 1/3/5만 표현)', () => {
    expect(parseNaverResponse(makeResponseBo(2), 'LCK').matches).toHaveLength(0);
  });
  it('Bo7 → silent drop', () => {
    expect(parseNaverResponse(makeResponseBo(7), 'LCK').matches).toHaveLength(0);
  });
});

describe('parseNaverResponse — TBD/팀 누락 안전 처리', () => {
  function makeResponseTeams(home: unknown, away: unknown) {
    return {
      code: 200,
      message: null,
      content: {
        matches: [
          {
            gameId: 'g1',
            topLeagueId: 'lck',
            leagueId: 'lck_2026',
            title: '결승',
            startDate: 1777622400000,
            maxMatchCount: 5,
            matchStatus: 'BEFORE',
            homeTeam: home,
            awayTeam: away,
          },
        ],
        teams: [],
        userMatchPushGameIds: [],
      },
    } as unknown as NaverScheduleResponse;
  }

  it('homeTeam null → skip', () => {
    const r = makeResponseTeams(null, { name: '젠지', nameEngAcronym: 'GEN' });
    expect(parseNaverResponse(r, 'LCK').matches).toHaveLength(0);
  });
  it('awayTeam null → skip', () => {
    const r = makeResponseTeams({ name: 'T1', nameEngAcronym: 'T1' }, null);
    expect(parseNaverResponse(r, 'LCK').matches).toHaveLength(0);
  });
  it('nameEngAcronym 비어있으면 skip', () => {
    const r = makeResponseTeams(
      { name: 'T1', nameEngAcronym: '' },
      { name: '젠지', nameEngAcronym: 'GEN' },
    );
    expect(parseNaverResponse(r, 'LCK').matches).toHaveLength(0);
  });
  it('name(한국어) 비어있으면 skip', () => {
    const r = makeResponseTeams(
      { name: '', nameEngAcronym: 'T1' },
      { name: '젠지', nameEngAcronym: 'GEN' },
    );
    expect(parseNaverResponse(r, 'LCK').matches).toHaveLength(0);
  });
});

describe('parseNaverResponse — 빈 응답 안전 처리', () => {
  it('content가 null이면 빈 배열', () => {
    const r = { code: 200, message: null, content: null } as unknown as NaverScheduleResponse;
    expect(parseNaverResponse(r, 'LCK').matches).toEqual([]);
  });

  it('invalid topLeagueId 응답 (matches=[], teams=[]) → 빈 배열', () => {
    const fixture = loadFixture('naver-empty-sample.json');
    expect(parseNaverResponse(fixture, 'Unknown').matches).toEqual([]);
  });
});

describe('parseNaverResponse — 6 대회 fixture smoke test (DTO 안정성)', () => {
  const cases: ReadonlyArray<readonly [string, string, number]> = [
    ['naver-lck-sample.json', 'LCK', 4],
    ['naver-msi-sample.json', 'MSI', 3],
    ['naver-worlds-sample.json', '월드 챔피언십', 3],
    ['naver-first-stand-sample.json', 'First Stand', 3],
    ['naver-ewc-sample.json', 'EWC', 3],
    ['naver-kespa-sample.json', 'KeSPA Cup', 3],
  ];

  it.each(cases)(
    '%s → %s display, %i 매치 (시즌·대회 무관 동일 parser)',
    (file, display, expected) => {
      const { matches } = parseNaverResponse(loadFixture(file), display);
      expect(matches).toHaveLength(expected);
      // displayName 주입 검증
      expect(matches.every((m) => m.tournament.displayName === display)).toBe(true);
      // 모든 매치에 UID naver: 접두
      expect(matches.every((m) => m.id.startsWith('naver:'))).toBe(true);
    },
  );
});

describe('NAVER_LEAGUE_IDS / NAVER_LEAGUE_DISPLAY_NAMES — 6 대회 일관성', () => {
  it('NAVER_LEAGUE_IDS 6 대회 정확', () => {
    expect(Object.keys(NAVER_LEAGUE_IDS).sort()).toEqual(
      ['EWC', 'FIRST_STAND', 'KESPA', 'LCK', 'MSI', 'WORLDS'].sort(),
    );
  });

  it('NAVER_LEAGUE_IDS의 모든 ID가 NAVER_LEAGUE_DISPLAY_NAMES에 존재', () => {
    for (const id of Object.values(NAVER_LEAGUE_IDS)) {
      expect(NAVER_LEAGUE_DISPLAY_NAMES[id]).toBeDefined();
    }
  });
});

describe('enumerateMonths — UTC 기준 결정성 (누적식 정책)', () => {
  it('현재월만 (before=0, after=1)', () => {
    expect(enumerateMonths(new Date(Date.UTC(2026, 4, 13)), 0, 1)).toEqual(['2026-05']);
  });

  it('과거 3 + 현재 + 미래 1 = 5개월 (Phase 3 기본, 5차 결정 — 캘린더 본질 다가오는 일정)', () => {
    const out = enumerateMonths(new Date(Date.UTC(2026, 4, 13)), 3, 2);
    expect(out).toHaveLength(5);
    expect(out[0]).toBe('2026-02'); // 3개월 전 (직전 split 끝물)
    expect(out[2]).toBe('2026-04'); // 1개월 전
    expect(out[3]).toBe('2026-05'); // 현재
    expect(out[4]).toBe('2026-06'); // +1 (네이버 lead time 매칭)
  });

  it('과거 방향 해 넘어감 (2026-02에서 4개월 뒤로)', () => {
    expect(enumerateMonths(new Date(Date.UTC(2026, 1, 13)), 4, 2)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('미래 방향 해 넘어감 (2026-12에서 6개월 앞)', () => {
    expect(enumerateMonths(new Date(Date.UTC(2026, 11, 1)), 0, 6)).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
    ]);
  });

  it('0+0 → 빈 배열', () => {
    expect(enumerateMonths(new Date(Date.UTC(2026, 4, 13)), 0, 0)).toEqual([]);
  });

  it('과거만 (before=3, after=0)', () => {
    expect(enumerateMonths(new Date(Date.UTC(2026, 4, 13)), 3, 0)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });
});
