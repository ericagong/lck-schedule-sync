import { describe, expect, it } from 'vitest';
import { buildIndexHtml } from '../../src/landing.js';
import { LCK_TEAMS } from '../../src/team.js';

const BASE_URL = 'https://ericagong.github.io/lck-teams-schedule';

describe('buildIndexHtml — 정적 HTML 생성 (순수 함수)', () => {
  it('HTML 5 doctype + lang="ko"', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<html lang="ko">');
  });

  it('전달된 팀마다 button 1개씩 생성', () => {
    const html = buildIndexHtml(['T1', 'GEN'], BASE_URL);
    const buttonCount = (html.match(/<button class="team(?: active)?"/g) ?? []).length;
    expect(buttonCount).toBe(2);
  });

  it('각 팀 button에 정확한 구독 URL (lowercase + .ics)', () => {
    const html = buildIndexHtml(['T1', 'KRX'], BASE_URL);
    expect(html).toContain(`data-url="${BASE_URL}/t1.ics"`);
    expect(html).toContain(`data-url="${BASE_URL}/krx.ics"`);
  });

  it('각 팀 button에 한국어 표시명 (data-name + 본문)', () => {
    const html = buildIndexHtml(['T1', 'GEN', 'KRX'], BASE_URL);
    expect(html).toContain('data-name="T1"');
    expect(html).toContain('data-name="젠지"');
    expect(html).toContain('data-name="KRX"'); // 2026~ 키움증권 후원 — 팀명 KRX
    expect(html).toContain('>T1</button>');
    expect(html).toContain('>젠지</button>');
    expect(html).toContain('>KRX</button>');
  });

  it('LCK 10팀 모두 전달 시 10개 button', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    const buttonCount = (html.match(/<button class="team(?: active)?"/g) ?? []).length;
    expect(buttonCount).toBe(10);
  });

  it('클립보드 복사 JS 포함 (navigator.clipboard.writeText)', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    expect(html).toContain('navigator.clipboard.writeText');
  });

  it('footer에 GitHub repo 링크', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    expect(html).toContain('https://github.com/ericagong/lck-teams-schedule');
  });

  it('빈 팀 배열도 유효한 HTML (결과 박스 숨김)', () => {
    const html = buildIndexHtml([], BASE_URL);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('</html>');
    expect(html).not.toContain('<button class="team');
    // 빈 팀이면 결과 박스도 활성화 안 됨 (#result class="visible" 없음)
    expect(html).toContain('<div id="result"');
    expect(html).not.toContain('<div id="result" class="visible"');
  });

  describe('기본 선택 (첫 팀 — 보통 T1)', () => {
    it('첫 팀 button에 active 클래스', () => {
      const html = buildIndexHtml(['T1', 'GEN', 'HLE'], BASE_URL);
      // 첫 button만 active
      expect(html).toContain('<button class="team active" data-url');
      // active button 정확히 1개 (첫 팀에만)
      const activeMatches = html.match(/<button class="team active"/g) ?? [];
      expect(activeMatches).toHaveLength(1);
    });

    it('첫 팀 URL이 기본 입력값으로 채워짐', () => {
      const html = buildIndexHtml(['T1', 'GEN'], BASE_URL);
      expect(html).toContain(`value="${BASE_URL}/t1.ics"`);
    });

    it('첫 팀 표시명이 selected에 채워짐', () => {
      const html = buildIndexHtml(['T1', 'GEN'], BASE_URL);
      expect(html).toContain('<strong id="selected">T1</strong>');
    });

    it('결과 박스가 기본 visible (페이지 로드 직후 표시)', () => {
      const html = buildIndexHtml(['T1', 'GEN'], BASE_URL);
      expect(html).toContain('<div id="result" class="visible"');
    });

    it('첫 팀이 KRX여도 동일 패턴 (T1 hardcode 아님)', () => {
      const html = buildIndexHtml(['KRX', 'T1'], BASE_URL);
      expect(html).toContain('<strong id="selected">KRX</strong>');
      expect(html).toContain(`value="${BASE_URL}/krx.ics"`);
    });
  });

  it('같은 입력이면 같은 출력 (순수성)', () => {
    const a = buildIndexHtml(LCK_TEAMS, BASE_URL);
    const b = buildIndexHtml(LCK_TEAMS, BASE_URL);
    expect(a).toBe(b);
  });

  describe('HTML escape — 안전한 출력', () => {
    it('baseUrl에 & 가 있으면 escape (data-url 속성 안전)', () => {
      const html = buildIndexHtml(['T1'], 'https://example.com?a=1&b=2');
      // 속성 안에서 & 가 &amp; 로 escape
      expect(html).toContain('data-url="https://example.com?a=1&amp;b=2/t1.ics"');
    });
  });

  describe('이모지 카테고리 (한국 사용자 친화)', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);

    it('h1에 캘린더 이모지', () => {
      expect(html).toMatch(/<h1>📅/);
    });

    it('intro에 게임 이모지', () => {
      expect(html).toContain('🎮');
    });

    it('결과 영역에 링크·복사 이모지', () => {
      expect(html).toContain('🔗');
      expect(html).toContain('📋 복사');
    });

    it('hint에 팁 이모지', () => {
      expect(html).toContain('💡');
    });

    it('가이드 헤더에 이모지', () => {
      expect(html).toContain('📲');
    });

    it('footer에 GitHub·갱신 이모지', () => {
      expect(html).toContain('⭐ GitHub');
      expect(html).toContain('🔄');
    });
  });

  describe('구독·개인화 가이드 (탭 — Google·Apple·Outlook·기타)', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);

    it('탭 4개 (Google·Apple·Outlook·삼성/Naver/카카오)', () => {
      expect(html).toContain('data-target="google"');
      expect(html).toContain('data-target="apple"');
      expect(html).toContain('data-target="outlook"');
      expect(html).toContain('data-target="other"');
    });

    it('Google이 기본 활성 탭', () => {
      expect(html).toMatch(/<button class="tab active" data-target="google"/);
      expect(html).toContain('<article class="panel active" id="google"');
    });

    it('Apple·Outlook·기타는 비활성 panel', () => {
      expect(html).toContain('<article class="panel" id="apple"');
      expect(html).toContain('<article class="panel" id="outlook"');
      expect(html).toContain('<article class="panel" id="other"');
    });

    it('Google 가이드: 데스크톱 웹 단계 + 모바일 앱 자동 동기화 안내', () => {
      expect(html).toContain('calendar.google.com');
      expect(html).toContain('URL로 만들기');
      expect(html).toContain('데스크톱 웹');
    });

    it('Google 가이드: 알림·색 변경 개인화 포함', () => {
      expect(html).toContain('🔔 경기 시작 N분 전 알림');
      expect(html).toContain('🎨 캘린더 색 변경');
    });

    it('Apple 가이드: macOS + iOS 별도 절차', () => {
      expect(html).toContain('macOS');
      expect(html).toContain('Safari');
      expect(html).toContain('새로운 캘린더 구독');
    });

    it('Outlook 가이드: 웹 + 모바일 앱 안내', () => {
      expect(html).toContain('outlook.live.com');
      expect(html).toContain('인터넷에서 구독');
    });

    it('기타 (삼성·Naver·카카오): Google Calendar 경유 권장', () => {
      expect(html).toContain('Google Calendar 경유');
      expect(html).toContain('자동 갱신 안 됨');
    });

    it('탭 전환 JS 포함', () => {
      expect(html).toContain("document.querySelectorAll('.tab')");
      expect(html).toContain('dataset.target');
    });
  });
});
