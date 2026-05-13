import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '../../src/core/types.js';
import { fetchWithFallback } from '../../src/data-source.js';

const sampleMatch = (id: string): Match => ({
  id,
  tournament: { displayName: 'LCK', stage: '정규시즌' },
  teamA: { code: 'T1', displayName: 'T1' },
  teamB: { code: 'GEN', displayName: '젠지' },
  startsAt: '2026-05-13T08:00:00.000Z',
  bestOf: 3,
  status: 'scheduled',
});

// console.warn을 mock해서 로그가 stderr로 흐르지 않게 — 테스트 출력 깨끗하게.
let warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('fetchWithFallback — primary 성공 경로', () => {
  it('primary 호출 성공 시 그 결과 반환, source="primary", primaryError=undefined', async () => {
    const primaryMatches = [sampleMatch('naver:g1'), sampleMatch('naver:g2')];
    const primary = vi.fn(() => Promise.resolve(primaryMatches));
    const fallback = vi.fn(() => Promise.resolve([sampleMatch('lol-1')]));

    const result = await fetchWithFallback(primary, fallback, {
      primaryName: 'Naver',
      fallbackName: 'lolesports',
    });

    expect(result.source).toBe('primary');
    expect(result.matches).toBe(primaryMatches);
    expect(result.primaryError).toBeUndefined();
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('fetchWithFallback — fallback 발동 경로', () => {
  it('primary throw 시 fallback 호출, source="fallback", primaryError 보존', async () => {
    const fallbackMatches = [sampleMatch('lol-1'), sampleMatch('lol-2')];
    const primaryErr = new Error('Naver esports API failed: 429 Too Many Requests');
    const primary = vi.fn(() => Promise.reject(primaryErr));
    const fallback = vi.fn(() => Promise.resolve(fallbackMatches));

    const result = await fetchWithFallback(primary, fallback, {
      primaryName: 'Naver',
      fallbackName: 'lolesports',
    });

    expect(result.source).toBe('fallback');
    expect(result.matches).toBe(fallbackMatches);
    expect(result.primaryError).toBe(primaryErr);
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Naver');
    expect(warnSpy.mock.calls[1]?.[0]).toContain('lolesports');
  });

  it('429 같은 burst rate limit도 fallback으로 자연 처리 (실측 시나리오)', async () => {
    const primary = vi.fn(() =>
      Promise.reject(
        new Error(
          'Naver esports API failed: 429 Too Many Requests (topLeagueId=ewc_lol, month=2026-10)',
        ),
      ),
    );
    const fallback = vi.fn(() => Promise.resolve([sampleMatch('lol-1')]));

    const result = await fetchWithFallback(primary, fallback, {
      primaryName: 'Naver',
      fallbackName: 'lolesports',
    });

    expect(result.source).toBe('fallback');
    expect(result.matches).toHaveLength(1);
  });
});

describe('fetchWithFallback — 둘 다 실패 (cron 전체 실패)', () => {
  it('fallback도 throw하면 re-throw → GitHub Actions가 워크플로 실패로 인지', async () => {
    const primaryErr = new Error('Naver down');
    const fallbackErr = new Error('lolesports down');
    const primary = vi.fn(() => Promise.reject(primaryErr));
    const fallback = vi.fn(() => Promise.reject(fallbackErr));

    await expect(
      fetchWithFallback(primary, fallback, {
        primaryName: 'Naver',
        fallbackName: 'lolesports',
      }),
    ).rejects.toBe(fallbackErr);
  });
});

describe('fetchWithFallback — async 정확성', () => {
  it('primary가 reject되기 전엔 fallback 호출 안 됨 (순차 보장)', async () => {
    const order: string[] = [];
    const primary = vi.fn(() => {
      order.push('primary-start');
      return Promise.resolve().then(() => {
        order.push('primary-throw');
        return Promise.reject(new Error('boom'));
      });
    });
    const fallback = vi.fn(() => {
      order.push('fallback');
      return Promise.resolve([sampleMatch('lol-1')]);
    });

    await fetchWithFallback(primary, fallback, {
      primaryName: 'P',
      fallbackName: 'F',
    });

    expect(order).toEqual(['primary-start', 'primary-throw', 'fallback']);
  });
});
