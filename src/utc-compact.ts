/**
 * UTC compact 시각 표현 — RFC 5545 §3.3.5 `DATE-TIME` UTC form.
 *
 * 형식: `YYYYMMDDTHHMMSSZ` (예: `20260518T014615Z`).
 * format ↔ parse 한 쌍을 같은 모듈에 응집해 invariant 단일 소스 유지.
 */

const UTC_COMPACT_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

/** Date → `YYYYMMDDTHHMMSSZ`. */
export function formatUtcCompact(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** `YYYYMMDDTHHMMSSZ` → Date. 형식 불일치면 null (안전 fallback). */
export function parseUtcCompact(value: string): Date | null {
  const m = value.match(UTC_COMPACT_PATTERN);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
