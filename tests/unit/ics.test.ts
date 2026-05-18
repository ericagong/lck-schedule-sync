import { describe, expect, it } from 'vitest';
import { Match } from '../../src/match.js';
import type { League } from '../../src/league.js';
import { generateIcs, uidOf, type VeventMeta } from '../../src/ics.js';
import { computeContentHash } from '../../src/sync-meta.js';

const FIXED_NOW = new Date('2026-05-18T09:00:00.000Z');
const FIXED_LAST_MODIFIED = new Date('2026-05-15T00:00:00.000Z');

function makeMatch(
  overrides: {
    id?: string;
    stage?: string;
    league?: League;
    teamA?: { code: string; name: string };
    teamB?: { code: string; name: string };
    startsAt?: string;
    bestOf?: 1 | 3 | 5;
    status?: 'scheduled' | 'completed' | 'canceled';
  } = {},
): Match {
  return Match.create({
    id: `naver:${overrides.id ?? '115548128962840643'}`,
    league: overrides.league ?? 'LCK',
    stage: overrides.stage ?? '2주 차',
    teamA: overrides.teamA
      ? { code: overrides.teamA.code, displayName: overrides.teamA.name }
      : { code: 'T1', displayName: 'T1' },
    teamB: overrides.teamB
      ? { code: overrides.teamB.code, displayName: overrides.teamB.name }
      : { code: 'GEN', displayName: '젠지' },
    startsAt: overrides.startsAt ?? '2026-04-08T10:00:00.000Z',
    bestOf: overrides.bestOf ?? 3,
    status: overrides.status ?? 'completed',
  });
}

/**
 * 테스트용 default sync meta — 모든 매치에 sequence=0, lastModified=FIXED_LAST_MODIFIED,
 * contentHash는 실제 매치 콘텐츠로 계산해 generateIcs 내부 일관성 깨지지 않게.
 */
function buildMeta(matches: readonly Match[]): Map<string, VeventMeta> {
  const map = new Map<string, VeventMeta>();
  for (const m of matches) {
    map.set(uidOf(m), {
      sequence: 0,
      lastModified: FIXED_LAST_MODIFIED,
      contentHash: computeContentHash(m),
    });
  }
  return map;
}

function ics(matches: readonly Match[], calendarName = 'T1', now: Date = FIXED_NOW): string {
  return generateIcs(matches, {
    calendarName,
    now,
    veventMetaByUid: buildMeta(matches),
  });
}

const sampleMatch = makeMatch();

describe('generateIcs', () => {
  it('VCALENDAR로 감싼다', () => {
    const result = ics([sampleMatch], 'T1 일정');
    expect(result).toMatch(/^BEGIN:VCALENDAR/);
    expect(result).toMatch(/END:VCALENDAR\r\n$/);
  });

  it('VTIMEZONE 블록을 포함하지 않는다 (UTC 시각 사용 → 캘린더 앱이 자동 변환)', () => {
    const result = ics([sampleMatch]);
    expect(result).not.toContain('BEGIN:VTIMEZONE');
    expect(result).not.toContain('TZID:');
    expect(result).not.toContain('X-WR-TIMEZONE:');
  });

  it('UID는 match.id 기반 (naver: 접두 + @lck-teams-schedule)', () => {
    expect(ics([sampleMatch])).toContain('UID:naver:115548128962840643@lck-teams-schedule');
  });

  it('DTSTART는 UTC compact 형식 (입력 UTC 10:00 → 20260408T100000Z)', () => {
    expect(ics([sampleMatch])).toContain('DTSTART:20260408T100000Z');
  });

  it('DTEND는 Bo3 기준 +90분 (UTC 10:00 → 11:30)', () => {
    expect(ics([sampleMatch])).toContain('DTEND:20260408T113000Z');
  });

  it('Bo5는 +150분 (UTC 10:00 → 12:30)', () => {
    const bo5 = makeMatch({ bestOf: 5, startsAt: '2026-04-08T10:00:00Z' });
    expect(ics([bo5])).toContain('DTEND:20260408T123000Z');
  });

  it('SUMMARY는 [SHORT_CODE] matchup 형식 (stage·BoN은 DESC)', () => {
    expect(ics([sampleMatch])).toContain('SUMMARY:[LCK] T1 vs 젠지');
  });

  it('LCK·MSI·EWC: SHORT_CODE = LEAGUE_DISPLAY_NAME 동일', () => {
    expect(ics([makeMatch({ league: 'LCK' })])).toContain('SUMMARY:[LCK] T1 vs 젠지');
    expect(ics([makeMatch({ league: 'MSI' })])).toContain('SUMMARY:[MSI] T1 vs 젠지');
    expect(ics([makeMatch({ league: 'EWC' })])).toContain('SUMMARY:[EWC] T1 vs 젠지');
  });

  it('WORLDS·FIRST_STAND·KESPA_CUP: 긴 한국어 표기 대신 짧은 영문 코드 ([WORLDS]·[FST]·[KESPA])', () => {
    expect(ics([makeMatch({ league: 'WORLDS' })])).toContain('SUMMARY:[WORLDS] T1 vs 젠지');
    expect(ics([makeMatch({ league: 'FIRST_STAND' })])).toContain('SUMMARY:[FST] T1 vs 젠지');
    expect(ics([makeMatch({ league: 'KESPA_CUP' })])).toContain('SUMMARY:[KESPA] T1 vs 젠지');
  });

  it('stage·BoN은 SUMMARY가 아닌 DESCRIPTION에 표시', () => {
    const result = ics([makeMatch({ stage: '플레이오프 2R', bestOf: 5 })]);
    expect(result).toContain('SUMMARY:[LCK] T1 vs 젠지');
    expect(result).not.toMatch(/SUMMARY:[^\r\n]*플레이오프/);
    expect(result).not.toMatch(/SUMMARY:[^\r\n]*Bo5/);
    const unfolded = result.replace(/\r\n /g, '');
    expect(unfolded).toContain('🎯 플레이오프 2R');
    expect(unfolded).toContain('🎮 Bo5 (5판 3선승제)');
  });

  it('canceled 매치는 STATUS:CANCELLED', () => {
    expect(ics([makeMatch({ status: 'canceled' })])).toContain('STATUS:CANCELLED');
  });

  it('scheduled/completed 매치는 STATUS:CONFIRMED', () => {
    expect(ics([sampleMatch])).toContain('STATUS:CONFIRMED');
  });

  it('VALARM은 포함하지 않는다 (캘린더 앱에 위임)', () => {
    expect(ics([sampleMatch])).not.toContain('BEGIN:VALARM');
  });

  it('CRLF 줄바꿈 사용 (RFC 5545)', () => {
    expect(ics([sampleMatch])).toContain('\r\n');
  });

  it('빈 배열이어도 유효한 ICS를 만든다', () => {
    const result = ics([]);
    expect(result).toMatch(/^BEGIN:VCALENDAR/);
    expect(result).toMatch(/END:VCALENDAR\r\n$/);
    expect(result).not.toContain('BEGIN:VEVENT');
  });

  it('같은 입력 + 같은 now + 같은 메타면 같은 출력 (순수성)', () => {
    expect(ics([sampleMatch])).toBe(ics([sampleMatch]));
  });

  describe('VCALENDAR 헤더 (RFC 5545 + 5546 + 7986)', () => {
    it('VERSION:2.0 / PRODID / CALSCALE / METHOD:PUBLISH 포함', () => {
      const result = ics([sampleMatch]);
      expect(result).toContain('VERSION:2.0');
      expect(result).toContain('PRODID:-//lck-teams-schedule//KO');
      expect(result).toContain('CALSCALE:GREGORIAN');
      expect(result).toContain('METHOD:PUBLISH');
    });

    it('NAME (RFC 7986) + X-WR-CALNAME 동시 발행 — 신·구 클라이언트 호환', () => {
      const result = ics([sampleMatch], 'T1 경기 일정');
      expect(result).toContain('NAME:T1 경기 일정');
      expect(result).toContain('X-WR-CALNAME:T1 경기 일정');
    });

    it('REFRESH-INTERVAL = PT12H (cron 12h 주기와 정합)', () => {
      expect(ics([sampleMatch])).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
    });

    it('X-PUBLISHED-TTL = PT12H (MS Outlook 호환, REFRESH-INTERVAL과 동일 값)', () => {
      expect(ics([sampleMatch])).toContain('X-PUBLISHED-TTL:PT12H');
    });
  });

  describe('동기화 메타 — RFC 정합 (DTSTAMP=now, SEQUENCE, LAST-MODIFIED, CREATED, X-CONTENT-HASH)', () => {
    it('DTSTAMP는 now (직렬화 시각) — match.startDate가 아님', () => {
      const result = ics([sampleMatch], 'T1', new Date('2026-05-18T09:30:00Z'));
      expect(result).toContain('DTSTAMP:20260518T093000Z');
      expect(result).not.toContain('DTSTAMP:20260408T100000Z');
    });

    it('now가 다르면 DTSTAMP도 다름 (매 발행 변동)', () => {
      const a = ics([sampleMatch], 'T1', new Date('2026-05-18T09:00:00Z'));
      const b = ics([sampleMatch], 'T1', new Date('2026-05-18T21:00:00Z'));
      expect(a).not.toBe(b);
      expect(a).toContain('DTSTAMP:20260518T090000Z');
      expect(b).toContain('DTSTAMP:20260518T210000Z');
    });

    it('CREATED는 match.startDate (deterministic, 영구 동일)', () => {
      expect(ics([sampleMatch])).toContain('CREATED:20260408T100000Z');
    });

    it('LAST-MODIFIED는 sync meta 값 (FIXED_LAST_MODIFIED)', () => {
      expect(ics([sampleMatch])).toContain('LAST-MODIFIED:20260515T000000Z');
    });

    it('SEQUENCE는 sync meta 값 (default 0)', () => {
      expect(ics([sampleMatch])).toContain('SEQUENCE:0');
    });

    it('SEQUENCE 값이 주입되면 그대로 출력', () => {
      const meta = new Map<string, VeventMeta>([
        [uidOf(sampleMatch), { sequence: 42, lastModified: FIXED_LAST_MODIFIED, contentHash: 'h' }],
      ]);
      const result = generateIcs([sampleMatch], {
        calendarName: 'T1',
        now: FIXED_NOW,
        veventMetaByUid: meta,
      });
      expect(result).toContain('SEQUENCE:42');
    });

    it('X-CONTENT-HASH 임베드 — 다음 빌드 diff 복원용 (fold 후 unfold 가능)', () => {
      const result = ics([sampleMatch]);
      const hash = computeContentHash(sampleMatch);
      // SHA-256 hex(64자) + prefix(15자) = 79바이트로 fold됨 → unfold 후 검증
      const unfolded = result.replace(/\r\n /g, '');
      expect(unfolded).toContain(`X-CONTENT-HASH:${hash}`);
    });

    it('sync meta가 누락된 매치면 throw (호출자 책임 누락)', () => {
      expect(() =>
        generateIcs([sampleMatch], {
          calendarName: 'T1',
          now: FIXED_NOW,
          veventMetaByUid: new Map(),
        }),
      ).toThrow(/sync meta missing/);
    });
  });

  describe('VEVENT 정렬 (deterministic 출력)', () => {
    const m1 = makeMatch({ id: 'm1', startsAt: '2026-05-15T10:00:00Z' });
    const m2 = makeMatch({ id: 'm2', startsAt: '2026-05-10T10:00:00Z' });
    const m3 = makeMatch({ id: 'm3', startsAt: '2026-05-12T10:00:00Z' });

    it('입력 순서와 무관하게 시작 시각 오름차순으로 VEVENT를 배치한다', () => {
      const result = ics([m1, m2, m3]);
      const uidOrder = [...result.matchAll(/UID:naver:(m\d+)@/g)].map((mt) => mt[1]);
      expect(uidOrder).toEqual(['m2', 'm3', 'm1']);
    });

    it('입력 배열을 변경하지 않는다 (순수성)', () => {
      const input = [m1, m2, m3];
      const originalIds = input.map((m) => m.id);
      ics(input);
      expect(input.map((m) => m.id)).toEqual(originalIds);
    });

    it('입력 순서가 달라도 같은 ICS를 만든다 (순서 독립성)', () => {
      expect(ics([m1, m2, m3])).toBe(ics([m3, m1, m2]));
    });
  });

  // 한국어 1글자 = UTF-8 3바이트. 75바이트 경계에서 문자 중간 깨지면 ICS 손상.
  describe('RFC 5545 line folding', () => {
    // SUMMARY가 짧아진 새 형식([LCK] T1 vs 젠지)에선 SUMMARY 자체 폴딩이 드물어,
    // 길이 보장을 위해 long stage(DESCRIPTION 행)로 폴딩 시나리오 구성.
    const longStageMatch = makeMatch({
      league: 'WORLDS',
      stage: '플레이오프 라운드 1 매치 1 — 그룹 A vs 그룹 B 매치',
      bestOf: 5,
    });

    it('75바이트 초과 라인은 CRLF + 1칸 들여쓰기로 폴딩', () => {
      const result = ics([longStageMatch]);
      // DESCRIPTION 안에 긴 stage가 포함되어 폴딩 발생
      expect(result).toMatch(/\r\n [^\r\n]/);
    });

    it('폴딩 후에도 모든 라인이 75바이트 이하', () => {
      const result = ics([longStageMatch]);
      const encoder = new TextEncoder();
      for (const line of result.split('\r\n')) {
        expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      }
    });

    it('폴딩 시 한국어 멀티바이트 문자가 깨지지 않음', () => {
      const result = ics([longStageMatch]);
      expect(result).not.toContain('�');
      const unfolded = result.replace(/\r\n /g, '');
      expect(unfolded).toContain('🎯 플레이오프 라운드 1 매치 1 — 그룹 A vs 그룹 B 매치');
    });

    it('75바이트 이하 라인은 폴딩하지 않는다', () => {
      const result = ics([sampleMatch]);
      // 짧은 SUMMARY는 한 줄에 들어감 (sampleMatch는 stadium 없어 다음 라인이 DESCRIPTION)
      expect(result).toMatch(/SUMMARY:\[LCK\] T1 vs 젠지\r\nDESCRIPTION/);
    });

    // 일부 캘린더 앱은 fold된 URL을 unfold하지 않고 자동 링크화 정규식을 돌리기 때문에
    // URL 중간에서 fold되면 ".../1049188" 이 "10491" 까지만 링크되는 현상이 발생.
    // URL-aware fold는 URL이 한 청크에 통째로 들어가게 fold 경계를 URL 시작 직전으로 당김.
    it('URL은 fold 경계에 의해 잘리지 않고 한 라인 안에 통째로 등장', () => {
      const completed = Match.create({
        id: 'naver:115548128962840643',
        league: 'LCK',
        stage: '2주 차',
        teamA: { code: 'T1', displayName: 'T1' },
        teamB: { code: 'GEN', displayName: '젠지' },
        startsAt: '2026-04-08T10:00:00.000Z',
        bestOf: 3,
        status: 'completed',
        score: { home: 2, away: 0, winner: 'HOME' },
        replayVideoId: 1049188,
      });
      const result = ics([completed]);
      const url = 'https://game.naver.com/esports/League_of_Legends/videos/1049188';
      const lines = result.split('\r\n');
      expect(lines.some((line) => line.includes(url))).toBe(true);
    });
  });
});

describe('VEVENT 블록 구조', () => {
  it('BEGIN:VEVENT … END:VEVENT로 감싼다', () => {
    const result = ics([sampleMatch]);
    expect(result).toContain('BEGIN:VEVENT');
    expect(result).toContain('END:VEVENT');
  });

  it('필수 필드를 모두 포함한다 (UID, DTSTAMP, CREATED, LAST-MODIFIED, SEQUENCE, DTSTART, DTEND, SUMMARY, STATUS)', () => {
    const result = ics([sampleMatch]);
    expect(result).toContain('UID:naver:115548128962840643@lck-teams-schedule');
    expect(result).toContain('DTSTAMP:20260518T090000Z');
    expect(result).toContain('CREATED:20260408T100000Z');
    expect(result).toContain('LAST-MODIFIED:20260515T000000Z');
    expect(result).toContain('SEQUENCE:0');
    expect(result).toContain('DTSTART:20260408T100000Z');
    expect(result).toContain('DTEND:20260408T113000Z');
    expect(result).toContain('SUMMARY:[LCK] T1 vs 젠지');
    expect(result).toContain('STATUS:CONFIRMED');
  });

  it('URL property: 완료+replayVideoId → game.naver.com VOD', () => {
    const completed = Match.create({
      id: 'naver:1',
      league: 'LCK',
      stage: '1주 차',
      teamA: { code: 'T1', displayName: 'T1' },
      teamB: { code: 'GEN', displayName: '젠지' },
      startsAt: '2026-04-08T10:00:00.000Z',
      bestOf: 3,
      status: 'completed',
      replayVideoId: 999,
    });
    expect(ics([completed])).toContain(
      'URL:https://game.naver.com/esports/League_of_Legends/videos/999',
    );
  });

  it('URL property: 예정+chzzkChannelId → 치지직 라이브', () => {
    const live = Match.create({
      id: 'naver:2',
      league: 'LCK',
      stage: '1주 차',
      teamA: { code: 'T1', displayName: 'T1' },
      teamB: { code: 'GEN', displayName: '젠지' },
      startsAt: '2026-04-08T10:00:00.000Z',
      bestOf: 3,
      status: 'scheduled',
      chzzkChannelId: 'ch1',
    });
    expect(ics([live])).toContain('URL:https://chzzk.naver.com/live/ch1');
  });

  it('URL property: 메타 없으면 URL 필드 자체가 누락됨', () => {
    expect(ics([sampleMatch])).not.toContain('URL:');
  });
});
