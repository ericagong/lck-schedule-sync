import { describe, expect, it } from 'vitest';
import { Match } from '../../src/match.js';
import type { League } from '../../src/league.js';
import { generateIcs } from '../../src/ics.js';

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

const sampleMatch = makeMatch();

describe('generateIcs', () => {
  it('VCALENDAR로 감싼다', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1 일정' });
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  it('VTIMEZONE 블록을 포함하지 않는다 (UTC 시각 사용 → 캘린더 앱이 자동 변환)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).not.toContain('BEGIN:VTIMEZONE');
    expect(ics).not.toContain('TZID:');
    expect(ics).not.toContain('X-WR-TIMEZONE:');
  });

  it('UID는 match.id 기반 (naver: 접두 + @lck-schedule-sync)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('UID:naver:115548128962840643@lck-schedule-sync');
  });

  it('DTSTART는 UTC compact 형식 (입력 UTC 10:00 → 20260408T100000Z)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('DTSTART:20260408T100000Z');
  });

  it('DTEND는 Bo3 기준 +3h (UTC 10:00 → 13:00)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('DTEND:20260408T130000Z');
  });

  it('Bo5는 +4.5h (UTC 10:00 → 14:30)', () => {
    const bo5 = makeMatch({ bestOf: 5, startsAt: '2026-04-08T10:00:00Z' });
    const ics = generateIcs([bo5], { calendarName: 'T1' });
    expect(ics).toContain('DTEND:20260408T143000Z');
  });

  it('SUMMARY에 한국어 팀명을 포함한다', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 2주 차 (Bo3)');
  });

  it('SUMMARY에 플레이오프 stage를 표시한다', () => {
    const playoff = makeMatch({ stage: '플레이오프', bestOf: 5 });
    const ics = generateIcs([playoff], { calendarName: 'T1' });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 플레이오프 (Bo5)');
  });

  it('SUMMARY에 결승 stage를 표시한다', () => {
    const final = makeMatch({ stage: '결승', bestOf: 5 });
    const ics = generateIcs([final], { calendarName: 'T1' });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 결승 (Bo5)');
  });

  it('SUMMARY에 플레이-인 stage를 표시한다', () => {
    const playin = makeMatch({ stage: '플레이-인', bestOf: 3 });
    const ics = generateIcs([playin], { calendarName: 'T1' });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 플레이-인 (Bo3)');
  });

  it('canceled 매치는 STATUS:CANCELLED', () => {
    const canceled = makeMatch({ status: 'canceled' });
    const ics = generateIcs([canceled], { calendarName: 'T1' });
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('scheduled/completed 매치는 STATUS:CONFIRMED', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('VALARM은 포함하지 않는다 (캘린더 앱에 위임)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).not.toContain('BEGIN:VALARM');
  });

  describe('DTSTAMP는 match.startDate 기반 안정값 (cron 재발행에도 동일)', () => {
    it('DTSTAMP가 매치 시작 시각과 같다', () => {
      const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
      expect(ics).toContain('DTSTAMP:20260408T100000Z');
    });

    it('같은 매치는 여러 번 호출해도 DTSTAMP 동일 (cron 안정성)', () => {
      const a = generateIcs([sampleMatch], { calendarName: 'T1' });
      const b = generateIcs([sampleMatch], { calendarName: 'T1' });
      expect(a).toBe(b);
    });
  });

  it('CRLF 줄바꿈 사용 (RFC 5545)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('\r\n');
  });

  it('빈 배열이어도 유효한 ICS를 만든다', () => {
    const ics = generateIcs([], { calendarName: 'T1' });
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('같은 입력이면 같은 출력 (순수성)', () => {
    const a = generateIcs([sampleMatch], { calendarName: 'T1' });
    const b = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(a).toBe(b);
  });

  describe('VEVENT 정렬 (deterministic 출력)', () => {
    const m1 = makeMatch({ id: 'm1', startsAt: '2026-05-15T10:00:00Z' });
    const m2 = makeMatch({ id: 'm2', startsAt: '2026-05-10T10:00:00Z' });
    const m3 = makeMatch({ id: 'm3', startsAt: '2026-05-12T10:00:00Z' });

    it('입력 순서와 무관하게 시작 시각 오름차순으로 VEVENT를 배치한다', () => {
      const ics = generateIcs([m1, m2, m3], { calendarName: 'T1' });
      const uidOrder = [...ics.matchAll(/UID:naver:(m\d+)@/g)].map((mt) => mt[1]);
      expect(uidOrder).toEqual(['m2', 'm3', 'm1']);
    });

    it('입력 배열을 변경하지 않는다 (순수성)', () => {
      const input = [m1, m2, m3];
      const originalIds = input.map((m) => m.id);
      generateIcs(input, { calendarName: 'T1' });
      expect(input.map((m) => m.id)).toEqual(originalIds);
    });

    it('입력 순서가 달라도 같은 ICS를 만든다 (순서 독립성)', () => {
      const a = generateIcs([m1, m2, m3], { calendarName: 'T1' });
      const b = generateIcs([m3, m1, m2], { calendarName: 'T1' });
      expect(a).toBe(b);
    });
  });

  // 한국어 1글자 = UTF-8 3바이트. 75바이트 경계에서 문자 중간 깨지면 ICS 손상.
  describe('RFC 5545 line folding', () => {
    const longKoreanMatch = makeMatch({
      league: 'WORLDS',
      stage: '플레이오프 라운드 1 매치 1',
      bestOf: 5,
    });

    it('75바이트 초과 SUMMARY는 CRLF + 1칸 들여쓰기로 폴딩', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1' });
      expect(ics).toMatch(/SUMMARY:[^\r\n]+\r\n [^\r\n]/);
    });

    it('폴딩 후에도 모든 라인이 75바이트 이하', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1' });
      const encoder = new TextEncoder();
      for (const line of ics.split('\r\n')) {
        expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      }
    });

    it('폴딩 시 한국어 멀티바이트 문자가 깨지지 않음', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1' });
      expect(ics).not.toContain('�');
      const unfolded = ics.replace(/\r\n /g, '');
      expect(unfolded).toContain(
        'SUMMARY:T1 vs 젠지 — 월드 챔피언십 플레이오프 라운드 1 매치 1 (Bo5)',
      );
    });

    it('75바이트 이하 라인은 폴딩하지 않는다', () => {
      const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
      expect(ics).toMatch(/SUMMARY:T1 vs 젠지 — LCK 2주 차 \(Bo3\)\r\nDESCRIPTION:/);
    });
  });
});

describe('VEVENT 블록 구조', () => {
  it('BEGIN:VEVENT … END:VEVENT로 감싼다', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
  });

  it('필수 필드를 모두 포함한다 (UID, DTSTAMP, DTSTART, DTEND, SUMMARY, STATUS, URL)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1' });
    expect(ics).toContain('UID:naver:115548128962840643@lck-schedule-sync');
    expect(ics).toContain('DTSTAMP:20260408T100000Z');
    expect(ics).toContain('DTSTART:20260408T100000Z');
    expect(ics).toContain('DTEND:20260408T130000Z');
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 2주 차 (Bo3)');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('URL:https://lolesports.com/');
  });
});
