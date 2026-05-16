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
  'KRX', // 2026 키움증권 후원 (display: 'DRX')
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
  KRX: 'DRX',
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
