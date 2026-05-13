/**
 * 데이터 소스 합성 — primary/fallback 패턴.
 *
 * CLAUDE.md 설계 원칙 #6 "추상화는 두 번째 사례 등장 시" 적용:
 *   Phase 2까지는 lolesports 단일이라 main.ts 인라인 fetch.
 *   Phase 3에서 네이버가 합류 → fallback 합성 필요 → 추출.
 *
 * 순수 함수에 가까움: side effect는 주입된 fetcher 안에. 이 함수 자체는
 * try-catch 합성 + 로그만 담당. 따라서 stub fetcher로 단위 테스트 가능.
 */

import type { Match } from './core/types.js';

export interface FetchWithFallbackOptions {
  readonly primaryName: string;
  readonly fallbackName: string;
}

export interface FetchWithFallbackResult {
  readonly matches: Match[];
  readonly source: 'primary' | 'fallback';
  /** primary가 throw한 경우 그 에러 (운영 가시성용). 정상이면 undefined. */
  readonly primaryError?: unknown;
}

/**
 * primary 호출 → 성공 시 그 결과 반환.
 * primary throw → fallback 호출 + warn 로그 + source='fallback' 표기.
 * fallback도 throw → re-throw (cron 자체 실패로 GitHub Actions가 워크플로 실패 처리).
 *
 * source 반환값은 main.ts에서 운영 가시성(Issue 자동 생성) 트리거에 사용.
 */
export async function fetchWithFallback(
  primary: () => Promise<Match[]>,
  fallback: () => Promise<Match[]>,
  options: FetchWithFallbackOptions,
): Promise<FetchWithFallbackResult> {
  try {
    const matches = await primary();
    return { matches, source: 'primary' };
  } catch (primaryError) {
    console.warn(`[lck-schedule-sync] ⚠️  ${options.primaryName} fetch failed:`, primaryError);
    console.warn(`[lck-schedule-sync] ⚠️  Falling back to ${options.fallbackName}…`);
    const matches = await fallback();
    return { matches, source: 'fallback', primaryError };
  }
}
