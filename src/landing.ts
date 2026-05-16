/**
 * landing page 생성 — 팀 선택 → 구독 URL 표시 + 클립보드 복사.
 *
 * pure HTML + 인라인 CSS + vanilla JS. 외부 의존성 0.
 * 순수 함수 — 입력(teams, baseUrl)이 같으면 출력 동일.
 */

import { LCK_TEAM_DISPLAY_NAME, type LckTeamCode } from './team.js';

const SUBSCRIBE_GUIDE_URL = 'https://github.com/ericagong/lck-schedule-sync#구독-방법';
const REPO_URL = 'https://github.com/ericagong/lck-schedule-sync';

export function buildIndexHtml(teams: readonly LckTeamCode[], baseUrl: string): string {
  const teamButtons = teams
    .map((code) => {
      const name = LCK_TEAM_DISPLAY_NAME[code];
      const url = `${baseUrl}/${code.toLowerCase()}.ics`;
      return `      <button class="team" data-url="${escapeHtml(url)}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LCK 팀 일정 캘린더 — lck-schedule-sync</title>
    <meta
      name="description"
      content="LCK 팀별 일정을 자기 캘린더 앱에 자동 동기화하는 ICS 구독 피드."
    />
    <style>
      * {
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
      .hint a {
        color: #4285f4;
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
      }
    </style>
  </head>
  <body>
    <h1>LCK 팀 일정 캘린더</h1>
    <p class="intro">
      응원하는 팀을 선택하면 구독 URL이 나타납니다. 자기 캘린더 앱에 붙여넣어 자동 동기화하세요.
    </p>

    <div class="teams" role="list">
${teamButtons}
    </div>

    <div id="result" aria-live="polite">
      <p><strong id="selected"></strong> 구독 URL:</p>
      <div class="url-row">
        <input id="url" readonly aria-label="구독 URL" />
        <button id="copy" type="button">📋 복사</button>
      </div>
      <p class="hint">
        구독 방법(Google Calendar · Apple Calendar 등):
        <a href="${SUBSCRIBE_GUIDE_URL}" target="_blank" rel="noopener">README 참조</a>
      </p>
    </div>

    <div class="footer">
      <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a> · 매일 2회 (04:00 · 23:00
      KST) 자동 갱신 · 비영리·비상업
    </div>

    <script>
      const result = document.getElementById('result');
      const urlInput = document.getElementById('url');
      const selected = document.getElementById('selected');
      const copyBtn = document.getElementById('copy');

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
    </script>
  </body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
