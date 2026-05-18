/**
 * landing page 생성 — 팀 선택 → 구독 URL 표시 + 클립보드 복사 + 캘린더별 구독·개인화 가이드.
 *
 * pure HTML + 인라인 CSS + vanilla JS. 외부 의존성 0.
 * 순수 함수 — 입력(teams, baseUrl)이 같으면 출력 동일.
 *
 * 구성:
 *   - STYLES / GUIDE_PANEL / SCRIPT: 입력 무관 정적 콘텐츠 (모듈 상수)
 *   - buildTeamButtons / buildResultPanel: 팀 목록·URL에 의존하는 동적 조각
 *   - buildIndexHtml: 위 조각들을 조합한 최종 HTML
 */

import { LCK_TEAM_DISPLAY_NAME, type LckTeamCode } from './team.js';

const REPO_URL = 'https://github.com/ericagong/lck-teams-schedule';

export function buildIndexHtml(teams: readonly LckTeamCode[], baseUrl: string): string {
  const defaultTeam = teams[0];
  const defaultUrl = defaultTeam ? `${baseUrl}/${defaultTeam.toLowerCase()}.ics` : '';
  const defaultName = defaultTeam ? LCK_TEAM_DISPLAY_NAME[defaultTeam] : '';

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LCK 팀 일정 캘린더 — lck-teams-schedule</title>
    <meta
      name="description"
      content="LCK 팀별 일정을 자기 캘린더 앱에 자동 동기화하는 ICS 구독 피드."
    />
    <style>
${STYLES}
    </style>
  </head>
  <body>
    <h1>📅 LCK 팀 일정 캘린더</h1>
    <p class="intro">
      🎮 응원하는 팀을 선택하면 구독 URL이 나타납니다. 자기 캘린더 앱에 붙여넣어 자동
      동기화하세요.
    </p>

    <div class="teams" role="list">
${buildTeamButtons(teams, baseUrl)}
    </div>

${buildResultPanel(defaultTeam, defaultUrl, defaultName)}

    <section class="guide">
      <h2>📲 구독 방법 + 개인화</h2>
${GUIDE_PANEL}
    </section>

    <div class="footer">
      <a href="${REPO_URL}" target="_blank" rel="noopener">⭐ GitHub</a> · 🔄 매일 2회 (04:00 ·
      23:00 KST) 자동 갱신 · 비영리·비상업
    </div>

    <script>
${SCRIPT}
    </script>
  </body>
</html>
`;
}

/* ─────────── 동적 조각 (입력 의존) ─────────── */

function buildTeamButtons(teams: readonly LckTeamCode[], baseUrl: string): string {
  return teams
    .map((code, i) => {
      const name = LCK_TEAM_DISPLAY_NAME[code];
      const url = `${baseUrl}/${code.toLowerCase()}.ics`;
      const activeClass = i === 0 ? ' active' : '';
      return `      <button class="team${activeClass}" data-url="${escapeHtml(url)}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
    })
    .join('\n');
}

function buildResultPanel(
  defaultTeam: LckTeamCode | undefined,
  defaultUrl: string,
  defaultName: string,
): string {
  const visibleClass = defaultTeam ? ' class="visible"' : '';
  return `    <div id="result"${visibleClass} aria-live="polite">
      <p>🔗 <strong id="selected">${escapeHtml(defaultName)}</strong> 구독 URL:</p>
      <div class="url-row">
        <input
          id="url"
          readonly
          aria-label="구독 URL"
          value="${escapeHtml(defaultUrl)}"
        />
        <button id="copy" type="button">📋 복사</button>
      </div>
      <p class="hint">💡 위 URL을 복사하고, 아래 가이드에서 자기 캘린더 앱에 등록하세요.</p>
    </div>`;
}

/* ─────────── 정적 상수 (입력 무관) ─────────── */

const STYLES = `      * {
        box-sizing: border-box;
      }
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
        max-width: 720px;
        margin: 2rem auto;
        padding: 0 1rem;
        color: #1a1a1a;
        line-height: 1.6;
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 0.25rem;
      }
      h2 {
        font-size: 1.15rem;
        margin: 2rem 0 0.5rem;
      }
      .intro {
        color: #555;
        margin-bottom: 1.5rem;
      }
      .teams {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 0.5rem;
        margin-bottom: 1.5rem;
      }
      .team {
        padding: 1rem 0.5rem;
        font-size: 1rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        font-family: inherit;
      }
      .team:hover {
        background: #f5f5f5;
      }
      .team.active {
        background: #e8f0fe;
        border-color: #4285f4;
      }
      #result {
        display: none;
        padding: 1rem;
        background: #f9f9f9;
        border-radius: 8px;
        margin-bottom: 1.5rem;
      }
      #result.visible {
        display: block;
      }
      .url-row {
        display: flex;
        gap: 0.5rem;
        align-items: stretch;
        flex-wrap: wrap;
      }
      #url {
        flex: 1;
        min-width: 0;
        padding: 0.5rem;
        font-family: ui-monospace, monospace;
        font-size: 0.9rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
      }
      #copy {
        padding: 0.5rem 1rem;
        border: 1px solid #4285f4;
        border-radius: 4px;
        background: #4285f4;
        color: #fff;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        white-space: nowrap;
      }
      #copy:active {
        background: #3268cc;
      }
      .hint {
        color: #555;
        font-size: 0.85rem;
        margin: 0.75rem 0 0;
      }
      .guide {
        margin-top: 1rem;
        border-top: 1px solid #eee;
        padding-top: 1.5rem;
      }
      .tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 1px solid #ddd;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .tab {
        padding: 0.5rem 0.9rem;
        font-size: 0.95rem;
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 6px 6px 0 0;
        background: none;
        cursor: pointer;
        color: #555;
        font-family: inherit;
        margin-bottom: -1px;
      }
      .tab:hover {
        background: #f5f5f5;
      }
      .tab.active {
        color: #1a1a1a;
        font-weight: 600;
        background: #fff;
        border-color: #ddd;
        border-bottom-color: #fff;
      }
      .panel {
        display: none;
      }
      .panel.active {
        display: block;
      }
      .panel ol,
      .panel ul {
        margin: 0.5rem 0 1rem;
        padding-left: 1.4rem;
      }
      .panel li {
        margin-bottom: 0.35rem;
      }
      .panel h3 {
        font-size: 1rem;
        margin: 1rem 0 0.4rem;
      }
      .panel a {
        color: #4285f4;
      }
      .panel code {
        background: #f1f3f4;
        padding: 0.1rem 0.35rem;
        border-radius: 3px;
        font-size: 0.85em;
      }
      .panel .warn {
        background: #fff4e5;
        border-left: 3px solid #f5a623;
        padding: 0.5rem 0.75rem;
        margin: 0.75rem 0;
        font-size: 0.9rem;
      }
      .footer {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
        font-size: 0.85rem;
        color: #777;
      }
      .footer a {
        color: #4285f4;
        text-decoration: none;
      }`;

const GUIDE_PANEL = `      <nav class="tabs" role="tablist" aria-label="캘린더 앱 선택">
        <button class="tab active" data-target="google" role="tab" aria-selected="true">
          Google
        </button>
        <button class="tab" data-target="apple" role="tab" aria-selected="false">Apple</button>
        <button class="tab" data-target="outlook" role="tab" aria-selected="false">Outlook</button>
        <button class="tab" data-target="other" role="tab" aria-selected="false">
          삼성·Naver·카카오
        </button>
      </nav>

      <article class="panel active" id="google" role="tabpanel">
        <div class="warn">
          ⚠️ Google Calendar 모바일 앱(iOS·Android)에서는 URL 직접 추가가 불가능. <strong>반드시
          데스크톱 웹에서 한 번</strong> 추가해야 같은 계정 모바일 앱에 자동 표시됩니다.
        </div>

        <h3>1단계 — 데스크톱 웹에서 추가 (필수)</h3>
        <ol>
          <li><a href="https://calendar.google.com" target="_blank" rel="noopener">calendar.google.com</a> 접속</li>
          <li>좌측 사이드바 <code>다른 캘린더</code> 옆 <code>+</code> 클릭</li>
          <li><code>URL로 만들기</code> 선택</li>
          <li>위에서 복사한 URL 붙여넣기 → <code>캘린더 추가</code></li>
        </ol>

        <h3>2단계 — 모바일 앱 (자동)</h3>
        <ul>
          <li>iOS·Android Google Calendar 앱에서 자동 표시</li>
          <li>안 보이면 앱 설정에서 해당 캘린더 토글이 켜져 있는지 확인</li>
        </ul>

        <h3>🔔 경기 시작 N분 전 알림 받기</h3>
        <ol>
          <li>좌측 사이드바 캘린더 호버 → <code>⋮</code> → <code>설정 및 공유</code></li>
          <li><code>이벤트 알림</code> 섹션에서 원하는 시간 추가 (15분 전, 1시간 전 등)</li>
          <li>이 설정은 모든 매치에 자동 적용됨</li>
        </ol>

        <h3>🎨 캘린더 색 변경 / 잠시 알림 끄기</h3>
        <ul>
          <li>색 변경: 사이드바에서 캘린더 호버 → <code>⋮</code> → 색상 선택</li>
          <li>잠시 끄기: 사이드바에서 캘린더 토글 끄기 (일정은 보이되 알림 안 옴)</li>
        </ul>
      </article>

      <article class="panel" id="apple" role="tabpanel">
        <h3>macOS (Calendar.app)</h3>
        <ol>
          <li><code>파일</code> → <code>새로운 캘린더 구독…</code></li>
          <li>URL 입력 → <code>구독</code></li>
          <li>새로고침 주기 선택 (<code>매시간</code> 권장)</li>
        </ol>

        <h3>iOS · iPadOS</h3>
        <ul>
          <li><strong>빠른 길</strong>: Safari에서 위 URL을 직접 열면 "캘린더 구독" 프롬프트가 뜸</li>
          <li><strong>수동</strong>: <code>설정</code> → <code>캘린더</code> → <code>계정</code> → <code>계정 추가</code> → <code>기타</code> → <code>구독 캘린더 추가</code> → URL 입력</li>
        </ul>

        <h3>🔔 알림 / 새로고침 주기</h3>
        <ul>
          <li>알림: 매치 클릭 → 알림 설정 (개별) / 캘린더 단위는 환경설정 → 경고에서</li>
          <li>새로고침 주기: 환경설정 → 계정 → 해당 캘린더 → <code>새로 고침</code> 주기 변경 (5분~1주)</li>
        </ul>
      </article>

      <article class="panel" id="outlook" role="tabpanel">
        <h3>웹·데스크톱</h3>
        <ol>
          <li><a href="https://outlook.live.com" target="_blank" rel="noopener">outlook.live.com</a> 또는 <a href="https://outlook.office.com" target="_blank" rel="noopener">outlook.office.com</a> 접속</li>
          <li>좌측 <code>캘린더 추가</code> → <code>인터넷에서 구독</code></li>
          <li>URL 입력 + 이름 지정 (예: "{팀명} 경기 일정")</li>
        </ol>

        <h3>모바일 Outlook 앱</h3>
        <p>앱에서는 직접 추가 불가. 위 웹 단계를 거치면 같은 계정 앱에 자동 동기화됨.</p>

        <h3>🔔 알림 / 동기화</h3>
        <ul>
          <li>알림: 캘린더 우클릭 → <code>새 알림</code> 또는 이벤트 클릭 → 알림 설정</li>
          <li>강제 동기화: 캘린더 우클릭 → <code>지금 동기화</code></li>
        </ul>
      </article>

      <article class="panel" id="other" role="tabpanel">
        <p>
          삼성 · Naver · 카카오톡 캘린더는 ics 구독을 직접 지원하지 않습니다. 두 가지 우회 방법:
        </p>

        <h3>🌟 Google Calendar 경유 (권장)</h3>
        <ol>
          <li>위 Google 탭 절차로 Google Calendar에 먼저 구독</li>
          <li>안드로이드의 삼성 캘린더는 Google 계정 캘린더와 자동 연동되므로 일정이 그대로 표시됨</li>
        </ol>

        <h3>수동 import (비추천)</h3>
        <p>
          위 URL을 직접 다운로드해 한 번만 import 가능. 다만 <strong>자동 갱신 안 됨</strong> + 매
          갱신마다 중복 이벤트 쌓일 수 있음. 새 매치 추가될 때마다 수동 재import 필요.
        </p>
      </article>`;

const SCRIPT = `      const result = document.getElementById('result');
      const urlInput = document.getElementById('url');
      const selected = document.getElementById('selected');
      const copyBtn = document.getElementById('copy');

      // 팀 선택 → URL 표시 + 클립보드 자동 select
      document.querySelectorAll('.team').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.team').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          urlInput.value = btn.dataset.url;
          selected.textContent = btn.dataset.name;
          result.classList.add('visible');
          urlInput.focus();
          urlInput.select();
        });
      });

      // 클립보드 복사
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(urlInput.value);
          copyBtn.textContent = '✅ 복사됨';
          setTimeout(() => {
            copyBtn.textContent = '📋 복사';
          }, 2000);
        } catch (err) {
          // clipboard API 미지원 환경 (HTTP, 옛 브라우저) — fallback
          urlInput.select();
          document.execCommand('copy');
        }
      });

      // 탭 전환 (Google·Apple·Outlook·기타)
      document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.target;
          document.querySelectorAll('.tab').forEach((t) => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          document.getElementById(target).classList.add('active');
        });
      });`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
