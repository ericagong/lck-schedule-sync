# lck-schedule-sync

> **단 한 경기도 놓치지 않게.** T1 팬을 위한 LCK 일정 자동 동기화 `.ics` 피드.

자기 캘린더 앱(Google · Apple · Outlook)에 URL 한 줄로 구독하면, T1이 출전하는 LCK 매치만 자동으로 흘러들어옵니다. 톡캘린더처럼 카카오톡에 갇히지 않고, **자기가 쓰는 캘린더 안에서** 다른 일정과 충돌까지 시각적으로 확인 가능.

## 차별점

| 비교점    | 톡캘린더·OP.GG 앱      | 이 서비스                             |
| --------- | ---------------------- | ------------------------------------- |
| 앱 종속   | 카카오톡·OP.GG 앱 필수 | **모든 캘린더 호환**                  |
| 필터링    | 리그 단위              | **팀 단위 (T1만, 노이즈 84% 제거)**   |
| 충돌 검사 | 안 됨                  | **자기 캘린더 일정과 시각 통합**      |
| 알림 설정 | 앱이 정한 형식         | **캘린더 앱이 정한 형식 (자기 취향)** |

## 구독 방법

GitHub Pages URL:

```
https://ericagong.github.io/lck-schedule-sync/t1.ics
```

> ⚠️ **"구독(Subscribe)"으로 추가, "Import / 가져오기" 금지**: ICS를 import(가져오기)로 추가하면 일회성 사본으로 들어가 **자동 갱신이 안 되고**, 매 갱신마다 **중복 이벤트가 쌓일 수 있습니다**. 아래 각 캘린더 앱 절차는 모두 URL 구독(`URL로 만들기` · `새로운 캘린더 구독…` · `인터넷에서 구독`)을 씁니다 — 메뉴 이름 정확히 따라 주세요.

### 캘린더 앱별 가능 여부 (한눈에)

| 캘린더                            | 웹·데스크톱             | 모바일 앱        | 비고                                         |
| --------------------------------- | ----------------------- | ---------------- | -------------------------------------------- |
| **Google Calendar**               | ✅ 직접 추가            | ❌ 직접 불가     | 웹에서 추가하면 모바일 앱이 **자동 동기화**  |
| **Apple Calendar**                | ✅ (macOS Calendar.app) | ✅ (iOS 설정 앱) | 양쪽 모두 직접 추가 가능                     |
| **Outlook**                       | ✅ (웹·데스크톱)        | ❌ 직접 불가     | 웹에서 추가하면 Outlook 앱이 **자동 동기화** |
| **삼성 / Naver / 카카오톡캘린더** | ❌ ics 구독 미지원      | ❌               | Google Calendar 경유 권장                    |

> ⚠️ **한국 사용자가 자주 빠지는 함정**: Google Calendar 앱(iOS·Android)에서는 URL로 직접 구독 추가가 불가능합니다. **반드시 데스크톱 웹에서 한 번** 추가해야 같은 계정 모바일 앱에 자동으로 표시됩니다.

### Google Calendar (가장 흔한 경로)

**1단계 — 데스크톱 웹 (필수)**:

1. https://calendar.google.com 접속
2. 좌측 사이드바 `다른 캘린더` 옆 `+` 클릭
3. `URL로 만들기` 선택
4. 위 URL 붙여넣기 → `캘린더 추가`

**2단계 — 모바일 앱 (자동)**:

- iOS · Android의 Google Calendar 앱을 열면 1단계에서 추가한 캘린더가 자동으로 보입니다.
- 보이지 않으면 앱 설정에서 해당 캘린더 토글이 켜져 있는지 확인.

### Apple Calendar

**macOS (Calendar.app)**:

1. `파일` → `새로운 캘린더 구독…`
2. URL 입력 → `구독`
3. 새로고침 주기 선택 (`매시간` 권장)

**iOS · iPadOS**:

- **빠른 길**: Safari에서 위 URL을 직접 열면 "캘린더 구독" 프롬프트가 뜹니다.
- **수동**: `설정` → `캘린더` → `계정` → `계정 추가` → `기타` → `구독 캘린더 추가` → URL 입력.

### Outlook

**웹 / 데스크톱** (`outlook.live.com` 또는 `outlook.office.com`):

1. 좌측 `캘린더 추가` → `인터넷에서 구독`
2. URL 입력 + 이름 지정 (예: "T1 LCK")

**모바일 Outlook 앱**:

- 앱에서는 직접 추가 불가. 위 웹 단계를 거치면 같은 계정 앱에 자동 동기화됩니다.

### 삼성 캘린더 · Naver 캘린더 · 카카오톡캘린더

직접 ics 구독을 지원하지 않습니다. 두 가지 우회:

- **Google Calendar 경유 (권장)**: 위 절차로 Google에 구독 → 안드로이드의 삼성 캘린더는 Google 계정 캘린더와 자동 연동되므로 일정이 그대로 표시됩니다.
- **수동 import**: 한 번만 가져오기. 이후 자동 갱신은 안 됩니다 (비추천).

## 개인화는 자기 캘린더 앱에서 (다정한 서비스 철학)

이 서비스는 **매치 데이터의 정확성과 자동 갱신**만 책임집니다. 알림·색·표시 여부 같은 개인 설정은 **이미 캘린더 앱이 잘 처리**하므로 그쪽에서 한 번만 설정하시면 됩니다.

### 시나리오별 가이드

**경기 시작 N분 전 알림 받기 (Google Calendar)**

1. 좌측 사이드바에서 `T1 LCK 일정` 캘린더 호버 → ⋮ → `설정 및 공유`
2. `이벤트 알림` 섹션에서 원하는 시간 추가 (15분 전, 1시간 전 등)
3. 이 설정은 모든 매치에 자동 적용됩니다

**캘린더 색 변경**

1. 좌측 사이드바에서 캘린더 호버 → ⋮ → 색상 선택

**잠시 알림 끄기**

- 좌측 사이드바에서 캘린더 토글 끄기 → 일정은 보이되 알림은 안 옴

**Apple Calendar로 옮기기**

- 같은 URL을 Apple Calendar에서 구독하면 끝. 동기화는 자동.

## 개발

### 요구사항

- Node.js >= 20
- pnpm 9 (`npm install -g pnpm` 또는 `corepack enable && corepack prepare pnpm@9 --activate`)

### 명령어

```bash
pnpm install
pnpm dev          # 로컬에서 t1.ics 생성 → public/t1.ics
pnpm test         # 단위 테스트
pnpm typecheck    # 타입 체크만
```

### 폴더 구조

```
src/
├── core/types.ts       # Match, Team 도메인 타입
├── team-names.ts       # 영문 → 한국어 매핑
├── lolesports.ts       # API fetcher (유일한 side effect)
├── filter.ts           # filterByTeam (순수)
├── ics-generator.ts    # Match[] → ICS string (순수)
├── pipeline.ts         # 함수 합성
└── main.ts             # 진입점
```

### 설계 원칙

- **SRP**: side effect는 `lolesports.ts`와 `main.ts`에만
- **순수 함수 우선**: filter, ics-generator, pipeline 모두 테스트 가능
- **멱등성**: lolesports `match.id`를 ICS UID로 사용 → 갱신 시 같은 이벤트 갱신
- **개인화는 위임**: VALARM 미포함, 캘린더 앱이 알림 책임

자세한 설계 의사결정·트레이드오프·정찰 결과는 [`CLAUDE.md`](./CLAUDE.md) 참조.

## 갱신 주기

GitHub Actions cron으로 **매일 2회** 자동 갱신:

- 새벽 04:00 KST — 다음날 일정 확보
- 저녁 23:00 KST — 그날 경기 종료 후 토너먼트 대진 즉시 반영

Google Calendar의 ICS 폴링 주기(1~2시간) 때문에 캘린더 반영까지 약간 lag 있음.

## 향후 계획

- **Phase 1~2 (완료)**: LCK 전 단계(정규·플옵·결승·플레이-인) + 국제 대회 (MSI · Worlds · First Stand) 단일 통합 `.ics`
- **Phase 3 (다음)**: EWC · KeSPA Cup · 아시안 게임 (네이버 esports JSON API 자동화, T1 출전 확정 시 반응형)
- **Phase 4**: 응원팀별 다중 `.ics` 발행 (geng.ics 등)

## 라이선스

MIT
