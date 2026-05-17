# lck-schedule-sync

> **단 한 경기도 놓치지 않게.** LCK 팬을 위한 팀별 일정 자동 동기화 `.ics` 피드.

자기 캘린더 앱(Google · Apple · Outlook)에 URL 한 줄로 구독하면 응원하는 LCK 팀이 출전하는 LCK + 국제 대회 매치만 자동으로 흘러들어옵니다. 톡캘린더처럼 카카오톡에 갇히지 않고, **자기가 쓰는 캘린더 안에서** 다른 일정과 충돌까지 시각적으로 확인 가능.

## 차별점 — 왜 만들었나

기존 옵션의 한계:

| 비교점    | 톡캘린더·OP.GG 앱       | 이 서비스                             |
| --------- | ----------------------- | ------------------------------------- |
| 앱 종속   | 카카오톡·OP.GG 앱 필수  | **모든 캘린더 호환**                  |
| 필터링    | 리그 단위만 (10팀 전부) | **팀 단위 (1팀만, 노이즈 84% 제거)**  |
| 충돌 검사 | 안 됨                   | **자기 캘린더 일정과 시각 통합**      |
| 알림 형식 | 앱이 정한 형식          | **캘린더 앱이 정한 형식 (자기 취향)** |

대회 6개 통합: LCK · MSI · Worlds · First Stand · EWC · KeSPA Cup — 팀별 출전 매치만 각 `.ics`에.

## 구독 방법

### 👉 팀 선택 페이지 (가장 쉬움)

<https://ericagong.github.io/lck-schedule-sync/>

응원 팀을 클릭하면 구독 URL이 나옵니다. 복사해서 캘린더 앱에 붙여넣기.

### 직접 URL (LCK 10팀 전체)

| 팀                 | 구독 URL                                                |
| ------------------ | ------------------------------------------------------- |
| T1                 | `https://ericagong.github.io/lck-schedule-sync/t1.ics`  |
| 젠지 (GEN)         | `https://ericagong.github.io/lck-schedule-sync/gen.ics` |
| 한화생명 (HLE)     | `https://ericagong.github.io/lck-schedule-sync/hle.ics` |
| 디플러스 기아 (DK) | `https://ericagong.github.io/lck-schedule-sync/dk.ics`  |
| KT                 | `https://ericagong.github.io/lck-schedule-sync/kt.ics`  |
| DRX (KRX)          | `https://ericagong.github.io/lck-schedule-sync/krx.ics` |
| 한진 브리온 (BRO)  | `https://ericagong.github.io/lck-schedule-sync/bro.ics` |
| BNK 피어엑스 (BFX) | `https://ericagong.github.io/lck-schedule-sync/bfx.ics` |
| 농심 (NS)          | `https://ericagong.github.io/lck-schedule-sync/ns.ics`  |
| DN 수퍼스 (DNS)    | `https://ericagong.github.io/lck-schedule-sync/dns.ics` |

각 ICS는 해당 팀의 출전 매치(LCK 정규시즌·플옵·결승 + MSI·Worlds·FST·EWC·KeSPA 등 T1처럼 출전 시 자연 포함)만 담습니다.

> ⚠️ **"구독(Subscribe)"으로 추가, "Import / 가져오기" 금지**: ICS를 import로 추가하면 일회성 사본이라 **자동 갱신 X**, 매 갱신마다 **중복 이벤트** 쌓일 수 있음. 아래 절차는 모두 URL 구독(`URL로 만들기` · `새로운 캘린더 구독…` · `인터넷에서 구독`)을 씁니다.

### 캘린더 앱별 호환성 (한눈에)

| 캘린더                            | 웹·데스크톱             | 모바일 앱        | 비고                                         |
| --------------------------------- | ----------------------- | ---------------- | -------------------------------------------- |
| **Google Calendar**               | ✅ 직접 추가            | ❌ 직접 불가     | 웹에서 추가하면 모바일 앱이 **자동 동기화**  |
| **Apple Calendar**                | ✅ (macOS Calendar.app) | ✅ (iOS 설정 앱) | 양쪽 모두 직접 추가 가능                     |
| **Outlook**                       | ✅ (웹·데스크톱)        | ❌ 직접 불가     | 웹에서 추가하면 Outlook 앱이 **자동 동기화** |
| **삼성 / Naver / 카카오톡캘린더** | ❌ ics 구독 미지원      | ❌               | Google Calendar 경유 권장                    |

> ⚠️ **한국 사용자가 자주 빠지는 함정**: Google Calendar 앱(iOS·Android)에서는 URL로 직접 구독 추가가 불가능. **반드시 데스크톱 웹에서 한 번** 추가해야 같은 계정 모바일 앱에 자동으로 표시됨.

### Google Calendar (가장 흔한 경로)

**1단계 — 데스크톱 웹 (필수)**:

1. <https://calendar.google.com> 접속
2. 좌측 사이드바 `다른 캘린더` 옆 `+` 클릭
3. `URL로 만들기` 선택
4. 위 URL 붙여넣기 → `캘린더 추가`

**2단계 — 모바일 앱 (자동)**:

- iOS · Android의 Google Calendar 앱을 열면 1단계에서 추가한 캘린더가 자동으로 보임.
- 보이지 않으면 앱 설정에서 해당 캘린더 토글이 켜져 있는지 확인.

### Apple Calendar

**macOS (Calendar.app)**:

1. `파일` → `새로운 캘린더 구독…`
2. URL 입력 → `구독`
3. 새로고침 주기 선택 (`매시간` 권장)

**iOS · iPadOS**:

- **빠른 길**: Safari에서 위 URL을 직접 열면 "캘린더 구독" 프롬프트가 뜸.
- **수동**: `설정` → `캘린더` → `계정` → `계정 추가` → `기타` → `구독 캘린더 추가` → URL 입력.

### Outlook

**웹 / 데스크톱** (`outlook.live.com` 또는 `outlook.office.com`):

1. 좌측 `캘린더 추가` → `인터넷에서 구독`
2. URL 입력 + 이름 지정 (예: "T1 LCK")

**모바일 Outlook 앱**:

- 앱에서는 직접 추가 불가. 위 웹 단계를 거치면 같은 계정 앱에 자동 동기화됨.

### 삼성 캘린더 · Naver 캘린더 · 카카오톡캘린더

직접 ics 구독을 지원하지 않습니다. 두 가지 우회:

- **Google Calendar 경유 (권장)**: 위 절차로 Google에 구독 → 안드로이드의 삼성 캘린더는 Google 계정 캘린더와 자동 연동되므로 일정이 그대로 표시됨.
- **수동 import**: 한 번만 가져오기. 이후 자동 갱신 안 됨 (비추천).

## 개인화는 자기 캘린더 앱에서

이 서비스는 **매치 데이터의 정확성과 자동 갱신**만 책임집니다. 알림·색·표시 여부 같은 개인 설정은 **이미 캘린더 앱이 잘 처리**하므로 그쪽에서 한 번만 설정하시면 됩니다.

**경기 시작 N분 전 알림 받기 (Google Calendar)**:

1. 좌측 사이드바 `T1 경기 일정` 캘린더 호버 → ⋮ → `설정 및 공유`
2. `이벤트 알림` 섹션에서 원하는 시간 추가 (15분 전, 1시간 전 등)
3. 이 설정은 모든 매치에 자동 적용됨

**캘린더 색 변경**: 좌측 사이드바에서 캘린더 호버 → ⋮ → 색상 선택

**잠시 알림 끄기**: 좌측 사이드바에서 캘린더 토글 끄기 → 일정은 보이되 알림은 안 옴

**Apple Calendar로 옮기기**: 같은 URL을 Apple Calendar에서 구독하면 끝. 동기화는 자동.

## 데이터 출처 — 네이버 esports

[네이버 esports](https://game.naver.com/esports)의 JSON API (비공식)를 단일 소스로 사용. 6 대회 통합 fetch:

| 대회                    | 비고                                       |
| ----------------------- | ------------------------------------------ |
| LCK                     | 정규시즌·플레이오프·결승 + Road to국제대회 |
| MSI                     | 팀 출전 시 자동 포함                       |
| Worlds (월드 챔피언십)  | 팀 출전 시 자동 포함                       |
| First Stand             | LCK 대표 출전 시                           |
| EWC (eSports World Cup) | 팀 출전 시 자동 포함                       |
| KeSPA Cup               | 팀 출전 시 자동 포함                       |

> 아시안 게임은 4년 주기·자동화 외 (다음 AG 시점에 수동 또는 별도 메커니즘 검토).

### 갱신 주기

**우리 측 (GitHub Actions cron 매일 2회)**:

- 새벽 04:00 KST — 다음날 일정 확보
- 저녁 23:00 KST — 그날 경기 종료 후 토너먼트 대진 즉시 반영

**사용자 측 (캘린더 앱 fetch 주기)**:

| 앱                  | 기본 fetch 주기 | 사용자 조정            |
| ------------------- | --------------- | ---------------------- |
| **Google Calendar** | 12~24시간       | ❌ 조정 불가           |
| **Apple Calendar**  | 매시간 (기본)   | ✅ 5분 ~ 1주 선택 가능 |
| **Outlook**         | 사용자 설정     | ✅                     |

**end-to-end lag**: 평균 18시간, 최대 36시간 (Google Calendar 24h fetch와 cron 12h가 겹칠 때). 매치 일정 변경 반영도 같은 lag.

### 비영리·비상업 운영 원칙

- 사용자 1명이든 1만 명이든 **네이버 API 호출은 매일 2회 고정** (사용자는 GitHub Pages에서 `.ics`만 받음 — 네이버 트래픽 ≠ 사용자 트래픽)
- User-Agent에 본 레포 URL 포함 (운영자 식별 가능)
- 분당 1회 미만 호출, 출처 명시
- 네이버 측에서 데이터 사용 중단 요청 시 **24시간 안에 응답** (아래 Takedown 참조)

### 실패 시 동작

네이버 API 일시 장애·rate limit 등 발생 시:

- 워크플로 실패 → 운영자가 알림 받음
- **GitHub Pages는 마지막 성공본을 계속 서빙** → 사용자 캘린더의 기존 매치는 그대로 유지
- 다음 cron(최대 12h 후)에서 자연 회복 → 신규 매치만 일시 lag

## 캘린더에 새 매치가 안 보일 때 (트러블슈팅)

Google Calendar는 12-24시간마다 자동 fetch — 우리가 발행한 새 매치가 사용자 캘린더에 도달하는 데 lag이 있습니다. **새 매치가 안 보이면** 다음 순서로 확인:

### 1. 산출물 자체에 매치 있는지 직접 확인 (10초)

ICS 파일을 캘린더 거치지 않고 직접 검증:

```bash
# 터미널 (curl 가능하면 가장 빠름)
curl -s https://ericagong.github.io/lck-schedule-sync/t1.ics | grep -A 1 SUMMARY
```

또는 브라우저 — online ICS viewer에 URL 붙여넣기:

- <https://larrybolt.github.io/online-ics-feed-viewer/>
- <https://icalendar.org/validator.html>

> ⚠️ viewer에 URL 넣을 때는 반드시 **`/팀코드.ics`까지 포함**. 루트 URL(`/`)은 팀 선택 페이지로 가니까 viewer엔 안 됨. 정확한 형식: `https://ericagong.github.io/lck-schedule-sync/t1.ics` (다른 팀은 위 표 참조)

### 2. 산출물에는 있는데 캘린더에 없음 = 캐싱 lag

Google Calendar fetch 캐시가 갱신 안 됨. 즉시 해결 두 가지:

**옵션 A — URL에 dummy query 붙여 재구독 (가장 확실)**:

```text
https://ericagong.github.io/lck-schedule-sync/t1.ics?v=20260517
```

`?v=...` 부분은 우리 서버가 무시 (같은 파일 서빙). Google은 "새 URL"로 인식해 캐시 거치지 않고 즉시 fetch. 새 캘린더로 등록 후 기존 구독은 삭제.

**옵션 B — 기존 구독 그대로 두고 fetch 도래 대기**:

- Google Calendar: 자체 12-24h 주기 도래까지 자동 대기
- Apple Calendar: 환경설정 → 계정 → 새로 고침 주기를 5분으로 임시 변경
- Outlook: 마우스 우클릭 → "지금 동기화"

### 3. 산출물에도 없음 = 데이터 등록 lag 또는 우리 버그

- **데이터 등록 lag**: 네이버가 아직 해당 매치를 등록 안 함. 매일 2회 cron이 자동 흡수 (최대 12h)
- **우리 버그 의심**: [GitHub Issue](https://github.com/ericagong/lck-schedule-sync/issues) 부탁

> 참고: Road to EWC·EWC 본선은 별도 데이터. Road to EWC는 LCK 진출 선발전(`ewc_lol` endpoint)으로 흡수되어 발행됨. EWC 본선은 네이버가 사우디 본선 일정 발표 후 등록.

> 참고: 일부 대회(KeSPA Cup·온라인 대회 등)는 네이버에 치지직 다시보기 데이터가 없어 캘린더 DESCRIPTION에 다시보기 링크가 표시되지 않습니다. 그런 매치의 다시보기는 공식 채널(LCK YouTube·KeSPA Cup 공식 등)에서 직접 검색.

## 표시 범위 — 5개월 rolling

이 ICS는 **과거 3개월 + 현재월 + 미래 1개월** (총 5개월 rolling 윈도우) 매치만 담습니다. 캘린더 본질이 "다가오는 일정 관리"라는 판단 — 자세한 결정 배경은 [`DECISION_MAKING.md`](./DECISION_MAKING.md) 참조.

- T1 약 25 매치 유지 (시간 무관 stable)
- 4개월+ 전 매치는 자동 사라짐 — 표준 ICS lifecycle (UID 사라지면 캘린더가 자동 삭제)
- 과거 매치 영구 보존은 Phase 4 `t1-archive.ics` 별도 발행에서 검토 중

## Takedown · 문의

네이버에서 데이터 사용 중단 요청 시 24시간 안에 응답합니다. 운영 채널:

- **GitHub Issue**: [Issues](https://github.com/ericagong/lck-schedule-sync/issues) (가장 빠름)
- **이메일**: <the.erica.gong@gmail.com>

## 더 읽기

- [`DECISION_MAKING.md`](./DECISION_MAKING.md) — 의사결정 archive (대안·근거·한계)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — 시스템 흐름·DTO·Phase 변경 면적
- [`CLAUDE.md`](./CLAUDE.md) — AI 어시스턴트용 컨텍스트 + 개발 환경·명령

## 라이선스

[MIT](./LICENSE)
