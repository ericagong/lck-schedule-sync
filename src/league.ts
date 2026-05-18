/**
 * League — 도메인 식별자 + 표시명 메타.
 *
 * 닫힌 집합(우리가 발행하는 6 대회). Naver topLeagueId·표시명이
 * 외부에 새지 않고 League로 번역되어 들어옴.
 */

export const ALL_LEAGUES = ['LCK', 'MSI', 'WORLDS', 'FIRST_STAND', 'EWC', 'KESPA_CUP'] as const;

export type League = (typeof ALL_LEAGUES)[number];

export const LEAGUE_DISPLAY_NAME: Readonly<Record<League, string>> = {
  LCK: 'LCK',
  MSI: 'MSI',
  WORLDS: '월드 챔피언십',
  FIRST_STAND: 'First Stand',
  EWC: 'EWC',
  KESPA_CUP: 'KeSPA Cup',
};

/**
 * SUMMARY bracket 표기용 영문 short code — `[LCK] T1 vs 젠지` 패턴.
 * LEAGUE_DISPLAY_NAME이 길 수 있어(`월드 챔피언십`·`First Stand`·`KeSPA Cup`)
 * 모바일 캘린더 그리드 잘림 회피 위해 5자 이하로 통일.
 */
export const LEAGUE_SHORT_CODE: Readonly<Record<League, string>> = {
  LCK: 'LCK',
  MSI: 'MSI',
  WORLDS: 'WORLDS',
  FIRST_STAND: 'FST',
  EWC: 'EWC',
  KESPA_CUP: 'KESPA',
};
