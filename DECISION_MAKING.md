# 의사결정 기록 (Decision Log)

> 이 프로젝트를 만들면서 내린 결정과 그 _왜_·_대안_·*한계*의 archive.
> 빠른 결론은 [`README.md`](./README.md)에, 시스템 동작은 [`ARCHITECTURE.md`](./ARCHITECTURE.md)에.

각 결정은 **문제 → 대안 → 선택 → 근거 → 한계** 5요소로 정리한다. 결정의 *진화*가 있으면(예: Phase별 차수) 그 흐름도 포함.

## 목차

1. [메커니즘 — ICS 구독 피드](#1-메커니즘--ics-구독-피드)
2. [데이터 소스 — 네이버 esports JSON (Phase 진화의 결정체)](#2-데이터-소스--네이버-esports-json-phase-진화의-결정체)
3. [Lookback Window — 5개월 rolling (5차 진화)](#3-lookback-window--5개월-rolling-5차-진화)
4. [ICS 출력 — METHOD:PUBLISH + UID 멱등성 + UTC 일관 + 매치 메타 풍부화 + 동기화 메타 RFC 정합](#4-ics-출력--methodpublish--uid-멱등성)
5. [도메인 모델 — Match를 narrow waist로](#5-도메인-모델--match를-narrow-waist로)
6. [운영 — fail-loud + 호출 throttling](#6-운영--fail-loud--호출-throttling)
7. [알려진 한계 (Limitations 요약)](#7-알려진-한계-limitations-요약)

---

## 1. 메커니즘 — ICS 구독 피드

### 1.1 왜 ICS 구독 피드인가?

**문제**: T1 팬에게 매치 일정을 자동으로 전달하려면 어떤 채널이 좋은가.

**대안**:

| 대안                          | 비용                         | 사용자 마찰                           |
| ----------------------------- | ---------------------------- | ------------------------------------- |
| Google Calendar API 직접 삽입 | OAuth·Google Workspace 의존  | 우리 측 토큰 관리, 사용자별 권한 동의 |
| 알림 봇 (Discord·Telegram)    | 봇 운영                      | 봇 추가 + 채널 가입                   |
| 별도 웹사이트                 | 호스팅·UI 유지               | 매번 방문                             |
| **ICS 구독 피드**             | **GitHub Pages 정적 (무료)** | **URL 한 줄 구독, 자동 동기화**       |

**선택**: ICS 구독 피드.

**근거**:

1. 사용자는 _이미 쓰는_ 캘린더 안에 일정이 들어오는 게 가장 마찰 적음.
2. 인증·OAuth 없이 단순 HTTP GET. RFC 5545 표준이라 Google/Apple/Outlook 전부 호환.
3. 우리는 정적 파일 하나 발행하면 끝 — 사용자 수 무관 (1명이든 1만 명이든 호출 동일).

**한계**:

- 푸시 X — 사용자 캘린더의 fetch 주기에 lag 의존 (평균 18시간).
- 이벤트별 메모·색·알림 직접 설정 불가 — `METHOD:PUBLISH` 구독은 RFC 5546 read-only.

### 1.2 왜 매일 2회 cron인가?

**문제**: 얼마나 자주 갱신해야 하나?

**대안**: 실시간 webhook / 5분 cron / 1시간 cron / 매일 1회 / **매일 2회 (04:00·23:00 KST)**.

**선택**: 매일 2회 (04:00·23:00 KST).

**근거**:

1. 매치 일정은 _저녁 끝나고 다음 대진 발표_ 패턴. 저녁 23:00에 흡수 → 다음날 04:00에 재확인. 두 번이면 토너먼트 대진도 12시간 안에 따라감.
2. 네이버 비공식 API에 무리한 호출 부담 X (분당 ~0.001회 미만).
3. 사용자 캘린더 fetch 주기(Google 12-24h)가 우리 cron 12h를 받쳐줌 — 더 자주 cron 돌려도 의미 없음.

**한계**:

- 토너먼트 대진이 자정 직후 발표되면 다음날 캘린더에 늦게 표시될 수 있음 (최대 12h lag).
- 매치 시간 변경도 같은 lag.

### 1.3 왜 개인화를 위임하는가? (VALARM 미포함)

**문제**: 사용자별 알림 N분 전·색·소리 등을 어떻게 제공하나?

**대안**: ICS의 `VALARM` 블록에 기본 알림 박기 / **VALARM 없이 캘린더 앱에 위임** / 사용자별 ICS 발행 (필터 옵션).

**선택**: VALARM 미포함, 캘린더 앱에 위임.

**근거**:

1. 캘린더 앱이 *이미 잘 처리*하는 영역. 우리가 한 번 박으면 모든 사용자에게 강제됨.
2. 캘린더 앱별 알림 형식·습관이 달라(소리·진동·팝업) 우리가 정할 일 아님.
3. README에 시나리오 가이드만 제공.

**한계**:

- 사용자가 캘린더 앱에서 "이벤트 알림" 한 번 설정해야 함 (one-time).

### 1.4 왜 사용자 수를 카운팅하지 않는가?

**문제**: 사용자 수를 알면 운영 의사결정에 도움 되는가?

**대안**: pixel tracking / referral header analytics / **카운팅 안 함**.

**선택**: 카운팅 안 함.

**근거**:

1. **프라이버시 존중** — 팬 도구라 사용자 추적 동기 없음.
2. **인프라 단순** — analytics 통합 시 정적 파일 모델 깨짐.
3. **ICS pull 모델 본질상 부정확** — 같은 IP에서 여러 캘린더 앱이 fetch, NAT 뒤 여러 사용자가 한 IP 등 → 정확한 카운팅 자체가 불가능.

**한계**:

- 사용자 호응 측정은 GitHub Star·Issue·PR 등 *간접 시그널*만.

---

## 2. 데이터 소스 — 네이버 esports JSON (Phase 진화의 결정체)

이 프로젝트의 가장 긴 의사결정 흐름. Phase 0~3까지 진화하며 4차에 걸쳐 데이터 소스 전략이 바뀌었다.

### 2.1 후보 비교

| 후보                            | 탈락 / 채택 사유                                                    |
| ------------------------------- | ------------------------------------------------------------------- |
| 수동 입력                       | 토너먼트 대진 동적 변경 → 매 경기 후 입력 압박. 자동화 가치 5-10배. |
| lolesports 비공식 API           | LCK·MSI·Worlds·FST 4 대회만 커버. KeSPA·EWC 미커버.                 |
| Leaguepedia (MediaWiki + Cargo) | rate limit 1회/분 + Cargo 전용 limit.                               |
| Cito · PandaScore               | 무료 한도 작음, EWC 커버 미검증.                                    |
| 나무위키 스크래핑               | 약관·DOM 변경 위험.                                                 |
| RSS·뉴스레터                    | 주 사용자 패턴은 네이버 검색이라 데이터 일관성 X.                   |
| **네이버 esports JSON**         | ✅ **한국어 풍부, 구조 깔끔, 6 대회 모두 검증**                     |

### 2.2 Phase 진화 흐름

| Phase | 데이터 소스                                                               | 핵심 변경             |
| ----- | ------------------------------------------------------------------------- | --------------------- |
| 0     | 수동 입력 (LCK만)                                                         | 초기 PoC              |
| 1     | lolesports 단독 (LCK)                                                     | 자동화 시작           |
| 2     | lolesports 확장 (LCK + MSI + Worlds + FST)                                | 4 leagueId 순차 fetch |
| **3** | **네이버 esports 단일 소스** (LCK + MSI + Worlds + FST + EWC + KeSPA Cup) | 데이터 소스 전환      |

### 2.3 Phase 3 — 4차에 걸친 결정 진화

| 차      | 결정                                                 | 다음 차수로 넘어간 동기                              |
| ------- | ---------------------------------------------------- | ---------------------------------------------------- |
| 1차     | EWC·KeSPA만 네이버로 추가 (lolesports primary 유지)  | 데이터 소스 2개 병행 → 분기 코드                     |
| 2차     | 네이버 단일 primary + lolesports를 fallback으로 강등 | fallback 부작용 미평가                               |
| 3차     | 아시안 게임을 자동화 범위에서 제외                   | 4년 주기·데이터 부재. 다음 AG는 수동 ICS append 검토 |
| **4차** | **lolesports fallback 제거 — 네이버 단일**           | 아래 §2.4 참조                                       |

### 2.4 왜 fallback을 제거했는가? (4차 결정의 핵심)

**문제**: 2차에서 lolesports를 fallback으로 남겼는데, 안전망이 정말 안전한가?

**대안**: fallback 유지 / **fallback 제거, fail-loud**.

**선택**: fallback 제거.

**근거**:

1. **반쪽짜리 안전망**: lolesports는 6 대회 중 4 대회만 커버. fallback 발동 시 KeSPA·EWC 매치가 통째 사라짐 — "안전망이 아니라 트랩".
2. **UID 네임스페이스 차이**: lolesports의 숫자 ID vs 네이버의 `naver:` 접두. fallback 전환 시 캘린더가 "전체 삭제 + 재추가"로 인식 → 시각적 flapping + 캘린더 단위 기본 알림이 같은 매치에 재발화 가능.
3. **`METHOD:PUBLISH` read-only**: 이벤트별 메모·색·알림 자체가 불가. 그러니 fallback의 "사용자 메모 보존" 명분 자체가 없음 (초기 fallback 옹호 근거에서 정정됨).
4. **fail-loud + 정적 산출물의 자연스러운 안전망**: 네이버 fail은 워크플로 실패로 정직히 알리고, GitHub Pages가 마지막 성공본을 서빙 → 사용자 캘린더 무손상. 신규 매치만 다음 cron(최대 12h)까지 lag.

**한계**:

- 네이버 영구 차단 시 서비스 중단 위험 — fallback이 해결 못 함 (lolesports는 KeSPA·EWC 영구 부재). 그 시점엔 새 데이터 소스 정찰이 정답.
- Phase 3 도중 sunk cost (lolesports 코드)를 정직히 폐기 — 의사결정 근거가 아니므로 미보존.

---

## 3. Lookback Window — 5개월 rolling (5차 진화)

### 3.1 문제

ICS는 매번 통째 덮어쓰기 → 새 ICS에 빠진 UID는 캘린더에서 자동 삭제. **얼마만큼의 과거·미래 매치를 ICS에 담을지 = 캘린더에 보이는 범위**.

### 3.2 결정 진화

| 차      | 윈도우 (months before + after) | T1 매치 | 결과 / 다음 차수 동기                                       |
| ------- | ------------------------------ | ------- | ----------------------------------------------------------- |
| 1차     | 0 + 6 (미래만)                 | 12      | 깔끔하지만 과거 매치 사라짐 (Worlds 우승 추억 X)            |
| 2차     | 24 + 6                         | 138     | 추억 보존됐지만 list view·검색 노이즈 큼                    |
| 3차     | 12 + 6                         | 80      | "12개월로 줄이자" — 최근 Worlds 1년치                       |
| 4차     | 12 + 2                         | 80      | "미래 6개월은 어차피 데이터 없어 wasted" (lead time ~1개월) |
| **5차** | **3 + 1**                      | **~25** | **캘린더 본질 = 다가오는 일정**, 추억은 본질 외             |

### 3.3 5차의 trade-off

✅ 캘린더 부담 거의 0 (모바일·검색 가벼움)
✅ 자동 정리 — 4개월+ 전은 rolling으로 사라짐
✅ API 부담 최소 — 30 호출/회 × 500ms ≈ 15초/회

⚠️ Worlds 우승 추억(10-14개월 전)은 빠르게 사라짐
⚠️ 시즌 외 기간(6-9월 LCK 휴식기 등)엔 캘린더 사실상 비어 있음

### 3.4 한계 (Phase 4 검토)

추억 보존은 별도 ICS로 분리 검토 중:

- `t1.ics` (현재): 다가오는 매치 중심, 3+1 rolling
- `t1-archive.ics` (Phase 4): 과거 매치 영구 보존, 누적식, 옵트인

→ 사용자가 둘 다 / 다가오는 것만 / 자료실만 선택 가능. 단일 캘린더 강제 회피.

---

## 4. ICS 출력 — METHOD:PUBLISH + UID 멱등성

### 4.1 핵심 결정 — METHOD:PUBLISH + UID 멱등성

**문제**: ICS 발행 모드를 어떻게 정할지. 사용자 캘린더 안에서 어떻게 매끄럽게 자동 동기화될지.

**대안**: METHOD:REQUEST (RSVP 회신 가능) / METHOD:PUBLISH (read-only 구독) / METHOD:CANCEL 패턴 등.

**선택**: `METHOD:PUBLISH` + UID 멱등성.

**근거**:

1. **PUBLISH = 구독 모델**: RFC 5546상 사용자 캘린더는 이 ICS를 read-only로 취급 → 우리가 정한 일정·표현이 그대로 흘러감.
2. **UID 멱등성** — `naver:${gameId}@lck-teams-schedule` 형식. 같은 매치 = 항상 같은 UID → 캘린더가 in-place 갱신 (중복 없음), 사라진 UID는 자동 삭제.
3. **소스 전환 시 namespace 충돌 회피**: `naver:` 접두로 다른 소스(lolesports의 숫자 ID 등)와 충돌 없음.

**한계**:

- 사용자가 이벤트별 메모·색·알림 직접 설정 불가 (read-only).
- UID가 사라지면 _영구 삭제_ — rolling window가 이를 활용하지만 의도치 않게 fetch 누락 시 매치가 사라질 위험. (단, fail-loud로 워크플로 실패 → 갱신 안 됨 → 사라짐 X. 보호됨.)

### 4.2 DTEND 추정

**문제**: API가 종료 시각을 제공 안 함. ICS는 DTEND 필요.

**선택**: bestOf 기준 추정 — Bo1=+1h, Bo3=+3h, Bo5=+4.5h. `match.ts:Match.endDate` 게터에 응집.

**근거**: 실측 평균 (Bo1 30-50분, Bo3 2-3h, Bo5 3.5-5h). 캘린더에서 "이 시간대 점유"만 표시되면 충분.

**한계**: 실제 매치 길이는 평균과 다를 수 있음. 캘린더 시각 표시는 정확성보다 시야 확보 목적.

### 4.3 ~~의도적 손실 — 스포일러 회피~~ (2026-05-17 폐기 → §4.7 참조)

**~~문제~~**: 네이버 응답에 결과(승자·점수·전적) 필드가 있음. 포함하면 정보 풍부.

**~~선택~~**: 결과 필드 의식적 미사용 (이미 본 매치 다시 봐도 결과 노출 X).

**폐기 이유**: §4.7 참조. 본인 사용자 우선 가치("점수 보고 싶음") + 사용자 분포(거의 단독) 고려. 미래 사용자 늘면 옵트인 분리 가능.

### 4.4 RFC 5545 준수 (결정 X, 규약 X)

- 시각은 UTC compact (`Z` suffix) — 캘린더 앱이 사용자 로컬 timezone으로 자동 변환 (VTIMEZONE 블록 불필요, §4.5 참조)
- CRLF 줄바꿈
- 75바이트 line folding (한국어 UTF-8 3바이트 안전)
- 콤마·세미콜론·줄바꿈 escape

### 4.5 UTC 일관 — TZID + VTIMEZONE 폐기 (2026-05-17)

**문제**: 초기엔 `DTSTART;TZID=Asia/Seoul:20260408T190000` + VTIMEZONE 블록 발행. UTC 시각에 +9h shift 트릭(`toKstParts`) 필요 + ICS에 VTIMEZONE 13줄 추가.

**대안**: TZID 유지 / Floating(timezone 정보 없음) / **UTC compact (`Z` suffix)**.

**선택**: UTC compact 단일 형식.

**근거**:

1. **고정 순간 이벤트는 UTC가 RFC 관행** — LCK 경기는 "지구상 이 순간 송출"이 본질. TZID는 DST 있거나 "현지 시각 고정"이 본질일 때 쓰는 특수 케이스. 한국은 1988년 이후 DST 없어 한국 사용자에겐 두 표현이 100% 동일 결과.
2. **해외 한국 팬 친화** — UTC는 사용자 캘린더가 자기 timezone으로 자동 변환 (LA → PST, 베를린 → CET). TZID 유지 시 한국시간 그대로 표기되어 사용자가 직접 시차 계산.
3. **코드 단순화** — VTIMEZONE 블록·X-WR-TIMEZONE 헤더·KST 변환 트릭 모두 제거 (~40줄 감소).

**한계**: 없음 (기능 동등 + 코드 더 단순).

### 4.6 ~~DTSTAMP 안정화 — `match.startDate` 사용~~ (2026-05-17, **2026-05-18 부분 폐기 → §4.8 참조**)

> **갱신 (2026-05-18)**: 본 결정 부분 폐기. SEQUENCE/LAST-MODIFIED 도입(§4.8)으로 DTSTAMP는 RFC §3.8.7.2 정의대로 `now` 환원. 본래 목표("Outlook 노이즈 0")는 SEQUENCE가 안정 신호 역할을 맡아 그대로 달성 — 수단이 더 정확해진 것. 의사결정 진화는 §4.8 참조.

**문제**: 초기엔 `DTSTAMP = new Date()` (발행 순간). cron 12h마다 같은 매치가 다른 DTSTAMP를 가짐 → 일부 캘린더(특히 Outlook)가 "업데이트됨"으로 인식해 알림·배지 노이즈.

**대안**: 발행 시각 유지 / **`match.startDate` 사용** / 콘텐츠 해시 / 고정 epoch.

**선택**: `match.startDate` — 매치별 고유 + 영구 안정.

**근거**:

1. **노이즈 회피** — 같은 매치는 항상 같은 DTSTAMP → 캘린더 변경 감지 안 됨.
2. **UID 멱등성 패턴과 일관** — `UID=naver:gameId`처럼 두 metadata 축 모두 안정값.
3. **부수 효과** — `generateIcs(matches, { calendarName, now? })`에서 `now` 인자 사라짐 → 진정한 결정론적 순수 함수. 테스트도 FIXED_NOW 주입 불필요.

**한계 (사후 인지, 2026-05-18)**:

- RFC §3.8.7.2 의미론과 살짝 벗어남 (DTSTAMP는 원래 "iCalendar 생성 시각"). 당시엔 "실용적으로 무해"로 판단.
- **숨은 부작용**: SEQUENCE/LAST-MODIFIED가 부재한 상태에서 DTSTAMP까지 안정값이라 **변경 신호가 0**. Google 캘린더 구독자가 매치 콘텐츠 변경(점수 추가 등)을 반영받지 못하는 문제 발생. → §4.8에서 SEQUENCE 도입으로 분리·해결.

### 4.7 매치 메타 풍부화 — 점수·VOD·치지직·LOCATION·BoN 한국어 (2026-05-17)

**문제**: 캘린더 이벤트가 매치업·대회·BoN·중계 URL 4줄밖에 안 됨. 네이버 응답엔 점수·승자·경기장·치지직 채널·다시보기 ID 등 풍부한 메타가 있는데 미사용.

**대안**:

- **a. 본 결정 §4.3 (스포일러 회피) 유지 + 옵트인 분리** (`t1-with-results.ics` 별도 발행)
- **b. §4.3 폐기 + 모든 ICS에 메타 통합**
- **c. 현 상태 유지** (변경 없음)

**선택**: **b** — §4.3 폐기 + 모든 ICS에 점수 + 메타 통합. SUMMARY는 짧게 유지(`Bo3`), DESCRIPTION에 풍부한 정보.

**근거**:

1. **사용자 분포 — 거의 단독**: 단계적 공개 중. "다른 사용자 보호" 명분 약함. 본인 우선 가치 ("점수 보고 싶음") 직접적 실현.
2. **옵트인 분리 비용**: 새 ICS 파일·main 로직 분기·landing 옵션 분기 → 과잉설계. YAGNI.
3. **상태별 분기**로 노이즈 최소화:
   - `scheduled` (예정): 라이브 링크 (치지직 + lolesports)
   - `completed` (종료): 점수 + 다시보기 (라이브 무용)
   - `canceled` (취소): 위치만
4. **SUMMARY는 짧게 유지** (`Bo3`) — 캘린더 list view 가독성. DESCRIPTION만 한국어 풀이(`3판 2선승제`).
5. **LOCATION 별도 필드** — 캘린더 앱 지도 연동 (Google Calendar는 LOCATION 클릭 시 Google Maps).
6. **미래 옵트인 분리 가능**: 사용자 신호 들어오면 그때 `{팀}-no-results.ics` 추가 (현재는 YAGNI).

**구현 — Match 도메인 게터 응집**:

- `Match.score`, `Match.stadium`, `Match.chzzkChannelId`, `Match.replayVideoId` — 네이버에서 추출
- 게터: `scoreLabel` (점수 한 줄), `bestOfLabel` (한국어), `location` (=stadium), `chzzkLiveUrl`, `vodUrl`, `streamUrl` (lolesports)
- `description` 게터가 status별로 라인 조립 — `ics.ts`는 형식화만 (SRP 유지)

**한계**:

- **스포일러 위험**: 결과 보고 싶지 않은 사용자엔 부담. 미래 사용자 늘면 옵트인 분리로 대응.
- **데이터 의존**: stadium·chzzkChannelId·replayVideoId 모두 네이버 optional 필드 → 누락 시 해당 행만 생략 (조건부 렌더).
- **이모지 사용**: 가독성 ↑ vs 일부 텍스트 환경(터미널·일부 캘린더 메타뷰)에서 깨질 가능성. trade-off로 가독성 우선.
- **YouTube 미포함**: 매치별 정확 URL 자동 생성 불가 → 치지직 다시보기만 (정확한 ID 있음).

### 4.8 동기화 메타 RFC 정합 — SEQUENCE/LAST-MODIFIED/CREATED/X-CONTENT-HASH 도입 (2026-05-18)

**문제**: 사용자 보고 — Google 캘린더 구독자가 ICS 재발행 후에도 매치 콘텐츠 변경(점수 추가·VOD URL 추가 등) 반영 안 받음. 진단: UID 멱등 ✅ + DTSTAMP 안정값(§4.6) ✅ + SEQUENCE 부재 ❌ + LAST-MODIFIED 부재 ❌ → 클라이언트가 ICS fetch해도 "모든 메타 동일"로 판단해 콘텐츠 diff 무시. §4.6의 DTSTAMP 안정화 결정이 Outlook noise는 0으로 만들었으나 **진짜 변경 신호까지 0으로 만든 의도치 않은 부작용**.

**대안**:

- a. **DTSTAMP만 `now` 환원** — 최소 변경. 단 클라이언트별 동작이 비공개라 "DTSTAMP만 보고 콘텐츠 diff 트리거"가 보장 안 됨. Outlook noise 재발 위험.
- b. **상태 기반 결정론적 SEQUENCE** (`scheduled=0, canceled=1, completed=2` 같은 deterministic 매핑) — 상태 전이만 잡고 점수 정정 같은 동일 상태 내 변경 못 잡음. RFC 정합도 70%.
- c. **이전 발행분 read + diff** — RFC 정합 100%. 구현 복잡도 ↑. ← **선택**

**선택**: **c — 이전 발행분 X-CONTENT-HASH read + 매치별 diff**. DTSTAMP는 RFC §3.8.7.2 정의대로 `now` 환원, SEQUENCE/LAST-MODIFIED는 콘텐츠 변경 시에만 갱신.

**근거**:

1. **RFC 5546 (iTIP) §2.1.4 정합**: SEQUENCE는 "의미 있는 변경"의 정식 신호. 클라이언트가 RFC 준수하면 SEQUENCE 비교로 in-place 갱신 결정. DTSTAMP만 변동시키는 건 "재발행" 신호일 뿐 "콘텐츠 변경" 신호가 아님 (옵션 a 약점).
2. **§4.6의 본래 목표 보존**: Outlook noise 0(콘텐츠 동일 시 클라이언트가 "업데이트됨" false positive 안 일으킴)이 §4.6의 동기였음. SEQUENCE가 안정값(콘텐츠 동일=같은 값)이라 그 역할을 정확히 인계받음. 수단(DTSTAMP 안정화) 폐기, 목표(noise 0) 유지.
3. **상태 외 변경도 감지** (옵션 b 한계 회피): 점수 정정(2:0→3:0)·VOD URL 추가·LOCATION 갱신 모두 같은 status 안에서 일어남. content hash 기반은 이 변경도 잡음.
4. **자기 자신 ICS가 상태 저장소**: `X-CONTENT-HASH:{hex}`를 VEVENT 안에 비표준 X-property로 임베드 → 다음 빌드 parser가 read해 이전 hash 복원. 별도 state 파일·DB 불필요.

**구현 — `src/sync-meta.ts` 신규 (순수 함수)**:

```ts
// 콘텐츠 hash — SUMMARY·DESCRIPTION·STATUS·LOCATION·URL·startDate join 후 SHA-256
computeContentHash(match): string

// 이전 발행분 → UID별 {sequence, contentHash, lastModified} map
parsePreviousIcs(text): Map<UID, PreviousEntry>

// 새 매치 + 이전 map → SEQUENCE/LAST-MODIFIED 결정
//   - 신규 UID: sequence=0, lastModified=now
//   - hash 동일: 이전값 유지
//   - hash 다름: sequence+1, lastModified=now
decideSyncMeta(uid, contentHash, previous, now): SyncMeta
```

`src/main.ts` 빌드 시 `fetch(${baseUrl}/{team}.ics)` → `parsePreviousIcs` → 매치별 `decideSyncMeta` → `generateIcs`에 주입. HTTP 실패(404·네트워크 오류) 시 cold start로 fall through (모든 매치 `sequence=0`).

**ICS 출력 변화**:

```ics
BEGIN:VEVENT
UID:naver:115548128962840643@lck-teams-schedule    ← 그대로
DTSTAMP:20260518T090000Z                            ← now (RFC 정의 환원)
CREATED:20260408T100000Z                            ← startDate (deterministic, 신규)
LAST-MODIFIED:20260515T000000Z                      ← 콘텐츠 변경 시각 (신규)
SEQUENCE:3                                          ← 콘텐츠 변경 카운트 (신규)
DTSTART:20260408T100000Z
...
X-CONTENT-HASH:abc123...                            ← 다음 빌드 diff 복원용 (신규)
END:VEVENT
```

**VCALENDAR 헤더 추가 (RFC 5546 + 7986)**:

- `NAME:{name}` (RFC 7986 §5.1) — `X-WR-CALNAME`의 표준 후속. 신·구 클라이언트 모두 발행.
- `REFRESH-INTERVAL;VALUE=DURATION:PT12H` — 새로고침 hint (cron 12h 주기와 정합).
- `X-PUBLISHED-TTL:PT12H` — MS Outlook 호환 (REFRESH-INTERVAL과 동일 값).

**라이브러리 미도입 (ts-ics 등)**:

평가 결과 직접작성 유지:

- 정적 ICS 생성 라이브러리(ts-ics·ics) 모두 **SEQUENCE 자동 관리 X** — 호출자가 결정 후 주입. DB 백엔드 있는 CalDAV 서버(Sabre/DAV·Radicale)만 자동 관리. 본 환경에선 `sync-meta.ts` 로직이 어차피 필요 → 라이브러리 도입으로 줄어들지 않음.
- ts-ics 도입 시 URL-aware folding(이전 PR에서 정착)을 post-process로 재구현 → 두 단계 직렬화로 어색.
- ICS parser도 자체 구현 ~30줄(정규식 기반 필요 필드 추출)로 충분.

**한계 (정직히)**:

- **GitHub Pages 캐시(`Cache-Control: max-age=600`) 사용자 제어 불가**: 캘린더 클라이언트의 자체 throttling(Google 12-24h, Apple 1-3h)이 더 큰 변수이므로 실용적 영향 작음.
- **HTTP GET 실패 시 cold start**: 모든 매치 `sequence=0` 리셋. 매우 드물지만 발생 시 클라이언트는 "재게시처럼" 인식 가능 — UID 그대로라 in-place 갱신은 정상.
- **X-CONTENT-HASH 비표준 property**: 일부 strict parser가 무시할 수 있지만 본 프로젝트가 자기 자신 ICS만 read하므로 영향 0.
- **§4.6 부분 폐기**: 의사결정 진화 기록. 본 변경의 본질은 _목표는 같고 수단이 더 정확해진 것_.
- **점수 정정 같은 cron 사이 다중 변경 정확 추적**: 한 cron 빌드 안에서 hash 비교는 1회. cron 사이에 매치가 두 번 변경되면 SEQUENCE는 1만 증가 (한 변경으로 합쳐짐). RFC 5545 의도("의미 있는 revision"=개정 단위)와 정합.

### 4.9 SUMMARY/DESC 재설계 — bracket short code + 이모지 일관성 (2026-05-18)

**문제**: 기존 SUMMARY `T1 vs BNK 피어엑스 — LCK 플레이오프 2R (Bo5)`는 (a) 한국어 LEAGUE_DISPLAY_NAME(`월드 챔피언십`·`First Stand`·`KeSPA Cup`)이 SUMMARY에 들어가면 모바일 그리드 잘림 위험, (b) DESCRIPTION에 matchup·tournament 중복, (c) 이모지가 일부 행에만 있어 시각 일관성 X, (d) LOCATION 정보가 DESC와 LOCATION 필드 양쪽 중복.

**대안**:

- a. 현 상태 유지 (SUMMARY 길고 DESC self-contained)
- b. matchup만 DESC에서 제거
- c. matchup·tournament 모두 제거 + SUMMARY 재설계 + 이모지 일관 ← **선택**

**선택**: c — SUMMARY를 `[SHORT_CODE] matchup`으로 좁히고 stage·BoN·결과·시청은 DESC, 위치는 LOCATION 필드만.

**근거**:

1. **SUMMARY는 한 줄 식별 본질** — 매치업 + 대회만으로 충분. stage·BoN은 펼침 가치 정보
2. **그리드 잘림 안전** — `LEAGUE_SHORT_CODE` (`LCK / MSI / WORLDS / FST / EWC / KESPA`) 5자 이하 통일
3. **DESC 이모지 일관성** — 모든 행에 이모지 prefix (`🎯 stage / 🎮 BoN / 🏆 결과 / 📺·🎬 시청`)
4. **SRP 명확화** — LOCATION은 LOCATION 필드 단독 책임 (Google·Apple·Outlook 모두 자체 영역 표시)
5. **matchup·tournament 중복 제거** — SUMMARY와 1:1 중복은 펼침 시 노이즈

**구현 — `src/league.ts` + `src/match.ts`**:

```ts
// league.ts 신규
export const LEAGUE_SHORT_CODE: Readonly<Record<League, string>> = {
  LCK: 'LCK', MSI: 'MSI', WORLDS: 'WORLDS',
  FIRST_STAND: 'FST', EWC: 'EWC', KESPA_CUP: 'KESPA',
};

// match.ts
get summary(): string {
  return `[${LEAGUE_SHORT_CODE[this.league]}] ${matchup}`;
}

get description(): string {
  return [stageText(), bestOfText(), scoreText(), streamText()]
    .filter(...).join('\n');
}
```

**미세 결정**:

- **EWC 시각적 중복 허용**: raw title `Road to EWC X`가 league명 포함 → SUMMARY `[EWC]` + DESC `🎯 Road to EWC X`. 한 번뿐인 중복, raw 표기 보존이 우선 (`Road to`는 "EWC 진출 경합"이라는 의미 자체가 정보)
- **stage 부재 시 🎯 행 생략**: stage가 빈 문자열인 케이스 안전 처리
- **LEAGUE_DISPLAY_NAME 유지**: 도메인 표준 한국어명, landing page·다른 용도 보존

**한계**:

- **SUMMARY로 결승 식별 약화**: 정규시즌·결승 SUMMARY 동일 형식. 다만 결승은 Bo5(150분)라 그리드 블록 크기로 자연 강조
- **첫 적용 SEQUENCE 일제 +1**: SUMMARY/DESC 변경으로 X-CONTENT-HASH 일제 변경 → 모든 매치 SEQUENCE+1 1회 발생. §4.8 자연 동작, 1회성 노이즈

---

## 5. 도메인 모델 — Match를 narrow waist로

### 5.1 핵심 원칙 — 의존성 방향

```text
Naver adapter  ──→  Match  ←──  ICS generator
   (입력)            (도메인)        (출력)
```

**문제**: 데이터 소스(네이버)와 출력 형식(ICS)이 서로의 모양을 알면, 어느 한쪽 바뀔 때 양쪽 다 손봐야 함.

**선택**: Match를 narrow waist로 — Naver와 ICS 둘 다 Match에 단방향 의존, Match는 어느 쪽도 모름.

**근거**: 도메인이 차단막 역할 → 한쪽 변경의 ripple이 다른 쪽에 안 닿음.

### 5.2 보상 — Phase 변경 면적 실측

| Phase 변경                                | 예상 면적                                         | 실측 면적 |
| ----------------------------------------- | ------------------------------------------------- | --------- |
| Phase 2: lolesports에 MSI/Worlds/FST 확장 | naver.ts(당시 lolesports.ts) 1 함수 추가, ②~⑥ 0줄 | 그대로    |
| Phase 3: lolesports → 네이버 전환         | naver.ts 통째 새로 짬, ②~⑥ 0줄                    | 그대로    |

원래 예측이 정확. Match가 차단막 역할을 했기 때문.

### 5.3 이 원칙을 지탱하는 보조 결정 (한 줄씩)

- **League/Team 도메인 표준** — Naver의 `topLeagueId`·`nameEngAcronym`이 도메인 경계 밖으로 새지 않음. Naver가 "Gen.G Esports"로 표기해도 도메인은 "젠지"로 표시 (도메인 표준 우선).
- **BestOf 1/3/5 계약** — 외부 입력 검증 (Bo2/Bo7 등 비계약 값은 throw).
- **ICS 표현도 Match에 응집** — `match.summary`·`match.description`·`match.endDate` 등을 Match 게터로 두어 ics.ts가 도메인 정책을 알지 않게 함 (2026-05-17 refactor). 자세한 결정은 §4.5~4.6 참조.

### 5.4 한계

- Match 외 새 도메인 개념 등장 시 확장 필요 — 예: 토너먼트 대진표(승자조/패자조), 팀별 통산 기록.
- Phase 4의 응원팀 다중 발행은 Match 그대로 가능 — `FOCUS_TEAM_CODE`만 분기.

---

## 6. 운영 — fail-loud + 호출 throttling

### 6.1 fail-loud — 재시도 없이 정직히 알람

**문제**: 네이버 fetch 실패 시 어떻게 대응?

**대안**: 자동 재시도 / fallback 소스 / **워크플로 실패로 throw → 알람**.

**선택**: 실패 시 그대로 throw → `process.exit(1)` → GitHub Actions 워크플로 실패.

**근거**:

1. **재시도는 진짜 장애를 가림** — 단발성 429는 다음 cron(12h 후)이 흡수, 지속 장애는 우리가 알아야 함.
2. **GitHub Pages가 자연스러운 안전망** — 마지막 성공본을 계속 서빙. 사용자 캘린더 무손상.
3. **신규 매치만 12h lag** — 캘린더 본질("다가오는 일정") 관점에서 수용 가능.

**한계**: 12h lag 동안 진짜 신규 매치(긴급 변경 등)는 사용자 캘린더에 안 보임. 매치 시작 직전 발표 같은 극단 케이스에서 문제.

### 6.2 호출 사이 500ms 버퍼 — burst-429 회피

**문제**: 6 대회 × 5 month = 30 호출을 ~8초에 burst → 로컬 IP가 429 trigger 가능.

**대안**: 그냥 처리 (장애 알람 의존) / **호출 사이 500ms 버퍼** / token bucket throttle / 재시도 with backoff.

**선택**: 호출 사이 500ms 버퍼 (`isFirstCall` 가드).

**근거**:

1. **사전 예방** — 429가 발생 후 알람 받는 것보다 burst를 안 만드는 게 단순.
2. **500ms는 정중한 간격** — naver에 무리 X (분당 ~120 호출/run, 매일 2회 = 분당 평균 0.16회).
3. **재시도는 도입 X** — fail-loud 원칙과 모순 (§6.1 참조). 단발성 429는 12h 후 cron이 흡수.

**한계**: 총 run 시간 ~15초로 늘어남. 운영 환경(GitHub Actions) 비용 영향 미미.

### 6.3 비영리·비상업 공개 + User-Agent 명시

**문제**: 네이버 비공식 API를 어떤 자세로 사용할 것인가?

**선택**: 비영리·비상업, User-Agent에 본 레포 URL 명시.

**근거**: 분당 호출 미만 + 출처 명시 → 실무적 위험 거의 0. 네이버 측에서 운영자 추적 가능.

**한계**: 네이버가 비공식 API 정책 변경 시 사전 통지 없을 수 있음. 운영 중 모니터링.

### 6.4 Takedown 24h SLA

**문제**: 네이버 또는 제3자가 데이터 사용 중단을 요청한다면?

**선택**: GitHub Issue + 이메일로 24시간 안에 응답 약속.

**근거**: 비영리·비상업 운영 원칙의 일관성. 분쟁 회피보다 빠른 협조가 신뢰 자산.

**한계**: 요청 도착 인지가 24h 이상 걸리면 SLA 위반 가능 (예: 운영자 휴가). 백업 컨택트 미정.

---

## 7. 알려진 한계 (Limitations 요약)

위 결정들의 한계를 한곳에 모은 표.

| 영역         | 한계                            | 보완 / 결정 근거                               |
| ------------ | ------------------------------- | ---------------------------------------------- |
| 데이터 소스  | 네이버 비공식 API 의존          | 영구 차단 시 새 소스 정찰 (사전 fallback 무효) |
| 매치 범위    | TBD 매치 미포함                 | cron이 결정된 매치 빠르게 흡수 (lag ~12h)      |
| 추억 보존    | 4개월+ 전 매치 자동 사라짐      | Phase 4 `t1-archive.ics` 별도 발행 검토 중     |
| 대회 범위    | 아시안 게임 자동화 외           | 4년 주기·데이터 부재. 다음 AG 시점 수동        |
| 사용자 분석  | 사용자 수 정확 카운팅 X         | ICS pull 본질 + 프라이버시                     |
| 캘린더 fetch | Google 24h 고정                 | end-to-end lag 평균 18h, 최대 36h              |
| ICS 형식     | METHOD:PUBLISH read-only        | 이벤트별 메모·색·알림 직접 설정 불가           |
| 운영 lag     | fetch 실패 시 신규 매치 12h lag | fail-loud 원칙 trade-off                       |
