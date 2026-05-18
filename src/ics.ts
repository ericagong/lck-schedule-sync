/**
 * Match → ICS string (RFC 5545).
 *
 * 시간은 UTC compact (`Z` suffix)로 출력 → 캘린더 앱이 사용자 로컬 timezone으로
 * 자동 변환. 별도 VTIMEZONE 블록·TZID 처리 불필요.
 */

import type { Match } from './match.js';
import type { SyncMeta } from './sync-meta.js';

export type VeventMeta = SyncMeta & {
  readonly contentHash: string;
};

type IcsOptions = {
  readonly calendarName: string;
  /** 직렬화 시각 — RFC 5545 §3.8.7.2 DTSTAMP에 그대로 사용. 매 발행 변동값. */
  readonly now: Date;
  /** UID(`{match.id}@lck-teams-schedule`) → 이전 발행분과 diff 후 결정된 sync meta + content hash. */
  readonly veventMetaByUid: ReadonlyMap<string, VeventMeta>;
};

const PRODID = '-//lck-teams-schedule//KO';

/** cron 12h 주기와 정합 — 클라이언트에 새로고침 hint. */
const REFRESH_INTERVAL = 'PT12H';

const UID_SUFFIX = '@lck-teams-schedule';

/** UID 일관 — sync-meta map 키와 동일하게 사용. */
export function uidOf(match: Match): string {
  return `${match.id}${UID_SUFFIX}`;
}

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
 * URL을 한 atom으로 다뤄 URL 한가운데에서 fold되지 않게 분할.
 * `\\n` 같은 escape sequence와 부딪치지 않도록 URL-safe ASCII만 매칭.
 */
function tokenizeAtoms(line: string): string[] {
  const URL_PATTERN = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&'()*+=%]+/g;
  const atoms: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(line)) !== null) {
    for (const ch of line.slice(cursor, match.index)) atoms.push(ch);
    atoms.push(match[0]);
    cursor = match.index + match[0].length;
  }
  for (const ch of line.slice(cursor)) atoms.push(ch);
  return atoms;
}

/**
 * RFC 5545 라인 폴딩 (75바이트 초과 시 CRLF + 1칸).
 * 한국어 = UTF-8 3바이트 → 문자 단위 누적로 멀티바이트 깨짐 방지.
 * URL은 atom으로 묶어 한 청크 안에 통째로 들어가게 — 일부 캘린더 앱이
 * fold된 URL을 unfold하지 않고 자동 링크화 정규식을 돌리면 fold 경계 뒤
 * 토큰이 잘려나가는 현상(예: `.../1049188` → `10491` 까지만 링크) 회피.
 * URL 자체가 한 청크에 안 들어갈 만큼 길면 char 단위로 fallback.
 */
function foldLine(line: string): string {
  const FIRST_MAX_BYTES = 75;
  const CONT_MAX_BYTES = 74;
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= FIRST_MAX_BYTES) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  const limit = (): number => (chunks.length === 0 ? FIRST_MAX_BYTES : CONT_MAX_BYTES);

  const pushChar = (ch: string): void => {
    const b = encoder.encode(ch).length;
    if (currentBytes + b > limit() && current.length > 0) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += b;
  };

  for (const atom of tokenizeAtoms(line)) {
    const atomBytes = encoder.encode(atom).length;
    if (atomBytes <= CONT_MAX_BYTES) {
      if (currentBytes + atomBytes > limit() && current.length > 0) {
        chunks.push(current);
        current = '';
        currentBytes = 0;
      }
      current += atom;
      currentBytes += atomBytes;
    } else {
      for (const ch of atom) pushChar(ch);
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
  const escapedName = escapeText(options.calendarName);
  return [
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // RFC 7986 §5.1 NAME — X-WR-CALNAME의 표준 후속. 신식 클라이언트(iOS·newer Outlook) 인식.
    `NAME:${escapedName}`,
    `X-WR-CALNAME:${escapedName}`,
    // 클라이언트 새로고침 hint — cron 12h와 정합.
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
    // MS Outlook 비표준 호환 (REFRESH-INTERVAL과 동일 값).
    `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`,
  ];
}

/**
 * VEVENT — RFC 5545 정합:
 *   - DTSTAMP (§3.8.7.2): 직렬화 시각 = now. 매 발행 변동.
 *   - CREATED (§3.8.7.1): 이벤트 첫 생성 시각 = startDate. 영구 deterministic.
 *   - LAST-MODIFIED (§3.8.7.3): 콘텐츠 마지막 변경 시각. 이전 발행분과 동일하면 그대로, 변경 시 now.
 *   - SEQUENCE (§3.8.7.4): 첫 발행 0, 콘텐츠 변경마다 +1.
 *   - X-CONTENT-HASH: 비표준 X-property(§3.8.8.2 허용). 다음 빌드 diff 복원용.
 */
function matchToVeventLines(match: Match, meta: VeventMeta, now: Date): string[] {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${uidOf(match)}`,
    `DTSTAMP:${formatUtcCompact(now)}`,
    `CREATED:${formatUtcCompact(match.startDate)}`,
    `LAST-MODIFIED:${formatUtcCompact(meta.lastModified)}`,
    `SEQUENCE:${meta.sequence}`,
    `DTSTART:${formatUtcCompact(match.startDate)}`,
    `DTEND:${formatUtcCompact(match.endDate)}`,
    `SUMMARY:${escapeText(match.summary)}`,
  ];
  if (match.location) lines.push(`LOCATION:${escapeText(match.location)}`);
  lines.push(
    `DESCRIPTION:${escapeText(match.description)}`,
    `STATUS:${match.status === 'canceled' ? 'CANCELLED' : 'CONFIRMED'}`,
  );
  if (match.url) lines.push(`URL:${match.url}`);
  lines.push(`X-CONTENT-HASH:${meta.contentHash}`);
  lines.push('END:VEVENT');
  return lines;
}

/**
 * deterministic 출력 — 입력 매치를 시작시각 오름차순 정렬.
 * sync meta가 누락된 매치는 직렬화 실패(호출자가 결정 책임을 빠뜨림).
 */
export function generateIcs(matches: readonly Match[], options: IcsOptions): string {
  const sorted = [...matches].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const events = sorted.flatMap((m) => {
    const meta = options.veventMetaByUid.get(uidOf(m));
    if (!meta) {
      throw new Error(`sync meta missing for UID: ${uidOf(m)}`);
    }
    return matchToVeventLines(m, meta, options.now);
  });

  return (
    ['BEGIN:VCALENDAR', ...buildCalendarHeader(options), ...events, 'END:VCALENDAR']
      .map(foldLine)
      .join('\r\n') + '\r\n'
  );
}
