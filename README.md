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

GitHub Pages 배포 후 다음 URL을 캘린더 앱에 구독:

```
https://<username>.github.io/lck-schedule-sync/t1.ics
```

### Google Calendar

1. Google Calendar 좌측 사이드바 `다른 캘린더` 옆 `+` 클릭
2. `URL로 추가` 선택
3. 위 URL 붙여넣기
4. `캘린더 추가` 클릭

### Apple Calendar (iOS/macOS)

1. `파일` → `새로운 캘린더 구독` (macOS) 또는 설정 → 캘린더 → 계정 추가 → 기타 → 구독 캘린더 추가 (iOS)
2. URL 입력 후 구독

### Outlook

1. 좌측 `캘린더 추가` → `인터넷에서 구독`
2. URL 입력

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

자세한 설계 의사결정은 [`plan.md`](./plan.md) 참조.

## 갱신 주기

GitHub Actions cron으로 **매일 2회** 자동 갱신:

- 새벽 04:00 KST — 다음날 일정 확보
- 저녁 23:00 KST — 그날 경기 종료 후 토너먼트 대진 즉시 반영

Google Calendar의 ICS 폴링 주기(1~2시간) 때문에 캘린더 반영까지 약간 lag 있음.

## 향후 계획

- **Phase 1**: LCK 플레이오프 + 결승 + LCK CUP + Road to MSI
- **Phase 2**: MSI + Worlds + First Stand + EWC/KeSPA Cup/아시안 게임 (수동 입력)
- **Phase 3**: 응원팀별 다중 `.ics` 발행 (geng.ics 등) + 단일 통합 출력

## 라이선스

MIT
