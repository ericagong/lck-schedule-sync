import { describe, expect, it } from 'vitest';
import { Match } from '../../src/match.js';
import type { NaverMatch } from '../../src/naver.js';
import { generateIcs, IcsEvent } from '../../src/ics.js';

const FIXED_NOW = new Date('2026-05-12T03:00:00Z');

const STATUS_TO_NAVER = {
  scheduled: 'BEFORE',
  completed: 'RESULT',
  canceled: 'CANCEL',
} as const;

function makeMatch(
  overrides: {
    id?: string;
    stage?: string;
    leagueDisplayName?: string;
    teamA?: { code: string; name: string };
    teamB?: { code: string; name: string };
    startsAt?: string;
    bestOf?: 1 | 3 | 5;
    status?: keyof typeof STATUS_TO_NAVER;
  } = {},
): Match {
  const raw: NaverMatch = {
    gameId: overrides.id ?? '115548128962840643',
    topLeagueId: 'lck',
    leagueId: 'lck_2026',
    title: overrides.stage ?? '2주 차',
    startDate: new Date(overrides.startsAt ?? '2026-04-08T10:00:00Z').getTime(),
    maxMatchCount: overrides.bestOf ?? 3,
    matchStatus: STATUS_TO_NAVER[overrides.status ?? 'completed'],
    homeTeam: overrides.teamA
      ? { name: overrides.teamA.name, nameEngAcronym: overrides.teamA.code }
      : { name: 'T1', nameEngAcronym: 'T1' },
    awayTeam: overrides.teamB
      ? { name: overrides.teamB.name, nameEngAcronym: overrides.teamB.code }
      : { name: '젠지', nameEngAcronym: 'GEN' },
  };
  return new Match(raw, overrides.leagueDisplayName ?? 'LCK');
}

const sampleMatch = makeMatch();

describe('generateIcs', () => {
  it('VCALENDAR로 감싼다', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1 일정', now: FIXED_NOW });
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  it('VTIMEZONE Asia/Seoul 블록을 포함한다', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('TZID:Asia/Seoul');
    expect(ics).toContain('TZOFFSETTO:+0900');
    expect(ics).toContain('END:VTIMEZONE');
  });

  it('UID는 match.id 기반 (naver: 접두 + @lck-schedule-sync)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('UID:naver:115548128962840643@lck-schedule-sync');
  });

  it('DTSTART를 KST로 변환한다 (UTC 10:00 → KST 19:00)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('DTSTART;TZID=Asia/Seoul:20260408T190000');
  });

  it('DTEND는 Bo3 기준 +3h (KST 19:00 → 22:00)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('DTEND;TZID=Asia/Seoul:20260408T220000');
  });

  it('Bo5는 +4.5h', () => {
    const bo5 = makeMatch({ bestOf: 5, startsAt: '2026-04-08T10:00:00Z' });
    const ics = generateIcs([bo5], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('DTEND;TZID=Asia/Seoul:20260408T233000');
  });

  it('SUMMARY에 한국어 팀명을 포함한다', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 2주 차 (Bo3)');
  });

  it('SUMMARY에 플레이오프 stage를 표시한다', () => {
    const playoff = makeMatch({ stage: '플레이오프', bestOf: 5 });
    const ics = generateIcs([playoff], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 플레이오프 (Bo5)');
  });

  it('SUMMARY에 결승 stage를 표시한다', () => {
    const final = makeMatch({ stage: '결승', bestOf: 5 });
    const ics = generateIcs([final], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 결승 (Bo5)');
  });

  it('SUMMARY에 플레이-인 stage를 표시한다', () => {
    const playin = makeMatch({ stage: '플레이-인', bestOf: 3 });
    const ics = generateIcs([playin], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 플레이-인 (Bo3)');
  });

  it('canceled 매치는 STATUS:CANCELLED', () => {
    const canceled = makeMatch({ status: 'canceled' });
    const ics = generateIcs([canceled], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('scheduled/completed 매치는 STATUS:CONFIRMED', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('VALARM은 포함하지 않는다 (캘린더 앱에 위임)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).not.toContain('BEGIN:VALARM');
  });

  it('DTSTAMP는 옵션의 now 기준 (테스트 가능)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('DTSTAMP:20260512T030000Z');
  });

  it('CRLF 줄바꿈 사용 (RFC 5545)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('\r\n');
  });

  it('빈 배열이어도 유효한 ICS를 만든다', () => {
    const ics = generateIcs([], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('같은 입력이면 같은 출력 (순수성)', () => {
    const a = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    const b = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(a).toBe(b);
  });

  describe('VEVENT 정렬 (deterministic 출력)', () => {
    const m1 = makeMatch({ id: 'm1', startsAt: '2026-05-15T10:00:00Z' });
    const m2 = makeMatch({ id: 'm2', startsAt: '2026-05-10T10:00:00Z' });
    const m3 = makeMatch({ id: 'm3', startsAt: '2026-05-12T10:00:00Z' });

    it('입력 순서와 무관하게 시작 시각 오름차순으로 VEVENT를 배치한다', () => {
      const ics = generateIcs([m1, m2, m3], { calendarName: 'T1', now: FIXED_NOW });
      const uidOrder = [...ics.matchAll(/UID:naver:(m\d+)@/g)].map((mt) => mt[1]);
      expect(uidOrder).toEqual(['m2', 'm3', 'm1']);
    });

    it('입력 배열을 변경하지 않는다 (순수성)', () => {
      const input = [m1, m2, m3];
      const originalIds = input.map((m) => m.id);
      generateIcs(input, { calendarName: 'T1', now: FIXED_NOW });
      expect(input.map((m) => m.id)).toEqual(originalIds);
    });

    it('입력 순서가 달라도 같은 ICS를 만든다 (순서 독립성)', () => {
      const a = generateIcs([m1, m2, m3], { calendarName: 'T1', now: FIXED_NOW });
      const b = generateIcs([m3, m1, m2], { calendarName: 'T1', now: FIXED_NOW });
      expect(a).toBe(b);
    });
  });

  // 한국어 1글자 = UTF-8 3바이트. 75바이트 경계에서 문자 중간 깨지면 ICS 손상.
  describe('RFC 5545 line folding', () => {
    const longKoreanMatch = makeMatch({
      leagueDisplayName: '리그 오브 레전드 챔피언스 코리아',
      stage: '플레이오프 라운드 1 매치 1',
      bestOf: 5,
    });

    it('75바이트 초과 SUMMARY는 CRLF + 1칸 들여쓰기로 폴딩', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1', now: FIXED_NOW });
      expect(ics).toMatch(/SUMMARY:[^\r\n]+\r\n [^\r\n]/);
    });

    it('폴딩 후에도 모든 라인이 75바이트 이하', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1', now: FIXED_NOW });
      const encoder = new TextEncoder();
      for (const line of ics.split('\r\n')) {
        expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      }
    });

    it('폴딩 시 한국어 멀티바이트 문자가 깨지지 않음', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1', now: FIXED_NOW });
      expect(ics).not.toContain('�');
      const unfolded = ics.replace(/\r\n /g, '');
      expect(unfolded).toContain(
        'SUMMARY:T1 vs 젠지 — 리그 오브 레전드 챔피언스 코리아 플레이오프 라운드 1 매치 1 (Bo5)',
      );
    });

    it('75바이트 이하 라인은 폴딩하지 않는다', () => {
      const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
      expect(ics).toMatch(/SUMMARY:T1 vs 젠지 — LCK 2주 차 \(Bo3\)\r\nDESCRIPTION:/);
    });
  });
});

describe('IcsEvent (변환 가시성 응집)', () => {
  it('constructor 한 곳에서 Match → ICS 필드 모두 채워진다', () => {
    const event = new IcsEvent(sampleMatch, FIXED_NOW);
    expect(event.uid).toBe('naver:115548128962840643@lck-schedule-sync');
    expect(event.dtstamp).toBe('20260512T030000Z');
    expect(event.dtstart).toBe('20260408T190000');
    expect(event.dtend).toBe('20260408T220000');
    expect(event.summary).toBe('T1 vs 젠지 — LCK 2주 차 (Bo3)');
    expect(event.status).toBe('CONFIRMED');
  });

  it('static from으로도 동일 결과', () => {
    const a = new IcsEvent(sampleMatch, FIXED_NOW);
    const b = IcsEvent.from(sampleMatch, FIXED_NOW);
    expect(a.toLines()).toEqual(b.toLines());
  });

  it('canceled 매치는 status CANCELLED', () => {
    const canceled = makeMatch({ status: 'canceled' });
    const event = new IcsEvent(canceled, FIXED_NOW);
    expect(event.status).toBe('CANCELLED');
  });

  it('toLines는 BEGIN:VEVENT … END:VEVENT 블록을 반환한다', () => {
    const lines = new IcsEvent(sampleMatch, FIXED_NOW).toLines();
    expect(lines[0]).toBe('BEGIN:VEVENT');
    expect(lines[lines.length - 1]).toBe('END:VEVENT');
  });
});
