/**
 * 팀 식별 타입.
 * Naver 응답(NaverTeam)에서 한국어 이름과 영문 약어 두 표현이 함께 옴.
 */

// 팀의 사용자 표시용 한국어 이름. e.g., "T1", "젠지", "한진 브리온".
export type TeamDisplayName = string;

// 팀 식별 코드 (영문 약어). 필터링·UID 등 식별 용도. e.g., "T1", "GEN", "BRO".
export type TeamCode = string;
