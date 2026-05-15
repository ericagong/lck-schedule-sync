# Claude Code 컨텍스트

> 이 파일은 Claude Code(또는 Cursor의 AI)가 이 레포에 들어왔을 때 빠르게 맥락을 잡기 위한 안내서입니다.

## 프로젝트 한 줄 요약

T1 팬을 위한 LCK 일정 자동 동기화 `.ics` 피드. 톡캘린더처럼 카카오톡에 갇히지 않고 **모든 캘린더 앱(Google·Apple·Outlook)에서 작동**. 슬로건: "단 한 경기도 놓치지 않게."

## 현재 단계

**Phase 3 완료**. 네이버 esports JSON API 단일 소스로 6 대회 통합 발행 (LCK · MSI · Worlds · First Stand · EWC · KeSPA Cup). 3 + 2 = 5 month rolling 윈도우로 T1 ~25 매치 유지. 초기에는 lolesports를 fallback으로 보존했으나 UID 네임스페이스 차이로 사용자 캘린더에 손상을 일으키는 트랩으로 판명 → 4차 결정으로 fallback 제거, 네이버 단일 소스로 정리.

## 사용자 코딩 선호

- 프론트엔드 개발자, JavaScript/TypeScript
- **SRP**, **순수 함수**, side effect 격리를 중시
- 가독성 좋은 클린 코드 지향
- 빠른 출시 → 시장 피드백 → 반복 (perfection over progression 경계)
- 개념·코드 설명 시 AS-IS vs TO-BE 비교, "1. 어떤 문제 → 2. 어떤 해결 → 3. 장단점·한계" 구조 선호

## 핵심 설계 원칙

1. **SRP**: side effect는 `naver.ts` (API fetch) + `main.ts` (파일 I/O) 두 곳만.
2. **순수 함수 우선**: `filter.ts`, `ics-generator.ts`, `parseNaverResponse` 모두 순수
3. **멱등성**: 네이버 `gameId`를 `naver:` 접두로 ICS UID 사용. 같은 매치는 항상 같은 UID → 캘린더 in-place 갱신 (중복 없음).
4. **시간 처리**: UTC ISO로 보관, 출력 시점에 KST 변환 + TZID 명시. 네이버 응답(epoch ms UTC)도 동일 정규화.
5. **개인화 위임**: VALARM 미포함. 알림·색·이름은 캘린더 앱에 위임 + README 시나리오 안내
6. **추상화는 두 번째 사례 등장 시**: 어댑터 인터페이스·소스 분기 X. 두 번째 데이터 소스가 실제로 필요해질 때(예: 네이버 영구 차단 시) 그때 합성 추출.
7. **ICS generator는 옵션 객체 받는 순수 함수**: 미래 확장 여지 보존
8. **소스 일관성 = 데이터 정확성**: ICS `METHOD:PUBLISH`로 발행된 구독 캘린더는 read-only(RFC 5546) → 이벤트별 메모·알림·색 설정 자체가 불가하므로 그 손실은 fallback 근거가 못 됨. 진짜 비용은 (a) fallback이 반쪽짜리라는 점 — lolesports는 6 대회 중 4 대회만 커버, KeSPA·EWC 매치는 fallback 발동 시 통째 사라짐, (b) UID 네임스페이스 전환 시 캘린더가 "전체 삭제 + 재추가"로 인식 → 시각적 flapping + 캘린더 단위 기본 알림이 같은 매치에 재발화 가능. 두 항목으로 충분히 트랩.

## 아키텍처

```
src/
├── types.ts              # Match, Team, BestOf, MatchStatus (도메인)
├── naver.ts              # ⚠️ API fetcher (유일한 side effect) + parser (순수)
├── filter.ts             # selectActiveTeamMatches (순수, 팀 필터 + 취소 제외)
├── ics-generator.ts      # Match[] → ICS string (순수, RFC 5545)
└── main.ts               # ⚠️ 진입점 (fetch + 합성 + writeFile)
```

## 파일별 책임 (수정 시 SRP 유지)

- **새 데이터 변환 로직** → `filter.ts` (순수). 진입점 합성은 `main.ts`.
- **새 API 호출** → `naver.ts` (side effect 격리)
- **ICS 출력 형식 변경** → `ics-generator.ts`만
- **새 도메인 개념** → `types.ts`에 타입 추가 후 단계적 확장

## Phase 로드맵

```
Phase 0 (완료): LCK 정규시즌 + T1 → t1.ics
Phase 1 (완료): + LCK 플옵·결승·플레이-인 (blockName 기반 stage SUMMARY 표시, TBD 제외 유지)
Phase 2 (완료): + MSI + Worlds + First Stand (lolesports API, T1 출전분만 t1.ics 통합)
Phase 3 (완료): 네이버 esports JSON API 단일 소스 전환 (lolesports 코드 제거).
                + 신규 대회 통합: EWC + KeSPA Cup (T1 출전 확정 시 자연 표시)
                + 아시안 게임은 4년 주기·데이터 부재로 자동화 범위 외 (추후 수동/동적 처리 고민)
                ↑ 의사결정 진화는 "Phase 3 데이터 소스 전환 결정" 섹션 참조
                  (1차 수동→네이버 마이너만 → 2차 네이버 단일 primary + lolesports fallback
                   → 3차 아시안 게임 제외 → 4차 fallback 제거).
Phase 4:        + 응원팀 다중 발행 (geng.ics, dk.ics 등 각 팀별 단일 ICS)
                + 추억 보존 archive ICS 검토 (t1-archive.ics 등 — 다가오는 캘린더와 분리, 옵트인)
Phase 5 (선택): 운영 강화
```

## 핵심 의사결정 요약

- **메커니즘**: ICS 구독 피드 (Pull, 무인증) — Google API 직접 삽입 X
- **데이터 소스 (Phase 3 완료)**: 네이버 esports JSON API 단일 (LCK·MSI·Worlds·FST·EWC·KeSPA 6 대회 통합). 아시안 게임은 4년 주기·데이터 부재로 자동화 범위 외.
- **데이터 소스 (Phase 0~2 역사)**: lolesports 비공식 API 단독 (LCK·MSI·Worlds·First Stand). Phase 3에서 네이버로 전환.
- **EWC·KeSPA Cup**: lolesports 미커버 → Phase 3에서 네이버 통합 (T1 출전 확정 시 자연 표시)
- **아시안 게임**: Phase 3 자동화 범위 외 (4년 주기 + `asi_lol` 데이터 부재 확인). 추후 수동 ICS append 또는 별도 동적 메커니즘 고민
- **fallback 미채택**: lolesports는 6 대회 중 4 대회만 커버(KeSPA·EWC 미커버) → fallback 발동 시 그 대회들 통째 사라짐, 반쪽짜리 안전망. 추가로 UID 네임스페이스 차이로 캘린더가 "전체 삭제 + 재추가"로 인식 → 시각적 flapping + 캘린더 단위 기본 알림 재발화 가능. 네이버 fail은 워크플로 실패로 정직히 알리고 GitHub Pages가 마지막 성공본 서빙. 자세한 흐름은 "Phase 3 데이터 소스 전환 결정" 4차 단계.
- **스케줄링**: GitHub Actions cron 매일 2회 (04:00, 23:00 KST)
- **개인화**: 캘린더 앱에 위임 (VALARM 미포함, 사용자가 캘린더 앱에서 직접 알림 설정)
- **사용자 수 카운팅 미실시**: 프라이버시 존중 + 인프라 단순. ICS URL 구독은 HTTP pull이라 본질적으로 정확 카운팅 X. 사용자 호응은 GitHub Star·Issue·PR로 측정.
- **단일 t1.ics 통합 방향**: 모든 대회를 단일 `.ics`로 merge (사용자 인지 부담 0). Phase 4에서 다른 응원팀(geng.ics 등) 확장.

## 환경 정보

- **Package manager**: pnpm 9 (`packageManager` 필드로 강제)
- **Node**: >= 20 (engine-strict)
- **테스트**: Vitest 1.x
- **API key**: 없음 — 네이버 esports JSON API는 무인증 (User-Agent에 본 레포 URL 명시)

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

### 다음 단계 (Phase 3 진입 당시 계획)

당시 계획: `naver.ts` 신규 fetcher + parser + `lolesports.ts`는 fallback으로 강등. 실제 진입 후 4차 결정으로 fallback 제거 — 자세한 흐름은 "Phase 3 데이터 소스 전환 결정" 섹션 4차 단계 참조.

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

## Phase 3 데이터 소스 전환 결정 (2026-05-13 ~ 2026-05-14)

**최종 결정 (4차, 2026-05-14)**: 네이버 esports JSON API 단일 소스. fallback 미채택.

### 결정 흐름 (1차 → 4차)

| 차수    | 결정                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 한계 / 다음 차수 동기                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1차     | EWC·KeSPA·아시안 게임만 네이버로 추가 (lolesports는 LCK/MSI/Worlds/FST primary 유지) — 수동 입력 폐기                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 데이터 source 2개 병행 → 갈래 분기 코드, fallback 부재                                                                                            |
| 2차     | 네이버 단일 primary로 전환 (LCK·MSI·Worlds·FST·EWC·KeSPA·아시안 모두 네이버) + Phase 2 lolesports 코드를 fallback으로 강등                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 비공식 API 단독 의존 우려에서 fallback 보유. 그러나 fallback 자체의 부작용은 미평가 → 4차에서 재검토                                              |
| 3차     | **아시안 게임을 Phase 3 자동화 범위에서 제외** — Step A 정찰에서 `asi_lol` ID는 유효해 보이나 알려진 AG 활동월 데이터 부재 + 4년 주기로 ROI 최저                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 추후 AG 시점(2030?)에 수동 ICS append 또는 동적 추가 메커니즘으로 별도 처리 (Phase 3 외)                                                          |
| **4차** | **lolesports fallback 제거** — 근거 (a) lolesports는 6 대회 중 4 대회만 커버, KeSPA·EWC는 fallback 발동 시 통째 사라짐(반쪽짜리 안전망). (b) UID 네임스페이스 차이(lolesports 숫자 ID vs `naver:` 접두)로 캘린더가 "전체 삭제 + 재추가"로 인식 → 시각적 flapping + 캘린더 단위 기본 알림 재발화 가능. (참고: ICS `METHOD:PUBLISH` 구독은 RFC 5546상 read-only라 이벤트별 메모·알림 자체가 안 됨 → 그 부분 손실은 처음부터 없음, 초기 주장에서 정정). **안전망이 아니라 트랩**. 네이버 fail은 워크플로 실패로 정직히 알리고 GitHub Pages가 마지막 성공본 서빙 → 신규 매치만 12h lag, 기존 매치는 손상 X | 네이버 영구 차단 시 서비스 중단 위험은 fallback이 해결 못 함 (lolesports는 KeSPA·EWC 영구 부재로 반쪽짜리). 그 시점엔 새 데이터 소스 정찰이 정답. |

### 2차 전환 근거 (5가지 — 4차에서 4·5번 무효화)

1. **한국어 자연 풍부**: 네이버 응답이 처음부터 한국어 (`homeTeam.name` 등) — lolesports의 `hl=ko-KR` + 영문→한국어 매핑 우회 가능
2. **신규 대회 자연 통합**: KeSPA·EWC가 lolesports 미커버라 어차피 네이버 도입 필요 → 한 번에 단일화 (아시안 게임은 별도 — 3차 결정 참조)
3. **`topLeagueId=lck` 검증 완료**: 네이버가 LCK 데이터 제공 확인 (2026-05-13, 5월 50+ 매치 응답)
4. ~~**fallback 안전망**~~: 4차 결정으로 무효화. (a) lolesports가 6 대회 중 4 대회만 커버라 KeSPA·EWC가 통째 누락(반쪽짜리), (b) UID 네임스페이스 차이로 캘린더가 "삭제 + 재추가"로 인식해 flapping·알림 재발화 위험 → 안전망 효과가 사실상 마이너스
5. ~~**Phase 2 sunk cost 회피**~~: 4차 결정으로 무효화. sunk cost는 의사결정 근거가 아님 (해당 fallacy). lolesports 코드는 검증 완료 후 정직히 제거.

### 발견 (1차 결정 시 동기)

EWC·KeSPA Cup이 싱글/더블 엘리미네이션 토너먼트 → 매 경기 후 다음 대진 동적 결정. 수동 입력 비용 가정(1.5h/년)이 실제 3-5h + 매 경기 후 입력 압박. **자동화 가치 5-10배 ↑**. 이후 정찰 과정에서 네이버가 LCK까지 커버한다는 사실 발견 → 2차 결정으로 단일 전환.

### 후보 비교 (모두 탈락 → 네이버 채택)

| 후보                            | 탈락 사유                                 |
| ------------------------------- | ----------------------------------------- |
| lolesports API 확장             | 41개 리그 전수 확인, EWC·KeSPA 미커버     |
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

검증된 `topLeagueId` (Phase 3 Step A 정찰 2026-05-13 완료):

| 대회        | topLeagueId          | 검증 활동월       | matches / teams  |
| ----------- | -------------------- | ----------------- | ---------------- |
| LCK         | `lck`                | 2026-05           | 46 / 10          |
| KeSPA Cup   | `lol_kespa`          | 2025-12           | 35 / 14          |
| EWC         | `ewc_lol`            | 2025-07 / 2026-05 | 18 / 12, 14 / 10 |
| MSI         | `msi`                | 2024-05 / 2025-07 | 24 / 12, 14 / 8  |
| Worlds      | `world_championship` | 2024-10 / 2025-10 | 39 / 16, 38 / 17 |
| First Stand | `first_stand_lol`    | 2025-03 / 2026-03 | 13 / 5, 13 / 8   |

> ID 탐색 방법: `https://game.naver.com/esports` HTML 안의 `topLeagueId=...` 패턴을 scrape (추측 X). 처음 추정 4개(`lol_msi`, `lol_worlds`, `lol_first_stand`, `lol_asian_games`)는 모두 invalid → 실제 ID는 위 표대로.

**아시안 게임 Phase 3 범위 제외 (2026-05-13 결정)**: HTML에 `asi_lol` ID는 있지만 알려진 2022 항저우 AG 활동월에서도 데이터 부재. 4년 주기라 자동화 ROI 최저 + 무엇이 정확히 매핑되는지 불확실. 추후 (다음 AG 시점) 수동 ICS append 또는 별도 동적 추가 메커니즘으로 처리 — Phase 3 자동화 외 별도 고민.

**invalid ID 시그널**: 네이버 API는 invalid topLeagueId·미래 빈 월 모두 200 + `content.matches=[]` + `content.teams=[]`로 응답 (HTTP 코드로 구별 불가). ID 유효성은 **알려진 활동월 호출 → `teams.length > 0` 확인**으로만 판정 가능.

응답은 lolesports DTO와 1:1 매핑 가능 — `gameId` → UID(접두 `naver:` 권장으로 충돌 회피), `startDate`(epoch ms KST) → DTSTART, `title`(한글) → stage, `homeTeam`/`awayTeam.{name, nameEng, nameEngAcronym}` → 팀.

### 비영리 공개 가능 — 정적 `.ics` 구조 덕

사용자 수 ≠ 네이버 트래픽. 사용자 1명이든 10000명이든 네이버 호출은 매일 2회 고정 (사용자는 GitHub Pages에서 `.ics`만 받음). 비영리 + 비상업 + 분당 1회 미만 + 출처 명시 → 실무적 위험 거의 0.

### Phase 3 구현 시 갖출 모범사례 (7항목)

기본 5: ① User-Agent 명확히 (`lck-schedule-sync/X.X (github URL; 연락처)`) ② 매일 2회 cron 유지 ③ GitHub Actions 24h 캐싱 ④ **네이버 fetch 실패 시 워크플로 실패로 정직히 알림** — GitHub Pages는 마지막 성공본 서빙으로 사용자 캘린더 무손상, 신규 매치만 다음 cron까지 lag ⑤ README에 비공식 API 사용 명시 ⑥ 데이터 출처(네이버 esports) 링크 제공. 비영리 공개 추가: ⑦ MIT 라이센스 (README에 이미 있음) + Takedown 채널 명시 (GitHub issue + 군주 이메일, 네이버 요청 시 즉시 중단 의사, SLA 24h).

(4차 결정 후 갱신) ④는 fallback 패턴이 아닌 **fail-loud + 정적 산출물의 자연스러운 안전망** 활용. ICS lifecycle 상 두 소스 간 UID 네임스페이스 전환은 캘린더에 "전체 삭제 + 재추가"로 보여 사용자 메모·알림을 손상시키므로, fallback보다 워크플로 실패가 정직하고 안전하다.

### Phase 3 lookback window 결정 (2026-05-13)

**최종 결정**: `MONTHS_BEFORE = 3`, `MONTHS_AHEAD = 2` (과거 3 + 현재 + 미래 1 = 5 month rolling). T1 ~25 매치.

**ICS lifecycle 메커니즘 (정확히 이해해야 함)**:

| 갱신 시 새 ICS에서 | 캘린더 동작  |
| ------------------ | ------------ |
| 새 UID 등장        | ➕ 추가      |
| 기존 UID 유지      | ✏️ 정보 갱신 |
| 기존 UID 사라짐    | ❌ **삭제**  |

→ Google·Apple·Outlook 모든 표준 캘린더. 즉 **ICS에 과거 매치 UID가 안 들어가면 캘린더에서 자동 삭제**. 누적이냐 rolling이냐는 **우리가 fetch 윈도우로 결정**.

**결정 진화 (5차 — 같은 날 모두)**:

| 시점            | 시도                               | T1 매치 | 결과 / 교훈                                                                              |
| --------------- | ---------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| 1차 (초기)      | `MONTHS_AHEAD=6` (미래만 6개월)    | 12      | 캘린더가 "다가오는 매치"만 → 깔끔하지만 과거 매치 사라짐 (Worlds 우승 추억 X)            |
| 2차 (피드백 후) | `MONTHS_BEFORE=24, MONTHS_AHEAD=6` | 138     | "누적식이 맞다" → 추억 보존. 다만 list view·검색 노이즈가 큼                             |
| 3차 (피드백 후) | `MONTHS_BEFORE=12, MONTHS_AHEAD=6` | 80      | "12개월로 줄이자" — 최근 Worlds 1년치만                                                  |
| 4차 (피드백 후) | `MONTHS_BEFORE=12, MONTHS_AHEAD=2` | 80      | "미래 6개월 왜? 어차피 안 나오는데" — 실측 lead time 1개월 (미래 6개월 호출 wasted)      |
| **5차 (최종)**  | `MONTHS_BEFORE=3, MONTHS_AHEAD=2`  | **~25** | "80도 헤비" + T1 ~85 매치/년 실측 → **캘린더 본질=다가오는 일정**, 추억은 본질 외로 분리 |

**T1 연간 매치 실측 (2026-05-13 추정)**:

LCK 3 split (정규+플옵) 56-68 + MSI(참가 시) 8-12 + Worlds(참가 시) 10-16 + EWC 3-6 = **77-102 매치/년**. 평균 ~85.

**Rolling vs 누적 5년 시뮬레이션**:

| 시점    | 5차 (3+2 rolling) | 누적 무한 |
| ------- | ----------------- | --------- |
| 1년 차  | ~25               | ~85       |
| 5년 차  | ~25 (stable)      | ~425      |
| 10년 차 | ~25 (stable)      | ~850      |

→ Rolling은 정착 후 ~25 유지 (시간 무관) / 누적은 매년 85씩 영원히 증가 → 캘린더 본질에 부적합.

**5차 결정의 trade-off**:

- ✅ T1 ~25 매치 = 캘린더 부담 거의 0 (모바일·검색 가벼움)
- ✅ "다가오는 + 직전 split" 본질에 집중
- ✅ 자동 정리 (3개월 rolling) — 무한 증가 X
- ✅ API 부담 최소 — 30 호출/회 × 250ms = **~8초/회** (12+2 21초 대비 1/3)
- ⚠️ Worlds 우승 추억 (10-14개월 전)은 빠르게 사라짐 — "지난 11월 Worlds 결승"은 4-5개월 후 캘린더에서 X
- ⚠️ 시즌 외 기간(6-9월 LCK 휴식기 등)엔 캘린더 사실상 비어 있음

**추억 보존 따로 분리 (Phase 4 검토)**:

캘린더 본질("다가오는 일정")과 자료실 본질("과거 매치 영구 보존")은 도구 분리가 자연스러움. 추후 Phase 4 "응원팀별 다중 발행" 시:

- `t1.ics` — 다가오는 매치 중심 (현재 5차 결정대로 3+2 rolling)
- `t1-archive.ics` — 과거 매치 영구 보존 (별도 구독, 누적식, 옵트인) ← 검토 항목

→ 사용자가 둘 다 구독 / 다가오는 것만 구독 / 자료실만 구독 선택 가능. 단일 캘린더 강제 정책 회피.

**한계**:

- 진정한 누적 X — 4개월+ 전 매치는 사라짐 (5차 결정의 의도된 trade-off)
- 캘린더 색·필터 분기 불가 (한 캘린더 안에 다 묶임)
- "Phase 4 archive ICS" 미구현 — 추억 보존 원하는 사용자는 캘린더 앱에서 이벤트 수동 복사 (별도 캘린더) 임시 운영

### 단계적 공개 전략

A. Phase 3 구현 후 1-2주 본인 검증 → B. 1-2개월 후 가까운 T1 팬 커뮤니티 일부 → C. 안정화 후 일반 공개.

### 미검증 항목

**Step A (정찰)에서 해결됨 (2026-05-13)**:

- ✅ MSI · Worlds · First Stand `topLeagueId` 확정 (위 표) — HTML scrape로 추정 회피
- ✅ 미래 월 조회 동작 — 200 + `content.matches=[]` + `content.teams=[]` (빈 응답, 에러 X)
- ✅ 응답 DTO 안정성 — 시즌·대회 무관 `content.keys = ['matches', 'teams', 'userMatchPushGameIds']` 일관
- ⏭ 아시안 게임 — `asi_lol` ID는 HTML에 있지만 알려진 AG 월에서 데이터 부재 + 4년 주기. **3차 결정으로 Phase 3 자동화 범위에서 제외**, 추후 별도 처리

**Step B (의미 매핑 spot-check, 역사적 비교 — 4차 결정 이후 의미 약화)**:

- ✅ 시작시각: 양쪽 모두 UTC ISO 8601로 도메인 정규화 → **동일**
- ✅ 팀 코드·한국어명: 네이버는 응답에 자연 한국어("kt 롤스터" 등) → 더 정확
- ✅ bestOf · status: 도메인 정규화 후 동일
- ℹ️ **stage 표기 차이** (lolesports와 비교 시 — 4차 결정으로 lolesports 코드 제거되어 더 이상 영향 없음):
  - 네이버 `title` = `정규시즌 1R / 정규시즌 2R / 플레이오프 패자조 3R / Road to EWC 2R` (라운드 단위)
  - lolesports `blockName` = `N주 차 / 플레이오프 / 결승` (주차 단위)
  - 네이버 표기가 더 세밀 — 사용자 SUMMARY는 항상 네이버 형식.

**남은 미검증 (운영 단계에서 해결)**:

- rate limit · IP 차단 · GitHub Actions runner IP에서 네이버 접근 가능 여부 — 운영 중 워크플로 실패 빈도로 모니터링
- 네이버 영구 차단 시 대응 — 그 시점에 새 데이터 소스 정찰 (fallback이 해결 못 함, 4차 결정 근거 참조)

## 참고 문서

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): 데이터 파이프라인 7단계·DTO 매핑·Phase 변경 면적 예측 (시스템 "어떻게 굴러가나" 상세)

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
