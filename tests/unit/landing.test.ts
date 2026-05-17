import { describe, expect, it } from 'vitest';
import { buildIndexHtml } from '../../src/landing.js';
import { LCK_TEAMS } from '../../src/team.js';

const BASE_URL = 'https://ericagong.github.io/lck-schedule-sync';

describe('buildIndexHtml — 정적 HTML 생성 (순수 함수)', () => {
  it('HTML 5 doctype + lang="ko"', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<html lang="ko">');
  });

  it('전달된 팀마다 button 1개씩 생성', () => {
    const html = buildIndexHtml(['T1', 'GEN'], BASE_URL);
    const buttonCount = (html.match(/<button class="team"/g) ?? []).length;
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
    expect(html).toContain('data-name="DRX"'); // KRX 표시명 = DRX
    expect(html).toContain('>T1</button>');
    expect(html).toContain('>젠지</button>');
    expect(html).toContain('>DRX</button>');
  });

  it('LCK 10팀 모두 전달 시 10개 button', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    const buttonCount = (html.match(/<button class="team"/g) ?? []).length;
    expect(buttonCount).toBe(10);
  });

  it('클립보드 복사 JS 포함 (navigator.clipboard.writeText)', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    expect(html).toContain('navigator.clipboard.writeText');
  });

  it('GitHub README 링크 포함 (구독 가이드 위임)', () => {
    const html = buildIndexHtml(LCK_TEAMS, BASE_URL);
    expect(html).toContain('https://github.com/ericagong/lck-schedule-sync');
  });

  it('빈 팀 배열도 유효한 HTML', () => {
    const html = buildIndexHtml([], BASE_URL);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('</html>');
    expect(html).not.toContain('<button class="team"');
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

    it('footer에 GitHub·갱신 이모지', () => {
      expect(html).toContain('⭐ GitHub');
      expect(html).toContain('🔄');
    });
  });
});
