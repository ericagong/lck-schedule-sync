/**
 * Match → ICS string (RFC 5545).
 *
 * 시간은 UTC compact (`Z` suffix)로 출력 → 캘린더 앱이 사용자 로컬 timezone으로
 * 자동 변환. 별도 VTIMEZONE 블록·TZID 처리 불필요.
 */

import type { Match } from './match.js';

type IcsOptions = {
  readonly calendarName: string;
};

const PRODID = '-//lck-schedule-sync//T1//KO';

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

/** YYYYMMDDTHHMMSSZ — RFC 5545 UTC compact 표현. */
function formatUtcCompact(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function buildCalendarHeader(options: IcsOptions): string[] {
  return [
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
  ];
}

/**
 * DTSTAMP는 발행 시각이 아닌 매치 시작 시각을 사용 — 같은 매치는 항상 같은
 * DTSTAMP라 cron 재발행 시 일부 캘린더 클라이언트(특히 Outlook)가
 * "업데이트됨"으로 인식하는 노이즈를 회피. UID 멱등성과 같은 결.
 */
function matchToVeventLines(match: Match): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${match.id}@lck-schedule-sync`,
    `DTSTAMP:${formatUtcCompact(match.startDate)}`,
    `DTSTART:${formatUtcCompact(match.startDate)}`,
    `DTEND:${formatUtcCompact(match.endDate)}`,
    `SUMMARY:${escapeText(match.summary)}`,
    `DESCRIPTION:${escapeText(match.description)}`,
    `STATUS:${match.status === 'canceled' ? 'CANCELLED' : 'CONFIRMED'}`,
    `URL:${match.streamUrl}`,
    'END:VEVENT',
  ];
}

/**
 * deterministic 출력 — 입력 매치를 시작시각 오름차순 정렬.
 */
export function generateIcs(matches: readonly Match[], options: IcsOptions): string {
  const sorted = [...matches].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    [
      'BEGIN:VCALENDAR',
      ...buildCalendarHeader(options),
      ...sorted.flatMap((m) => matchToVeventLines(m)),
      'END:VCALENDAR',
    ]
      .map(foldLine)
      .join('\r\n') + '\r\n'
  );
}
