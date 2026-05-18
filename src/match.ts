/**
 * Match — League × (Team × Team) × 시간·형식·상태.
 *
 * league.ts·team.ts를 조합하는 자리. 외부 데이터 소스·출력 모두
 * 이 모듈을 알지만, 이 모듈은 그들을 모름.
 */

import { LEAGUE_SHORT_CODE, type League } from './league.js';
import type { Team } from './team.js';

export type BestOf = 1 | 3 | 5;
export type MatchStatus = 'scheduled' | 'completed' | 'canceled';

export type MatchScore = {
  readonly home: number;
  readonly away: number;
  readonly winner: 'HOME' | 'AWAY';
};

/** Bo별 매치 길이 — Bo* 의 * × 30분 (한 게임 ≈ 30분 가정). */
const ESTIMATED_HOURS_BY_BEST_OF: Readonly<Record<BestOf, number>> = {
  1: 0.5,
  3: 1.5,
  5: 2.5,
};

/** Bo별 한국어 표현 — DESCRIPTION 본문에 표시. SUMMARY는 짧은 "Bo3" 유지. */
const BEST_OF_LABEL: Readonly<Record<BestOf, string>> = {
  1: '단판제',
  3: '3판 2선승제',
  5: '5판 3선승제',
};

type MatchProps = {
  readonly id: string;
  readonly league: League;
  readonly stage: string;
  readonly teamA: Team;
  readonly teamB: Team;
  readonly startsAt: string;
  readonly bestOf: BestOf;
  readonly status: MatchStatus;
  /** 완료 매치에만. 셋 다 있어야 의미 있음. */
  readonly score?: MatchScore;
  /** 경기장 (예: "치지직 롤파크"). 네이버 미제공 시 undefined. */
  readonly stadium?: string;
  /** 치지직 라이브 채널 ID. 라이브 URL 구성용. */
  readonly chzzkChannelId?: string;
  /** 치지직 다시보기 video ID. 완료 매치에만. */
  readonly replayVideoId?: number;
};

/** Bo1/3/5 외 값은 BestOf 계약 위반 → throw. context는 발생 위치 추적용. */
export function assertBestOf(value: number, context: string): asserts value is BestOf {
  if (value !== 1 && value !== 3 && value !== 5) {
    throw new Error(`bestOf 계약 위반: ${value} (${context})`);
  }
}

export class Match {
  private constructor(
    readonly id: string,
    readonly league: League,
    readonly stage: string,
    readonly teamA: Team,
    readonly teamB: Team,
    readonly startsAt: string,
    readonly bestOf: BestOf,
    readonly status: MatchStatus,
    readonly score: MatchScore | undefined,
    readonly stadium: string | undefined,
    readonly chzzkChannelId: string | undefined,
    readonly replayVideoId: number | undefined,
  ) {}

  static create(props: MatchProps): Match {
    return new Match(
      props.id,
      props.league,
      props.stage,
      props.teamA,
      props.teamB,
      props.startsAt,
      props.bestOf,
      props.status,
      props.score,
      props.stadium,
      props.chzzkChannelId,
      props.replayVideoId,
    );
  }

  /* ─────────── 외부 노출 getter ─────────── */

  get isActive(): boolean {
    return this.status !== 'canceled';
  }

  involves(teamCode: string): boolean {
    return this.teamA.code === teamCode || this.teamB.code === teamCode;
  }

  get startDate(): Date {
    return new Date(this.startsAt);
  }

  /** 시작 시각 + Bo별 길이. */
  get endDate(): Date {
    return new Date(
      this.startDate.getTime() + ESTIMATED_HOURS_BY_BEST_OF[this.bestOf] * 3600 * 1000,
    );
  }

  // e.g., "T1 vs 젠지 — LCK 1주 차 (Bo3)"
  // e.g., "[LCK] T1 vs 젠지" — 대회는 bracket short code, stage·BoN은 DESCRIPTION으로.
  get summary(): string {
    const matchup = `${this.teamA.displayName} vs ${this.teamB.displayName}`;
    return `[${LEAGUE_SHORT_CODE[this.league]}] ${matchup}`;
  }

  /** LOCATION 필드용 — 네이버 stadium 그대로. ICS LOCATION 필드만 사용, DESCRIPTION엔 중복 X. */
  get location(): string | undefined {
    return this.stadium;
  }

  /**
   * 캘린더 펼침 시 보강 정보 — SUMMARY로 표현 못 한 것만.
   * 매치업·대회(short code)·위치는 SUMMARY 또는 LOCATION 필드 책임이라 제외.
   * 모든 행에 이모지 prefix로 시각 일관성 유지.
   *
   *   - 🎯 stage (모든 매치, raw 네이버 표기) — e.g. `🎯 플레이오프 2R`, `🎯 결승`
   *   - 🎮 형식 (모든 매치)
   *   - 🏆 경기 결과 (완료만)
   *   - 📺 라이브 (예정만) / 🎬 다시보기 (완료만)
   */
  get description(): string {
    return [this.stageText(), this.bestOfText(), this.scoreText(), this.streamText()]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  /** ICS URL property용 — 상태별 가장 의미 있는 링크 (완료=VOD, 예정=라이브). */
  get url(): string | null {
    return this.status === 'completed' ? this.naverVodUrl() : this.chzzkLiveUrl();
  }

  /* ─────────── 내부 헬퍼 ─────────── */

  /**
   * stage 한 줄 — 네이버 raw title 그대로(`플레이오프 2R`·`결승`·`Road to EWC 2R` 등).
   * stage 부재 시 행 자체 생략. EWC raw가 league명을 포함하는 케이스는 한 번뿐인
   * 시각적 중복(SUMMARY `[EWC]` + DESC `🎯 Road to EWC 2R`)이라 허용.
   */
  private stageText(): string | null {
    return this.stage ? `🎯 ${this.stage}` : null;
  }

  private chzzkLiveUrl(): string | null {
    return this.chzzkChannelId ? `https://chzzk.naver.com/live/${this.chzzkChannelId}` : null;
  }

  /**
   * 네이버 e스포츠 다시보기 URL — 완료 매치 VOD용 (치지직 아님).
   * 모든 리그(LCK·MSI·Worlds·EWC·KeSPA·FST) raw 응답의 loungeId가
   * 'League_of_Legends'로 통일됨이 확인되어 상수 path 사용.
   */
  private naverVodUrl(): string | null {
    return this.replayVideoId
      ? `https://game.naver.com/esports/League_of_Legends/videos/${this.replayVideoId}`
      : null;
  }

  /** 형식 한 줄 — `🎮 Bo5 (5판 3선승제)` (영문 단축 + 한국어 풀이). */
  private bestOfText(): string {
    return `🎮 Bo${this.bestOf} (${BEST_OF_LABEL[this.bestOf]})`;
  }

  /** 완료 매치 점수·승자 한 줄. */
  private scoreText(): string | null {
    if (!this.score) return null;
    const winnerName =
      this.score.winner === 'HOME' ? this.teamA.displayName : this.teamB.displayName;
    return `🏆 경기 결과: ${this.score.home} vs ${this.score.away} (${winnerName} 승)`;
  }

  /** 예정 → 치지직 라이브 / 완료 → 네이버 e스포츠 다시보기 / 취소 → 없음. */
  private streamText(): string | null {
    if (this.status === 'scheduled') {
      const url = this.chzzkLiveUrl();
      return url ? `📺 치지직 라이브: ${url}` : null;
    }
    if (this.status === 'completed') {
      const url = this.naverVodUrl();
      return url ? `🎬 다시보기: ${url}` : null;
    }
    return null;
  }
}
