# Claude Code 컨텍스트

> 이 파일은 Claude Code(또는 Cursor의 AI)가 이 레포에 들어왔을 때 빠르게 맥락을 잡기 위한 안내서입니다.

## 프로젝트 한 줄 요약

T1 팬을 위한 LCK 일정 자동 동기화 `.ics` 피드. 톡캘린더처럼 카카오톡에 갇히지 않고 **모든 캘린더 앱(Google·Apple·Outlook)에서 작동**. 슬로건: "단 한 경기도 놓치지 않게."

## 현재 단계

**Phase 2 완료 → Phase 3 대기**. LCK + MSI + Worlds + First Stand 4 league 단일 `t1.ics` 통합 발행 작동. 4 league 합쳐 242 매치 → T1 출전 48 매치 (LCK 16 · MSI 16 · Worlds 16 · First Stand 0). DTO 안정성 Phase 1 사전 검증 그대로 실증 — parser 보강 0줄. 단위 테스트 48개.

## 사용자 코딩 선호

- 프론트엔드 개발자, JavaScript/TypeScript
- **SRP**, **순수 함수**, side effect 격리를 중시
- 가독성 좋은 클린 코드 지향
- 빠른 출시 → 시장 피드백 → 반복 (perfection over progression 경계)
- 개념·코드 설명 시 AS-IS vs TO-BE 비교, "1. 어떤 문제 → 2. 어떤 해결 → 3. 장단점·한계" 구조 선호

## 핵심 설계 원칙

1. **SRP**: side effect는 `lolesports.ts` (API fetch) + `main.ts` (파일 I/O) 두 곳만. Phase 3 진입 시 `naver-esports.ts`가 추가 fetcher로 합류 — 같은 원칙으로 격리.
2. **순수 함수 우선**: `filter.ts`, `ics-generator.ts`, `pipeline.ts`, `team-names.ts`, `parseScheduleResponse` 모두 순수
3. **멱등성**: lolesports `match.id`를 ICS UID로 그대로 사용. 네이버 매치는 `gameId` 사용, 충돌 회피 위해 `naver:` 접두 권장 (Phase 3 진입 시 확정).
4. **시간 처리**: UTC ISO로 보관, 출력 시점에 KST 변환 + TZID 명시. 네이버 응답(epoch ms KST)도 동일 정규화.
5. **개인화 위임**: VALARM 미포함. 알림·색·이름은 캘린더 앱에 위임 + README 시나리오 안내
6. **추상화는 두 번째 사례 등장 시**: Phase 0~1엔 어댑터 인터페이스 X. Phase 3에서 네이버가 두 번째 데이터 소스로 합류하면 그때 추출.
7. **ICS generator는 옵션 객체 받는 순수 함수**: 미래 확장 여지 보존

## 아키텍처

```
src/
├── core/types.ts         # Match, Team (도메인)
├── team-names.ts         # 한국어 매핑 (순수)
├── lolesports.ts         # ⚠️ API fetcher (유일한 side effect) + parser (순수)
├── filter.ts             # filterByTeam, excludeCanceled (순수)
├── ics-generator.ts      # Match[] → ICS string (순수, RFC 5545)
├── pipeline.ts           # 함수 합성 (순수)
└── main.ts               # ⚠️ 진입점 (fetch + writeFile)
```

## 파일별 책임 (수정 시 SRP 유지)

- **새 데이터 변환 로직** → `pipeline.ts` 또는 `filter.ts` (순수)
- **새 API 호출** → `lolesports.ts` (side effect 격리)
- **ICS 출력 형식 변경** → `ics-generator.ts`만
- **새 팀 추가/리브랜딩** → `team-names.ts`만
- **새 도메인 개념** → `core/types.ts`에 타입 추가 후 단계적 확장

## Phase 로드맵

```
Phase 0 (완료): LCK 정규시즌 + T1 → t1.ics
Phase 1 (완료): + LCK 플옵·결승·플레이-인 (blockName 기반 stage SUMMARY 표시, TBD 제외 유지)
Phase 2 (완료): + MSI + Worlds + First Stand (lolesports API, T1 출전분만 t1.ics 통합)
Phase 3 (다음): + 네이버 esports JSON API 자동화 (EWC + KeSPA Cup + 아시안 게임) — T1 출전 확정 시 반응형
                ↑ 2026-05-13 결정 변경 (이전: 수동 입력). 상세는 "Phase 2 데이터 소스 결정" 섹션 참조.
Phase 4:        + 응원팀 다중 발행 (geng.ics, dk.ics 등 각 팀별 단일 ICS)
Phase 5 (선택): 운영 강화
```

## 핵심 의사결정 요약

- **메커니즘**: ICS 구독 피드 (Pull, 무인증) — Google API 직접 삽입 X
- **데이터 소스**: lolesports 비공식 API (LCK·MSI·Worlds·First Stand) + 네이버 esports JSON API (EWC·KeSPA Cup·아시안 게임, Phase 3)
- **EWC·KeSPA Cup·아시안 게임**: lolesports 미커버 → Phase 3에서 **네이버 esports JSON API 자동화** (2026-05-13 결정, T1 출전 확정 시 반응형 발행)
- **스케줄링**: GitHub Actions cron 매일 2회 (04:00, 23:00 KST)
- **개인화**: 캘린더 앱에 위임 (VALARM 미포함)
- **단일 t1.ics 통합 방향 (Phase 2~3)**: 모든 대회를 단일 `.ics`로 merge (사용자 인지 부담 0). Phase 4에서 다른 응원팀(geng.ics 등) 확장.

## 환경 정보

- **Package manager**: pnpm 9 (`packageManager` 필드로 강제)
- **Node**: >= 20 (engine-strict)
- **테스트**: Vitest 1.x
- **API key**: lolesports 비공식 (`0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z` — `lolesports.ts`에 상수)

## 자주 쓰는 명령

```bash
pnpm install
pnpm dev          # public/t1.ics 생성
pnpm test         # 48개 단위 테스트
pnpm typecheck
```

## Phase 1 발견 사항 (2026-05-12)

**lolesports API 실측 결과 Phase 1 가정이 단순화됨**:

1. **blockName으로 분류 가능**: `"N주 차"` (정규시즌), `"플레이오프"`, `"결승"`, `"플레이-인"`, `"플레이-인 토너먼트 스테이지"` — 별도 leagueId 불필요. `tournament.stage`로 흘러와 SUMMARY에 그대로 표시됨 (`ics-generator.ts:118-124`).
2. **TBD 매치는 ICS 미포함 결정**: 매일 2회 cron이 결정된 매치를 빠르게 흡수 (lag 최대 ~16시간). TeamRef union·TbdMatch 분기 도입 미루기 — 행동 원칙 #2(Simplicity First).
3. **2026엔 LCK CUP 부재**: `getTournamentsForLeague`로 확인 — `lck_cup_2025`만 존재. 코드 분기 미루기.
4. **Road to MSI 별도 항목 없음**: tournament 메타에 명시되지 않음. MSI 측 league 안에 포함되어 있을 가능성 → **Phase 2에서 검증**.
5. **fixture 캡처 위치**: `fixtures/phase-1/` (prettier 제외 설정 완료).

6. **단일 t1.ics 통합 방향 확정 (2026-05-12)**: 모든 대회(LCK + MSI + Worlds + First Stand)의 T1 출전 매치를 단일 `t1.ics`에 합쳐 발행. SUMMARY의 `league.name`(LCK/MSI/월드 챔피언십/First Stand)으로 대회 구분 표시.

**다음 단계 (Phase 2 진입 시)**: `lolesports.ts`에 `fetchAllMatches()` 헬퍼 추가 — leagueId 4개 순차 fetch + concat. 그 외 코드 변경 없음 (DTO 동일).

## Phase 2 완료 (2026-05-13)

**MSI + Worlds + First Stand 통합. Phase 1 사전 검증의 보상으로 변경 면적이 ARCHITECTURE §5.1 예측과 정확히 일치**.

### 실측 vs 예측

| 항목          | 예측 (ARCHITECTURE §5.1)                            | 실측                                                               |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| ① fetch       | `fetchAllMatches()` 헬퍼 1개 추가                   | ✓ `lolesports.ts` +1 함수 (`fetchSchedule` 4번 순차 호출 + concat) |
| ②~⑤·⑦         | 0줄                                                 | ✓ 0줄                                                              |
| ⑥ generateIcs | 0줄, SUMMARY가 `tournament.displayName`로 자연 분기 | ✓ 0줄, `LCK` / `MSI` / `월드 챔피언십` / `First Stand` 자연 표시   |
| `main.ts`     | 1줄                                                 | 3줄 (import 1, 호출 1, 로깅 1)                                     |

### 발견 사항

1. **4 league 합쳐 242 매치 fetch**, T1 출전 48 매치(LCK 16 · MSI 16 · Worlds 16 · First Stand 0)로 ICS 발행.
2. **First Stand T1 미출전 (0건)**: 2025 First Stand는 LCK CUP 우승팀(한화생명) 출전. 코드는 0 매치를 자연 흐름으로 처리 — **`Match` 도메인이 데이터 소스 차단막** (ARCHITECTURE §5 인사이트)의 실증.
3. **DTO 100% 일치 재확인**: 캡처된 4 league의 blockName 인벤토리가 [Phase 1 사전 분석](#대회별-blockname-인벤토리)과 한 글자도 어긋나지 않음.
4. **fixture 운영 패턴**: 큰 raw 캡처는 `fixtures/phase-2/*-newer-1.json`로 로컬 only (`.gitignore`의 `fixtures/`에 매치). CI 테스트용은 작은 sample(`fixtures/{msi,worlds,first-stand}-schedule-sample.json`, 4-7KB)로 `git add -f` 추적. Phase 1 패턴(`lck-schedule-sample.json`)과 일관.
5. **순차 fetch 정책**: `Promise.all` 병렬 대신 `for-await` 순차로 lolesports 부담 최소화. 페이지네이션 포함 분당 ~20회 미만, safety guard 50페이지/리그.
6. **한 리그 실패 정책**: 전체 throw (partial publish는 "왜 한 대회만 사라졌지?" 혼란 회피). 매일 2회 cron이 다음 회차에서 흡수.

### 다음 단계 (Phase 3 진입 시)

`naver-esports.ts` 신규 fetcher + `toMatchFromNaver()` parser 추가. 도메인이 `Match`로 통일됐기 때문에 ③~⑦ 변경 0줄. UID 충돌 회피 위해 네이버 매치는 `naver:<gameId>@lck-schedule-sync` 접두 권장. 자세한 사전 결정·후보 비교·모범사례 8항목은 "Phase 2 데이터 소스 결정" 섹션 참조.

## lolesports API 참조 (2026-05-12 분석)

### 응답 필드 (총 23개, 우리 사용 11개)

**사용**: `startTime` → DTSTART, `state` → STATUS, `type`(`match`만 통과), `blockName` → `tournament.stage`, `league.name` → `tournament.displayName`, `match.id` → UID(멱등성), `match.strategy.{type,count}` → `bestOf`, `match.teams[].{name,code}` → 팀 표시·필터.

**미사용**: `league.slug` / `match.flags` / `match.teams[].image` (호환성 낮음), `match.teams[].record.{wins,losses}` + `result.{outcome,gameWins}` (⚠️ 스포일러 회피 — 이미 본 매치 다시 캘린더에서 봐도 결과 노출 안 됨).

### DTO 안정성

LCK 4개 시즌(2025 분기별 + 2026) × MSI + Worlds + First Stand 7개 응답을 비교 — **23 필드 모두 100% 동일**. 시즌·대회 무관 parser 보강 불필요.

### publish lead time

LCK ~3주, MSI ~2개월. 매일 2회 cron(04:00·23:00 KST)으로 모든 대회 흡수 충분.

### 대회별 `blockName` 인벤토리

| 대회        | blockName 종류                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------- |
| LCK         | `N주 차` / `플레이오프` / `결승` / `플레이-인` / `플레이-인 토너먼트 스테이지` / `대표 선발전` |
| MSI         | `토너먼트 스테이지` / `플레이-인` / `플레이-인 토너먼트 스테이지` / `결승`                     |
| Worlds      | `스위스` / `8강` / `4강` / `결승` / `플레이-인 토너먼트 스테이지`                              |
| First Stand | `1라운드` / `그룹` / `4강` / `결승`                                                            |

raw `blockName`을 `tournament.stage`로 그대로 흘려 SUMMARY에 표시(정규화 X). lolesports가 라운드 디테일(R1/R2 등)을 API에 제공하지 않아 우리도 그 한계 안에서 작동.

## Phase 2 데이터 소스 결정 (2026-05-13)

**EWC·KeSPA Cup·아시안 게임 = 네이버 esports JSON API 자동화** (이전 결정 "수동 입력" 뒤집기). 실행은 Phase 3.

### 발견

EWC·KeSPA Cup이 싱글/더블 엘리미네이션 토너먼트 → 매 경기 후 다음 대진 동적 결정. 수동 입력 비용 가정(1.5h/년)이 실제 3-5h + 매 경기 후 입력 압박. **자동화 가치 5-10배 ↑**.

### 후보 비교 (모두 탈락 → 네이버 채택)

| 후보                            | 탈락 사유                                 |
| ------------------------------- | ----------------------------------------- |
| lolesports API 확장             | 41개 리그 전수 확인, EWC·KeSPA·AG 미커버  |
| Leaguepedia (MediaWiki + Cargo) | rate limit 1회/분 + Cargo 전용 limit      |
| Cito · PandaScore               | 무료 한도 작음 / EWC 커버 미검증          |
| 나무위키 스크래핑               | 약관·DOM 변경 위험                        |
| RSS·뉴스레터 자동화             | 군주 사용 패턴(네이버 검색)과 안 맞음     |
| **네이버 esports JSON API**     | ✅ 한국어 풍부, 구조 깔끔, KeSPA·EWC 검증 |

### Endpoint (검증 완료)

```
GET https://esports-api.game.naver.com/service/v2/schedule/month
  ?month=YYYY-MM&topLeagueId=<league>&relay=false
```

검증된 `topLeagueId`: `lol_kespa` (KeSPA Cup 2025 39경기), `ewc_lol` (EWC 2025 7월 18경기).

응답은 lolesports DTO와 1:1 매핑 가능 — `gameId` → UID(접두 `naver:` 권장으로 충돌 회피), `startDate`(epoch ms KST) → DTSTART, `title`(한글) → stage, `homeTeam`/`awayTeam.{name, nameEng, nameEngAcronym}` → 팀.

### 비영리 공개 가능 — 정적 `.ics` 구조 덕

사용자 수 ≠ 네이버 트래픽. 사용자 1명이든 10000명이든 네이버 호출은 매일 2회 고정 (사용자는 GitHub Pages에서 `.ics`만 받음). 비영리 + 비상업 + 분당 1회 미만 + 출처 명시 → 실무적 위험 거의 0.

### Phase 3 구현 시 갖출 모범사례 (8항목)

기본 6: ① User-Agent 명확히 (`lck-schedule-sync/X.X (github URL; 연락처)`) ② 매일 2회 cron 유지 ③ GitHub Actions 24h 캐싱 ④ 403/429 즉시 중단 + 마지막 성공 응답 fallback ⑤ README에 비공식 API 사용 명시 ⑥ 데이터 출처(네이버 esports) 링크 제공. 비영리 공개 추가 2: ⑦ MIT 라이센스 (README에 이미 있음) ⑧ Takedown 채널 명시 (GitHub issue + 군주 이메일, 네이버 요청 시 즉시 중단 의사, SLA 24h).

### 단계적 공개 전략

A. Phase 3 구현 후 1-2주 본인 검증 → B. 1-2개월 후 가까운 T1 팬 커뮤니티 일부 → C. 안정화 후 일반 공개.

### 미검증 항목 (Phase 3 진입 시 1차 검증)

- 아시안 게임 `topLeagueId` 후보 (`lol_asian_games` 등)
- 미래 월 조회 동작 (미공개 시점 호출 시 빈 응답인지 에러인지)
- LCK 정규시즌 lolesports vs 네이버 lag 비교 (LCK는 lolesports 유지 권장)
- rate limit · IP 차단 · GitHub Actions runner IP에서 네이버 접근 가능 여부

## 참고 문서

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): 데이터 파이프라인 7단계·DTO 매핑·Phase 변경 면적 예측 (시스템 "어떻게 굴러가나" 상세)
- `lol-esports-2026-guide.md`: 1년 e스포츠 사이클 정보
- `lol-esports-2026-infographic.html`: 시각 자료

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
