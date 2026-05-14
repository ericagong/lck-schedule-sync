/**
 * 도메인 핵심 타입.
 *
 * 설계 원칙 (plan.md §6):
 * - 모든 필드 readonly: 불변성
 * - startsAt은 UTC ISO 8601: 시간대 변환은 ICS 출력 시점에만
 * - id는 fetcher가 결정한 UID: ICS UID로 그대로 사용 (멱등성)
 *   · 네이버: "naver:<gameId>" — 다른 소스로 전환할 일이 생기면 namespace 분리에 유리
 */

// TODO 도메인 타입이라는건 알겠는데, 어떤 데이터를 어떻게 표현하는지 명확하게 정의해야함
export interface Match {
  readonly id: string;
  readonly tournament: TournamentInfo;
  readonly teamA: Team;
  readonly teamB: Team;
  readonly startsAt: string; // ISO 8601 UTC
  readonly bestOf: BestOf;
  readonly status: MatchStatus;
}

// TODO : 토너먼트 인포가 왜 필요한지? display Name과 string을 왜 다르게 가져가는지?
export interface TournamentInfo {
  readonly displayName: string; // 예: "LCK Split 2 2026"
  readonly stage: string; // 예: "2주 차"
}

export interface Team {
  readonly code: string; // 예: "T1", "GEN"
  readonly displayName: string; // 한국어 표시명, 예: "T1", "젠지"
}

export type BestOf = 1 | 3 | 5;

// TODO : canceled 케이스가 있나 알아보기
export type MatchStatus = 'scheduled' | 'completed' | 'canceled';

// TODO : 하단 함수가 굳이 필요한 이유?
/**
 * Bo 카운트 정규화 — 도메인이 허용하는 1/3/5만 통과시키고 나머지는 null.
 *
 * 호출부는 null을 "이 매치는 도메인 밖" 시그널로 사용 (Bo2/Bo7 등 안전 skip).
 */
export function normalizeBestOf(count: unknown): BestOf | null {
  return count === 1 || count === 3 || count === 5 ? count : null;
}
