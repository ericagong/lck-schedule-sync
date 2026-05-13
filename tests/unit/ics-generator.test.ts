import { describe, expect, it } from 'vitest';
import type { Match } from '../../src/core/types.js';
import { generateIcs } from '../../src/ics-generator.js';

const FIXED_NOW = new Date('2026-05-12T03:00:00Z');

const sampleMatch: Match = {
  id: '115548128962840643',
  tournament: { displayName: 'LCK', stage: '2주 차' },
  teamA: { code: 'T1', displayName: 'T1' },
  teamB: { code: 'GEN', displayName: '젠지' },
  startsAt: '2026-04-08T10:00:00Z', // UTC 10:00 → KST 19:00
  bestOf: 3,
  status: 'completed',
};

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

  it('UID는 match.id 기반 (멱등성)', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('UID:115548128962840643@lck-schedule-sync');
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
    const bo5: Match = { ...sampleMatch, bestOf: 5, startsAt: '2026-04-08T10:00:00Z' };
    const ics = generateIcs([bo5], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('DTEND;TZID=Asia/Seoul:20260408T233000');
  });

  it('SUMMARY에 한국어 팀명을 포함한다', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 2주 차 (Bo3)');
  });

  it('SUMMARY에 플레이오프 stage를 표시한다', () => {
    const playoff: Match = {
      ...sampleMatch,
      tournament: { displayName: 'LCK', stage: '플레이오프' },
      bestOf: 5,
    };
    const ics = generateIcs([playoff], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 플레이오프 (Bo5)');
  });

  it('SUMMARY에 결승 stage를 표시한다', () => {
    const final: Match = {
      ...sampleMatch,
      tournament: { displayName: 'LCK', stage: '결승' },
      bestOf: 5,
    };
    const ics = generateIcs([final], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 결승 (Bo5)');
  });

  it('SUMMARY에 플레이-인 stage를 표시한다', () => {
    const playin: Match = {
      ...sampleMatch,
      tournament: { displayName: 'LCK', stage: '플레이-인' },
      bestOf: 3,
    };
    const ics = generateIcs([playin], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('SUMMARY:T1 vs 젠지 — LCK 플레이-인 (Bo3)');
  });

  it('canceled 매치는 STATUS:CANCELLED', () => {
    const canceled: Match = { ...sampleMatch, status: 'canceled' };
    const ics = generateIcs([canceled], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('scheduled/completed 매치는 STATUS:CONFIRMED', () => {
    const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('VALARM은 포함하지 않는다 (캘린더 앱에 위임 - plan.md §6.1)', () => {
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

  describe('RFC 5545 line folding (75바이트 경계)', () => {
    // 한국어 1글자 = UTF-8 3바이트. 75바이트 경계에서 문자 중간에 끊기면 ICS가 깨짐.
    const longKoreanMatch: Match = {
      ...sampleMatch,
      tournament: {
        displayName: '리그 오브 레전드 챔피언스 코리아',
        stage: '플레이오프 라운드 1 매치 1',
      },
      bestOf: 5,
    };

    it('75바이트를 초과하는 SUMMARY는 CRLF + 1칸 들여쓰기로 폴딩된다', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1', now: FIXED_NOW });
      // 폴딩 표식: SUMMARY 라인 뒤 CRLF + 공백 1칸 + 연속 텍스트
      expect(ics).toMatch(/SUMMARY:[^\r\n]+\r\n [^\r\n]/);
    });

    it('폴딩 후에도 모든 라인이 75바이트 이하다', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1', now: FIXED_NOW });
      const encoder = new TextEncoder();
      for (const line of ics.split('\r\n')) {
        expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      }
    });

    it('폴딩 시 한국어 멀티바이트 문자를 깨뜨리지 않는다', () => {
      const ics = generateIcs([longKoreanMatch], { calendarName: 'T1', now: FIXED_NOW });
      // 유효하지 않은 UTF-8 시퀀스가 만들어졌다면 디코딩 시 U+FFFD가 등장함
      expect(ics).not.toContain('�');
      // 언폴딩(CRLF+공백 제거) 후 원본 SUMMARY가 그대로 복원되어야 함
      const unfolded = ics.replace(/\r\n /g, '');
      expect(unfolded).toContain(
        'SUMMARY:T1 vs 젠지 — 리그 오브 레전드 챔피언스 코리아 플레이오프 라운드 1 매치 1 (Bo5)',
      );
    });

    it('75바이트 이하 라인은 폴딩하지 않는다', () => {
      // sampleMatch의 SUMMARY는 짧은 한국어 → 폴딩 발생 X
      const ics = generateIcs([sampleMatch], { calendarName: 'T1', now: FIXED_NOW });
      // 짧은 SUMMARY 라인 뒤에는 곧장 DESCRIPTION이 와야 함 (연속 들여쓰기 없음)
      expect(ics).toMatch(/SUMMARY:T1 vs 젠지 — LCK 2주 차 \(Bo3\)\r\nDESCRIPTION:/);
    });
  });
});
