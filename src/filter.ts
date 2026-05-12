/**
 * 매치 필터링.
 *
 * 모두 순수 함수. 입력 배열을 변경하지 않음.
 */

import type { Match } from './core/types.js';

/**
 * 지정한 팀 코드가 참여하는 매치만 반환.
 *
 * @param matches 전체 매치 목록
 * @param teamCode 필터링할 팀의 lolesports code (예: "T1")
 * @returns teamA 또는 teamB의 code가 일치하는 매치만 (순서 보존)
 */
export function filterByTeam(matches: readonly Match[], teamCode: string): Match[] {
  return matches.filter((m) => m.teamA.code === teamCode || m.teamB.code === teamCode);
}

/**
 * 취소되지 않은 매치만 반환.
 */
export function excludeCanceled(matches: readonly Match[]): Match[] {
  return matches.filter((m) => m.status !== 'canceled');
}
