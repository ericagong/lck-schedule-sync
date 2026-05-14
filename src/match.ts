import type { NaverMatch } from './naver.js';
import type { TeamCode, TeamDisplayName } from './team.js';

export type TournamentInfo = {
  readonly displayName: string;
  readonly stage: string;
};

export type Team = {
  readonly code: TeamCode;
  readonly displayName: TeamDisplayName;
};

export type BestOf = 1 | 3 | 5;

export type MatchStatus = 'scheduled' | 'completed' | 'canceled';

/**
 * raw topLeagueId → 한국어 표시명. 출처: game.naver.com/esports HTML scrape (추정 X).
 * 아시안 게임(asi_lol)은 4년 주기·데이터 부재로 자동화 범위 외.
 */
export const LEAGUES = {
  lck: 'LCK',
  msi: 'MSI',
  world_championship: '월드 챔피언십',
  first_stand_lol: 'First Stand',
  ewc_lol: 'EWC',
  lol_kespa: 'KeSPA Cup',
} as const;

export class Match {
  readonly id: string;
  readonly tournament: TournamentInfo;
  readonly teamA: Team;
  readonly teamB: Team;
  readonly startsAt: string;
  readonly bestOf: BestOf;
  readonly status: MatchStatus;

  constructor(raw: NaverMatch, leagueDisplayName: string) {
    const home = raw.homeTeam!;
    const away = raw.awayTeam!;

    this.id = `naver:${raw.gameId}`;
    this.tournament = { displayName: leagueDisplayName, stage: raw.title ?? '' };
    this.teamA = { code: home.nameEngAcronym, displayName: home.name };
    this.teamB = { code: away.nameEngAcronym, displayName: away.name };
    this.startsAt = new Date(raw.startDate).toISOString();
    this.bestOf = raw.maxMatchCount;
    this.status = Match.normalizeStatus(raw.matchStatus);
  }

  private static normalizeStatus(naverStatus: string): MatchStatus {
    switch (naverStatus) {
      case 'RESULT':
        return 'completed';
      case 'BEFORE':
        return 'scheduled';
      case 'CANCEL':
        return 'canceled';
      default:
        return 'scheduled';
    }
  }

  /**
   * 가드:
   * - homeTeam/awayTeam 누락·이름 비어있음 (TBD) → null (silent skip — 정상 상태)
   * - invalid startDate → null (silent skip)
   * - alien topLeagueId → null (우리가 요청한 ID만 응답에 와야 정상)
   * - maxMatchCount가 1/3/5가 아님 → **throw** (Naver 계약 위반 — 워크플로 실패로 즉시 알람)
   */
  static from(raw: NaverMatch): Match | null {
    if (!raw.homeTeam || !raw.awayTeam) return null;
    if (!raw.homeTeam.nameEngAcronym || !raw.awayTeam.nameEngAcronym) return null;
    if (!raw.homeTeam.name || !raw.awayTeam.name) return null;

    const count: number = raw.maxMatchCount;
    if (count !== 1 && count !== 3 && count !== 5) {
      throw new Error(`Naver 계약 위반: maxMatchCount=${count} (gameId=${raw.gameId})`);
    }

    if (!Number.isFinite(raw.startDate)) return null;

    const displayName = LEAGUES[raw.topLeagueId as keyof typeof LEAGUES];
    if (!displayName) return null;

    return new Match(raw, displayName);
  }

  // 가드 통과 못 한 매치는 silent skip — null filter 내장.
  static fromList(raws: readonly NaverMatch[]): Match[] {
    return raws.map((r) => Match.from(r)).filter((m): m is Match => m !== null);
  }

  get startDate(): Date {
    return new Date(this.startsAt);
  }

  // e.g., "T1 vs 젠지"
  get matchup(): string {
    return `${this.teamA.displayName} vs ${this.teamB.displayName}`;
  }

  // e.g., "LCK 정규시즌 1R" (stage 없으면 "LCK"만)
  get tournamentLabel(): string {
    const { displayName, stage } = this.tournament;
    return stage ? `${displayName} ${stage}` : displayName;
  }

  get isActive(): boolean {
    return this.status !== 'canceled';
  }

  involves(teamCode: TeamCode): boolean {
    return this.teamA.code === teamCode || this.teamB.code === teamCode;
  }
}
