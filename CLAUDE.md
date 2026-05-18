# Claude Code 컨텍스트

> 이 파일은 Claude Code(또는 Cursor의 AI)가 이 레포에 들어왔을 때 빠르게 맥락을 잡기 위한 안내서입니다.

## 프로젝트 한 줄 요약

LCK 팬을 위한 팀별 일정 자동 동기화 `.ics` 피드. 톡캘린더처럼 카카오톡에 갇히지 않고 **모든 캘린더 앱(Google·Apple·Outlook)에서 작동**. 슬로건: "단 한 경기도 놓치지 않게."

## 현재 단계

**Phase 4 진행 중**. LCK 10팀 전체 발행(`{팀코드}.ics`) + 팀 선택 landing page(`index.html`) + 매치 메타 풍부화(점수·VOD·치지직·LOCATION) + 동기화 메타 RFC 5545 정합(SEQUENCE/LAST-MODIFIED/CREATED/X-CONTENT-HASH) + SUMMARY/DESC 재설계(`[SHORT_CODE] matchup` + 이모지 일관 DESC). 데이터 소스는 네이버 esports JSON 단일(6 대회: LCK·MSI·Worlds·FST·EWC·KeSPA Cup), 3 + 1 = 5 month rolling.

## 사용자 코딩 선호

- 프론트엔드 개발자, JavaScript/TypeScript
- **SRP**, **순수 함수**, side effect 격리를 중시
- 가독성 좋은 클린 코드 지향
- 빠른 출시 → 시장 피드백 → 반복 (perfection over progression 경계)
- 개념·코드 설명 시 AS-IS vs TO-BE 비교, "1. 어떤 문제 → 2. 어떤 해결 → 3. 장단점·한계" 구조 선호

## 핵심 설계 원칙

1. **SRP**: side effect는 `naver.ts` (API fetch) + `main.ts` (파일 I/O) 두 곳만.
2. **순수 함수 우선**: 도메인·직렬화·동기화 메타 결정·HTML 생성 모두 순수.
3. **멱등성**: 네이버 `gameId`를 `naver:` 접두로 ICS UID 사용. 같은 매치는 항상 같은 UID → 캘린더 in-place 갱신 (중복 없음).
4. **시간 처리 (UTC 일관)**: 보관은 UTC ISO, ICS 출력은 RFC 5545 UTC compact (`Z` suffix). 캘린더 앱이 사용자 로컬 timezone으로 자동 변환 (한국 사용자 = KST 표시, 해외 한국 팬 = 현지 시각). VTIMEZONE 블록 불필요.
5. **동기화 신호 분리 (RFC 정합)**: `DTSTAMP`는 RFC §3.8.7.2 정의대로 직렬화 시각(매 발행 변동). 변경 감지의 진짜 신호는 `SEQUENCE`(§3.8.7.4) + `LAST-MODIFIED`(§3.8.7.3) — **콘텐츠 변경 시에만 갱신**. 이전 발행분 `X-CONTENT-HASH`를 read해 매치별 diff. 같은 매치=같은 메타 보존(Outlook noise 0), 진짜 변경=정확한 갱신(in-place 갱신).
6. **개인화 위임**: VALARM 미포함. 알림·색·이름은 캘린더 앱에 위임 + landing page 가이드.
7. **추상화는 두 번째 사례 등장 시**: 어댑터 인터페이스·소스 분기 X. 두 번째 데이터 소스가 실제로 필요해질 때 그때 합성 추출.
8. **ICS generator는 옵션 객체 받는 순수 함수**: 미래 확장 여지 보존.
9. **소스 일관성 = 데이터 정확성**: fallback 미채택 — UID 네임스페이스 전환 시 캘린더가 "삭제 + 재추가"로 인식해 사용자 메모·알림 손상. 네이버 fail은 워크플로 실패로 정직히 알리고 GitHub Pages가 마지막 성공본 서빙.

## 아키텍처

```
src/
├── league.ts        # League · LEAGUE_DISPLAY_NAME · LEAGUE_SHORT_CODE (도메인)
├── team.ts          # Team · LckTeamCode · LCK_TEAMS · LCK_TEAM_DISPLAY_NAME · toTeam (도메인)
├── match.ts         # Match (클래스) · BestOf · MatchStatus · assertBestOf
├── naver.ts         # ⚠️ API fetcher (유일한 side effect) + parser (순수)
├── ics.ts           # Match[] → ICS string (순수, RFC 5545, UTC compact)
├── sync-meta.ts     # SEQUENCE/LAST-MODIFIED 결정 + 이전 ICS parser + contentHash (순수)
├── utc-compact.ts   # YYYYMMDDTHHMMSSZ format ↔ parse (순수)
├── landing.ts       # 팀 선택 페이지 HTML 생성 (순수)
└── main.ts          # ⚠️ 진입점 (fetch + 10팀 loop + writeFile + index.html)
```

## 파일별 책임 (수정 시 SRP 유지)

- **새 데이터 변환 로직** → 순수 함수로 적절한 도메인 모듈(`league.ts`·`team.ts`·`match.ts`)에. 진입점 합성은 `main.ts`.
- **새 API 호출** → `naver.ts` (side effect 격리)
- **ICS 출력 형식 변경** → `ics.ts`만 (도메인 표현은 `match.ts` 게터)
- **동기화 메타 정책 변경** → `sync-meta.ts`만
- **landing page UI 변경** → `landing.ts`만
- **새 도메인 개념** → 도메인 모듈에 타입·표준 추가 후 단계적 확장

## Phase 로드맵 (요약)

```
Phase 0~2: LCK + 국제대회 (MSI·Worlds·FST) lolesports 단일 → T1 출전분만 t1.ics
Phase 3:   네이버 esports JSON 단일 소스 전환 + EWC·KeSPA Cup 통합
Phase 4:   LCK 10팀 다중 발행 + landing page + 매치 메타 풍부화 +
           동기화 메타 RFC 정합 + SUMMARY/DESC 재설계 (진행 중)
Phase 5:   운영 강화 (선택)
```

→ Phase별 의사결정 진화·근거·한계는 [`DECISION_MAKING.md`](./DECISION_MAKING.md) 참조.

## 핵심 의사결정 요약 (디테일은 DECISION_MAKING.md)

- **메커니즘**: ICS 구독 피드 (Pull, 무인증) — Google API 직접 삽입 X (§1.1)
- **데이터 소스**: 네이버 esports JSON 단일 (LCK·MSI·Worlds·FST·EWC·KeSPA Cup). 아시안 게임은 자동화 범위 외 (§2)
- **fallback 미채택**: lolesports는 6 대회 중 4 대회만 커버 + UID 네임스페이스 차이로 캘린더 flapping 위험. 네이버 fail은 fail-loud (§2.4)
- **lookback window**: 5개월 rolling (과거 3 + 현재 + 미래 1). 캘린더 본질="다가오는 일정" (§3)
- **스케줄링**: GitHub Actions cron 매일 2회 (04:00, 23:00 KST)
- **개인화**: 캘린더 앱에 위임 (VALARM 미포함, §1.3)
- **팀별 다중 발행**: LCK 10팀 모두 `{teamCode}.ics`, 단일 fetch + 10팀 filter (Phase 4)
- **매치 메타 풍부화**: 점수·VOD·치지직·LOCATION·BoN 한국어 풀이 모두 ICS 포함 (§4.7)
- **동기화 메타 정합**: DTSTAMP=now, SEQUENCE/LAST-MODIFIED는 콘텐츠 변경 시에만 갱신 (§4.8)
- **SUMMARY/DESC 재설계**: `[LCK] T1 vs 젠지` + DESC 이모지 일관 (🎯·🎮·🏆·📺·🎬) (§4.9)

## 환경 정보

- **Package manager**: pnpm 9 (`packageManager` 필드로 강제)
- **Node**: >= 22 (engine-strict)
- **테스트**: Vitest 4.x, 172개 단위 테스트
- **API key**: 없음 — 네이버 esports JSON API는 무인증 (User-Agent에 본 레포 URL 명시)

## 자주 쓰는 명령

```bash
pnpm install
pnpm dev          # public/{팀}.ics 10개 + index.html 생성
pnpm test         # 172개 단위 테스트
pnpm typecheck
pnpm check        # typecheck + lint + format + test 한 번에
pnpm view:ics     # 배포된 ICS HTTP fetch + 시점·매치수·본문 확인
```

## 참고 문서

- [`DECISION_MAKING.md`](./DECISION_MAKING.md): 의사결정 archive — _문제·대안·선택·근거·한계_ 5요소 정리. Phase 진화·trade-off 디테일 모두 여기.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): 데이터 파이프라인 단계·DTO 매핑·Phase별 변경 면적 (시스템 "어떻게 굴러가나" 상세)
- [`README.md`](./README.md): 사용자 입문 — 구독 방법·환경별 가이드

## 응답 스타일 — 페르소나는 분위기만, 의사결정은 행동 원칙 우선

**우선순위 규칙**: 전역 `~/.claude/CLAUDE.md`의 behavioral guidelines이 항상 우선한다. 페르소나는 톤·분위기 영역일 뿐 의사결정에 개입하지 않는다.

### 페르소나 유지 (분위기)

- "~냥" 어미 가끔 사용, "치즈냥은~" 시작 가끔 사용 — 과하지 않게
- 친근하고 협력적인 톤

### 항상 유지하는 응답 도구 (페르소나 무관, 행동 원칙과 부합)

- AS-IS vs TO-BE 비교
- 옵션 표 + 트레이드오프 명시
- "1. 어떤 문제 → 2. 어떤 해결 → 3. 장단점·한계" 구조
- 멈춰서 명확화 질문 (행동 원칙 #1·#4)
- 다단계 작업은 검증 가능한 plan으로 분해 (행동 원칙 #4)
