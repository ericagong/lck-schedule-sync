# Claude Code 컨텍스트

> 이 파일은 Claude Code(또는 Cursor의 AI)가 이 레포에 들어왔을 때 빠르게 맥락을 잡기 위한 안내서입니다.

## 프로젝트 한 줄 요약

T1 팬을 위한 LCK 일정 자동 동기화 `.ics` 피드. 톡캘린더처럼 카카오톡에 갇히지 않고 **모든 캘린더 앱(Google·Apple·Outlook)에서 작동**. 슬로건: "단 한 경기도 놓치지 않게."

## 현재 단계

**Phase 0 완료**. LCK 정규시즌 T1 매치 자동화 동작 중. Phase 1(LCK 플옵 + 결승 + LCK CUP + Road to MSI) 진입 직전.

## 사용자 코딩 선호

- 프론트엔드 개발자, JavaScript/TypeScript
- **SRP**, **순수 함수**, side effect 격리를 중시
- 가독성 좋은 클린 코드 지향
- 빠른 출시 → 시장 피드백 → 반복 (perfection over progression 경계)
- 개념·코드 설명 시 AS-IS vs TO-BE 비교, "1. 어떤 문제 → 2. 어떤 해결 → 3. 장단점·한계" 구조 선호

## 핵심 설계 원칙 (plan.md §6)

1. **SRP**: side effect는 `lolesports.ts` (API fetch) + `main.ts` (파일 I/O) 두 곳만
2. **순수 함수 우선**: `filter.ts`, `ics-generator.ts`, `pipeline.ts`, `team-names.ts`, `parseScheduleResponse` 모두 순수
3. **멱등성**: lolesports `match.id`를 ICS UID로 그대로 사용
4. **시간 처리**: UTC ISO로 보관, 출력 시점에 KST 변환 + TZID 명시
5. **개인화 위임 (§6.1)**: VALARM 미포함. 알림·색·이름은 캘린더 앱에 위임 + README 시나리오 안내
6. **추상화는 두 번째 사례 등장 시**: Phase 0엔 어댑터 인터페이스 X
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

## Phase 로드맵 (plan.md §7)

```
Phase 0 (완료):    LCK 정규시즌 + T1 → t1.ics
Phase 1 (다음):    + LCK 플옵 + 결승 + LCK CUP + Road to MSI (TeamRef union 도입)
Phase 2:           + 국제 + 마이너 묶음 (MSI + Worlds + FST + EWC + KeSPA Cup + 아시안 게임 수동)
Phase 3:           + 팀 확장 (geng.ics 등) + ⭐ 단일 .ics 통합 ("다정한 서비스")
Phase 4 (선택):    운영 강화
```

## 핵심 의사결정 요약 (plan.md §2 참조)

- **메커니즘**: ICS 구독 피드 (Pull, 무인증) — Google API 직접 삽입 X
- **데이터 소스**: lolesports 비공식 API (메인) + 수동 입력 .ics (마이너 대회)
- **EWC·KeSPA Cup·아시안 게임**: lolesports API 미커버 → Phase 2에서 수동 입력
- **스케줄링**: GitHub Actions cron 매일 2회 (04:00, 23:00 KST)
- **개인화**: 캘린더 앱에 위임 (VALARM 미포함)
- **장기 방향 (Phase 3)**: 모든 대회를 단일 `.ics`로 merge (사용자 인지 부담 0)

## 환경 정보

- **Package manager**: pnpm 9 (`packageManager` 필드로 강제)
- **Node**: >= 20 (engine-strict)
- **테스트**: Vitest 1.x
- **API key**: lolesports 비공식 (`0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z` — `lolesports.ts`에 상수)

## 자주 쓰는 명령

```bash
pnpm install
pnpm dev          # public/t1.ics 생성
pnpm test         # 30개 단위 테스트
pnpm typecheck
```

## Phase 1 시작 시 가이드

1. **TeamRef union 도입**: 토너먼트는 TBD 팀이 등장 (예: "Bracket Winner R1")
   ```ts
   type TeamRef = { kind: 'team'; team: Team } | { kind: 'tbd'; sourceDescription: string }; // "1라운드 승자" 등
   ```
2. **Match 타입을 두 형태로 확장**: `KnownMatch` (현재) + `TbdMatch` (Phase 1)
3. **`parseScheduleResponse`에서 TBD 처리**: 현재 코드는 TBD 매치를 제외. Phase 1엔 포함
4. **API 응답 차이 확인 필요**: 플옵·CUP·Road to MSI 매치가 어떻게 noted되는지 (blockName, tournament 등)

## 참고 문서

- `plan.md` (this repo or outputs): 모든 의사결정과 트레이드오프 추적 — **수정 시 부록 B 변경 이력에 추가**
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
