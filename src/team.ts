/**
 * Team — 도메인 식별자 + LCK 닫힌 집합.
 *
 * LCK 팀: 도메인이 코드·표시명 표준 소유. Naver 표기 변화에 흔들리지 않음.
 * International: 열린 집합. Naver 값을 그대로 받아들임.
 */

export const LCK_TEAMS = [
  'T1',
  'GEN',
  'HLE',
  'DK',
  'KT',
  'KRX', // 2026 키움증권 후원 — 팀명 자체가 KRX
  'BRO',
  'BFX',
  'NS',
  'DNS',
] as const;

export type LckTeamCode = (typeof LCK_TEAMS)[number];

/** LCK 팀 표시명 — 도메인 표준. Naver 표기 변화에 흔들리지 않음. */
export const LCK_TEAM_DISPLAY_NAME: Readonly<Record<LckTeamCode, string>> = {
  T1: 'T1',
  GEN: '젠지',
  HLE: '한화생명',
  DK: '디플러스 기아',
  KT: 'KT',
  KRX: 'KRX',
  BRO: '한진 브리온',
  BFX: 'BNK 피어엑스',
  NS: '농심',
  DNS: 'DN 수퍼스',
};

export type Team = {
  /** 정규화된 영문 약어 (예: 'T1', 'GEN'). 필터·비교에 사용. */
  readonly code: string;
  /** 사용자 표시명 (예: '젠지'). 출력에 사용. */
  readonly displayName: string;
};

export function isLckTeam(code: string): code is LckTeamCode {
  return (LCK_TEAMS as readonly string[]).includes(code);
}

/** 외부 문자열 → LckTeamCode. 정규화 + LCK 멤버십 강제. 알려진 설정용. */
export function asLckTeam(raw: string): LckTeamCode {
  const normalized = raw.trim().toUpperCase();
  if (!isLckTeam(normalized)) throw new Error(`Not an LCK team: ${raw}`);
  return normalized;
}

/**
 * 외부 raw (rawCode + rawDisplayName) → Team 도메인 변환.
 *
 * LCK 팀이면 도메인 표준 displayName 사용 (외부 표기 변화에 흔들림 X).
 * International이면 외부 값 그대로 (열린 집합).
 *
 * 외부 fetcher(예: naver.ts)는 자기 raw 구조를 풀어 이 함수에 일반 문자열로 전달.
 * 도메인 매핑 로직(LCK 감지·표준 적용)은 본 모듈 단독 책임 — 진실 공급처 단일화.
 */
export function toTeam(rawCode: string, rawDisplayName: string): Team {
  const code = rawCode.trim().toUpperCase();
  if (isLckTeam(code)) {
    return { code, displayName: LCK_TEAM_DISPLAY_NAME[code] };
  }
  return { code, displayName: rawDisplayName.trim() };
}
