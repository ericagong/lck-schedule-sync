/**
 * 동기화 메타 — RFC 5545 §3.8.7.3 LAST-MODIFIED · §3.8.7.4 SEQUENCE.
 *
 * 클라이언트(Google·Apple·Outlook)가 "콘텐츠 변경됨"을 정확히 인지하려면
 * 같은 UID + SEQUENCE++ + LAST-MODIFIED 갱신이 정식 신호. 매 cron 재발행마다
 * 메타가 변하면 false 업데이트 노이즈가 나므로 **콘텐츠 변경 시에만 갱신**.
 *
 * 변경 감지 방식: 이전 발행분 ICS에 임베드된 `X-CONTENT-HASH`를 read해
 * 새 매치 hash와 비교. 같으면 SEQUENCE·LAST-MODIFIED 이전값 유지, 다르면 +1·now.
 * 별도 state 파일 불필요 — 자기 자신 ICS가 곧 상태 저장소.
 */

import { createHash } from 'node:crypto';

import type { Match } from './match.js';

export type SyncMeta = {
  readonly sequence: number;
  readonly lastModified: Date;
};

export type PreviousEntry = {
  readonly sequence: number;
  readonly contentHash: string;
  readonly lastModified: Date | null;
};

export type PreviousSyncMap = ReadonlyMap<string, PreviousEntry>;

/**
 * 콘텐츠 hash — 변경 감지가 의미 있는 모든 필드 join 후 SHA-256.
 * VEVENT 직렬화에서 실제로 표면화되는 값(SUMMARY·DESCRIPTION·STATUS·LOCATION·URL·DTSTART)만 포함.
 * DTSTAMP는 매 발행 변동값이므로 제외(콘텐츠 신호가 아님).
 */
export function computeContentHash(match: Match): string {
  const parts = [
    match.startsAt,
    match.summary,
    match.description,
    match.status,
    match.location ?? '',
    match.url ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * 이전 발행분 ICS 텍스트 → UID별 sync state 복원.
 *
 * RFC 5545 unfolding(`\r\n ` 제거) 후 BEGIN/END:VEVENT 블록을 추출하고
 * UID·SEQUENCE·LAST-MODIFIED·X-CONTENT-HASH 4개 라인만 읽음. 다른 필드는 무시.
 * SEQUENCE 부재 시 0, X-CONTENT-HASH 부재 시 빈 문자열(어떤 새 hash와도 불일치 → +1 트리거).
 */
export function parsePreviousIcs(text: string): PreviousSyncMap {
  const unfolded = text.replace(/\r?\n /g, '');
  const result = new Map<string, PreviousEntry>();

  const lines = unfolded.split(/\r?\n/);
  let inVevent = false;
  let buffer: string[] = [];
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inVevent = true;
      buffer = [];
    } else if (line === 'END:VEVENT' && inVevent) {
      inVevent = false;
      const entry = readVeventEntry(buffer);
      if (entry) result.set(entry.uid, entry.value);
    } else if (inVevent) {
      buffer.push(line);
    }
  }
  return result;
}

function readVeventEntry(
  lines: readonly string[],
): { readonly uid: string; readonly value: PreviousEntry } | null {
  const fields = new Map<string, string>();
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    // RFC 5545: property name(파라미터 ;포함)에서 ;는 property와 parameter 구분자.
    // 본 read는 base property name만 필요 → ; 앞 부분.
    const head = line.slice(0, colon);
    const name = head.split(';')[0] ?? head;
    const value = line.slice(colon + 1);
    fields.set(name, value);
  }
  const uid = fields.get('UID');
  if (!uid) return null;

  const sequenceRaw = fields.get('SEQUENCE');
  const sequence = sequenceRaw ? Number.parseInt(sequenceRaw, 10) : 0;
  const contentHash = fields.get('X-CONTENT-HASH') ?? '';
  const lastModifiedRaw = fields.get('LAST-MODIFIED');
  const lastModified = lastModifiedRaw ? parseUtcCompact(lastModifiedRaw) : null;

  return {
    uid,
    value: {
      sequence: Number.isFinite(sequence) ? sequence : 0,
      contentHash,
      lastModified,
    },
  };
}

/** YYYYMMDDTHHMMSSZ → Date. 형식 불일치면 null (안전 fallback). */
function parseUtcCompact(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 이전 발행분과 비교 후 SEQUENCE/LAST-MODIFIED 결정.
 *
 *   - 신규 UID (이전 없음): sequence=0, lastModified=now
 *   - 같은 UID + 동일 hash: 이전값 유지 (lastModified 누락 시 now fallback)
 *   - 같은 UID + 다른 hash: sequence+1, lastModified=now
 */
export function decideSyncMeta(
  uid: string,
  contentHash: string,
  previous: PreviousSyncMap,
  now: Date,
): SyncMeta {
  const prev = previous.get(uid);
  if (!prev) {
    return { sequence: 0, lastModified: now };
  }
  if (prev.contentHash && prev.contentHash === contentHash) {
    return {
      sequence: prev.sequence,
      lastModified: prev.lastModified ?? now,
    };
  }
  return { sequence: prev.sequence + 1, lastModified: now };
}
