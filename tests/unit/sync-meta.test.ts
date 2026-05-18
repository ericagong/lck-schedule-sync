import { describe, expect, it } from 'vitest';

import { Match } from '../../src/match.js';
import {
  computeContentHash,
  decideSyncMeta,
  parsePreviousIcs,
  type PreviousSyncMap,
} from '../../src/sync-meta.js';

function makeMatch(
  overrides: {
    id?: string;
    stage?: string;
    startsAt?: string;
    status?: 'scheduled' | 'completed' | 'canceled';
    bestOf?: 1 | 3 | 5;
    chzzkChannelId?: string;
    replayVideoId?: number;
    score?: { home: number; away: number; winner: 'HOME' | 'AWAY' };
    stadium?: string;
  } = {},
): Match {
  return Match.create({
    id: `naver:${overrides.id ?? 'g1'}`,
    league: 'LCK',
    stage: overrides.stage ?? '1주 차',
    teamA: { code: 'T1', displayName: 'T1' },
    teamB: { code: 'GEN', displayName: '젠지' },
    startsAt: overrides.startsAt ?? '2026-05-15T10:00:00.000Z',
    bestOf: overrides.bestOf ?? 3,
    status: overrides.status ?? 'scheduled',
    chzzkChannelId: overrides.chzzkChannelId,
    replayVideoId: overrides.replayVideoId,
    score: overrides.score,
    stadium: overrides.stadium,
  });
}

describe('computeContentHash', () => {
  it('같은 매치 콘텐츠는 같은 hash (deterministic)', () => {
    const m1 = makeMatch();
    const m2 = makeMatch();
    expect(computeContentHash(m1)).toBe(computeContentHash(m2));
  });

  it('status 전이(scheduled → completed)는 hash 변경', () => {
    const before = makeMatch({ status: 'scheduled' });
    const after = makeMatch({
      status: 'completed',
      score: { home: 2, away: 0, winner: 'HOME' },
    });
    expect(computeContentHash(before)).not.toBe(computeContentHash(after));
  });

  it('점수 정정(2:0 → 3:0)은 hash 변경 (같은 status 안에서)', () => {
    const before = makeMatch({
      status: 'completed',
      score: { home: 2, away: 0, winner: 'HOME' },
    });
    const after = makeMatch({
      status: 'completed',
      score: { home: 3, away: 0, winner: 'HOME' },
    });
    expect(computeContentHash(before)).not.toBe(computeContentHash(after));
  });

  it('LOCATION(stadium) 추가는 hash 변경', () => {
    const before = makeMatch();
    const after = makeMatch({ stadium: '치지직 롤파크' });
    expect(computeContentHash(before)).not.toBe(computeContentHash(after));
  });

  it('VOD URL 추가는 hash 변경 (예정→완료 + replayVideoId)', () => {
    const before = makeMatch({ status: 'scheduled', chzzkChannelId: 'ch1' });
    const after = makeMatch({
      status: 'completed',
      replayVideoId: 999,
      score: { home: 2, away: 0, winner: 'HOME' },
    });
    expect(computeContentHash(before)).not.toBe(computeContentHash(after));
  });

  it('stage 변경은 hash 변경', () => {
    expect(computeContentHash(makeMatch({ stage: '1주 차' }))).not.toBe(
      computeContentHash(makeMatch({ stage: '결승' })),
    );
  });

  it('hash는 SHA-256 hex 형식 (64자)', () => {
    expect(computeContentHash(makeMatch())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parsePreviousIcs', () => {
  it('VEVENT에서 UID·SEQUENCE·LAST-MODIFIED·X-CONTENT-HASH 추출', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      'SEQUENCE:3',
      'LAST-MODIFIED:20260515T100000Z',
      'X-CONTENT-HASH:abc123',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');

    const map = parsePreviousIcs(text);
    const entry = map.get('naver:g1@lck-teams-schedule');
    expect(entry).toBeDefined();
    expect(entry?.sequence).toBe(3);
    expect(entry?.contentHash).toBe('abc123');
    expect(entry?.lastModified?.toISOString()).toBe('2026-05-15T10:00:00.000Z');
  });

  it('SEQUENCE 부재 시 0', () => {
    const text = [
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      'X-CONTENT-HASH:abc',
      'END:VEVENT',
    ].join('\r\n');
    expect(parsePreviousIcs(text).get('naver:g1@lck-teams-schedule')?.sequence).toBe(0);
  });

  it('X-CONTENT-HASH 부재 시 빈 문자열', () => {
    const text = ['BEGIN:VEVENT', 'UID:naver:g1@lck-teams-schedule', 'END:VEVENT'].join('\r\n');
    expect(parsePreviousIcs(text).get('naver:g1@lck-teams-schedule')?.contentHash).toBe('');
  });

  it('LAST-MODIFIED 부재 시 null', () => {
    const text = [
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      'X-CONTENT-HASH:abc',
      'END:VEVENT',
    ].join('\r\n');
    expect(parsePreviousIcs(text).get('naver:g1@lck-teams-schedule')?.lastModified).toBeNull();
  });

  it('여러 VEVENT 블록을 모두 읽음', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      'SEQUENCE:1',
      'X-CONTENT-HASH:hash1',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:naver:g2@lck-teams-schedule',
      'SEQUENCE:2',
      'X-CONTENT-HASH:hash2',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const map = parsePreviousIcs(text);
    expect(map.size).toBe(2);
    expect(map.get('naver:g1@lck-teams-schedule')?.contentHash).toBe('hash1');
    expect(map.get('naver:g2@lck-teams-schedule')?.contentHash).toBe('hash2');
  });

  it('fold된 라인(CRLF + 1칸)도 unfold 후 읽음 (RFC 5545)', () => {
    // X-CONTENT-HASH 라인이 75바이트 초과해 fold됐다고 가정
    const text = [
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      'X-CONTENT-HASH:abc',
      ' def',
      'END:VEVENT',
    ].join('\r\n');
    expect(parsePreviousIcs(text).get('naver:g1@lck-teams-schedule')?.contentHash).toBe('abcdef');
  });

  it('VEVENT 블록 외 라인(VCALENDAR 헤더 등)은 무시', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'UID:should-be-ignored',
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      'X-CONTENT-HASH:abc',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const map = parsePreviousIcs(text);
    expect(map.size).toBe(1);
    expect(map.has('should-be-ignored')).toBe(false);
  });

  it('빈 텍스트 → 빈 map', () => {
    expect(parsePreviousIcs('').size).toBe(0);
  });

  it('UID 없는 VEVENT 블록은 무시', () => {
    const text = ['BEGIN:VEVENT', 'X-CONTENT-HASH:orphan', 'END:VEVENT'].join('\r\n');
    expect(parsePreviousIcs(text).size).toBe(0);
  });

  it('LF만 있는 줄바꿈(unix)도 처리', () => {
    const text = [
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      'SEQUENCE:5',
      'X-CONTENT-HASH:lf-only',
      'END:VEVENT',
    ].join('\n');
    expect(parsePreviousIcs(text).get('naver:g1@lck-teams-schedule')?.sequence).toBe(5);
  });
});

describe('decideSyncMeta', () => {
  const now = new Date('2026-05-18T09:00:00.000Z');

  it('이전 발행분 없음 (신규 UID) → sequence=0, lastModified=now', () => {
    const result = decideSyncMeta('naver:new@lck-teams-schedule', 'hash-x', new Map(), now);
    expect(result.sequence).toBe(0);
    expect(result.lastModified).toBe(now);
  });

  it('이전 발행분 있음 + 동일 hash → 이전 sequence·lastModified 유지', () => {
    const previousLM = new Date('2026-05-17T20:00:00.000Z');
    const previous: PreviousSyncMap = new Map([
      [
        'naver:g1@lck-teams-schedule',
        { sequence: 7, contentHash: 'hash-x', lastModified: previousLM },
      ],
    ]);
    const result = decideSyncMeta('naver:g1@lck-teams-schedule', 'hash-x', previous, now);
    expect(result.sequence).toBe(7);
    expect(result.lastModified).toBe(previousLM);
  });

  it('이전 발행분 있음 + 다른 hash → sequence+1, lastModified=now', () => {
    const previous: PreviousSyncMap = new Map([
      [
        'naver:g1@lck-teams-schedule',
        { sequence: 7, contentHash: 'hash-old', lastModified: new Date('2026-05-17T20:00:00Z') },
      ],
    ]);
    const result = decideSyncMeta('naver:g1@lck-teams-schedule', 'hash-new', previous, now);
    expect(result.sequence).toBe(8);
    expect(result.lastModified).toBe(now);
  });

  it('이전 X-CONTENT-HASH 빈 값(이전 발행분이 신 필드 미지원)이면 변경으로 간주 → +1', () => {
    const previous: PreviousSyncMap = new Map([
      [
        'naver:g1@lck-teams-schedule',
        { sequence: 0, contentHash: '', lastModified: new Date('2026-05-17T20:00:00Z') },
      ],
    ]);
    const result = decideSyncMeta('naver:g1@lck-teams-schedule', 'hash-new', previous, now);
    expect(result.sequence).toBe(1);
    expect(result.lastModified).toBe(now);
  });

  it('이전 lastModified가 null + 동일 hash → now fallback (안전)', () => {
    const previous: PreviousSyncMap = new Map([
      ['naver:g1@lck-teams-schedule', { sequence: 3, contentHash: 'hash-x', lastModified: null }],
    ]);
    const result = decideSyncMeta('naver:g1@lck-teams-schedule', 'hash-x', previous, now);
    expect(result.sequence).toBe(3);
    expect(result.lastModified).toBe(now);
  });
});

describe('roundtrip: ICS → parse → diff', () => {
  it('같은 매치 두 번 발행 → 두 번째 빌드의 decideSyncMeta가 모두 "unchanged" 판정', () => {
    // 첫 발행 시뮬레이션: sequence=0, lastModified=t1, contentHash=H
    const firstPublishTime = new Date('2026-05-15T00:00:00.000Z');
    const m = makeMatch();
    const hash = computeContentHash(m);
    const firstIcs = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:naver:g1@lck-teams-schedule',
      `LAST-MODIFIED:${firstPublishTime
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')}`,
      'SEQUENCE:0',
      `X-CONTENT-HASH:${hash}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // 두 번째 빌드: 동일 콘텐츠 → 이전값 유지
    const previous = parsePreviousIcs(firstIcs);
    const secondNow = new Date('2026-05-15T12:00:00.000Z');
    const result = decideSyncMeta('naver:g1@lck-teams-schedule', hash, previous, secondNow);
    expect(result.sequence).toBe(0);
    expect(result.lastModified.toISOString()).toBe(firstPublishTime.toISOString());
  });
});
