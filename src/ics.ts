/**
 * Match → IcsEvent → ICS 문자열 (RFC 5545).
 */

import type { BestOf, Match } from './match.js';

export type IcsOptions = {
  readonly calendarName: string;
  /** DTSTAMP용. 테스트 주입. 미지정 시 new Date(). */
  readonly now?: Date;
};

const TZID = 'Asia/Seoul';
const PRODID = '-//lck-schedule-sync//T1//KO';
const STREAM_URL = 'https://lolesports.com/';

/** 실측 평균 (Bo1 30~50분, Bo3 2~3h, Bo5 3.5~5h). */
const ESTIMATED_HOURS_BY_BEST_OF: Readonly<Record<BestOf, number>> = {
  1: 1,
  3: 3,
  5: 4.5,
};

/**
 * ⚠️ 백슬래시를 가장 먼저. 다른 escape가 만든 `\\`가 다시 escape되면 출력이 깨짐.
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * RFC 5545 라인 폴딩 (75바이트 초과 시 CRLF + 1칸).
 * 한국어 = UTF-8 3바이트 → 문자 단위로 누적해 멀티바이트 깨짐 방지.
 * continuation 청크는 앞 공백 1칸 포함해 75바이트가 되도록 74에서 캡.
 */
function foldLine(line: string): string {
  const FIRST_MAX_BYTES = 75;
  const CONT_MAX_BYTES = 74;
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= FIRST_MAX_BYTES) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    const limit = chunks.length === 0 ? FIRST_MAX_BYTES : CONT_MAX_BYTES;
    if (currentBytes + charBytes > limit) {
      chunks.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current.length > 0) chunks.push(current);

  return chunks.map((c, i) => (i === 0 ? c : ' ' + c)).join('\r\n');
}

/**
 * Asia/Seoul은 DST 없어 +9 고정 → UTC 시각에 +9h 더한 뒤 getUTC*로 KST 값 읽기.
 */
function toKstParts(utcDate: Date): {
  y: string;
  mo: string;
  d: string;
  h: string;
  mi: string;
  s: string;
} {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const shifted = new Date(utcDate.getTime() + KST_OFFSET_MS);
  return {
    y: String(shifted.getUTCFullYear()),
    mo: String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    d: String(shifted.getUTCDate()).padStart(2, '0'),
    h: String(shifted.getUTCHours()).padStart(2, '0'),
    mi: String(shifted.getUTCMinutes()).padStart(2, '0'),
    s: String(shifted.getUTCSeconds()).padStart(2, '0'),
  };
}

function formatUtcCompact(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function formatKstCompact(utcDate: Date): string {
  const { y, mo, d, h, mi, s } = toKstParts(utcDate);
  return `${y}${mo}${d}T${h}${mi}${s}`;
}

function buildCalendarHeader(options: IcsOptions): string[] {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
  ];
}

function buildVTimezoneBlock(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:KST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

export class IcsEvent {
  readonly uid: string;
  readonly dtstamp: string;
  readonly dtstart: string;
  readonly dtend: string;
  readonly summary: string;
  readonly description: string;
  readonly status: 'CONFIRMED' | 'CANCELLED';
  readonly url: string = STREAM_URL;

  constructor(match: Match, now: Date) {
    const startUtc = match.startDate;
    const endUtc = new Date(
      startUtc.getTime() + ESTIMATED_HOURS_BY_BEST_OF[match.bestOf] * 3600 * 1000,
    );

    this.uid = `${match.id}@lck-schedule-sync`;
    this.dtstamp = formatUtcCompact(now);
    this.dtstart = formatKstCompact(startUtc);
    this.dtend = formatKstCompact(endUtc);
    this.summary = `${match.matchup} — ${match.tournamentLabel} (Bo${match.bestOf})`;
    this.description = [
      match.matchup,
      `${match.tournament.displayName} — ${match.tournament.stage}`,
      `Best of ${match.bestOf}`,
      '',
      `중계: ${STREAM_URL}`,
    ].join('\n');
    this.status = match.status === 'canceled' ? 'CANCELLED' : 'CONFIRMED';
  }

  static from(match: Match, now: Date): IcsEvent {
    return new IcsEvent(match, now);
  }

  toLines(): string[] {
    return [
      'BEGIN:VEVENT',
      `UID:${this.uid}`,
      `DTSTAMP:${this.dtstamp}`,
      `DTSTART;TZID=${TZID}:${this.dtstart}`,
      `DTEND;TZID=${TZID}:${this.dtend}`,
      `SUMMARY:${escapeText(this.summary)}`,
      `DESCRIPTION:${escapeText(this.description)}`,
      `STATUS:${this.status}`,
      `URL:${this.url}`,
      'END:VEVENT',
    ];
  }
}

/**
 * deterministic 출력 — 입력 매치를 시작시각 오름차순 정렬.
 */
export function generateIcs(matches: readonly Match[], options: IcsOptions): string {
  const now = options.now ?? new Date();
  const sorted = [...matches].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    [
      ...buildCalendarHeader(options),
      ...buildVTimezoneBlock(),
      ...sorted.flatMap((m) => new IcsEvent(m, now).toLines()),
      'END:VCALENDAR',
    ]
      .map(foldLine)
      .join('\r\n') + '\r\n'
  );
}
