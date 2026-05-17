import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPullRequestUrl,
  formatPrBadgeLabel,
  listPullRequests,
  parseGitHubPullRequestUrl,
  parseGitHubUrl,
} from '@/services/github';

describe('parseGitHubPullRequestUrl', () => {
  it('parses a standard pull request URL', () => {
    expect(parseGitHubPullRequestUrl('https://github.com/owner/repo/pull/123')).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123,
    });
  });

  it('tolerates trailing slashes and segments', () => {
    expect(parseGitHubPullRequestUrl('https://github.com/owner/repo/pull/42/files')).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 42,
    });
  });

  it('rejects URLs that are not pull requests', () => {
    expect(parseGitHubPullRequestUrl('https://github.com/owner/repo')).toBeNull();
    expect(
      parseGitHubPullRequestUrl('https://github.com/owner/repo/commit/abcdef0'),
    ).toBeNull();
  });

  it('rejects non-GitHub hosts and malformed URLs', () => {
    expect(parseGitHubPullRequestUrl('https://gitlab.com/owner/repo/pull/1')).toBeNull();
    expect(parseGitHubPullRequestUrl('not a url')).toBeNull();
    expect(parseGitHubPullRequestUrl('')).toBeNull();
  });

  it('rejects non-positive PR numbers', () => {
    expect(parseGitHubPullRequestUrl('https://github.com/owner/repo/pull/0')).toBeNull();
    expect(parseGitHubPullRequestUrl('https://github.com/owner/repo/pull/abc')).toBeNull();
  });
});

describe('parseGitHubUrl pull kind', () => {
  it('returns kind "pull" with the parsed number', () => {
    expect(parseGitHubUrl('https://github.com/o/r/pull/7')).toEqual({
      kind: 'pull',
      owner: 'o',
      repo: 'r',
      number: 7,
    });
  });
});

describe('buildPullRequestUrl', () => {
  it('returns the canonical PR URL', () => {
    expect(buildPullRequestUrl('owner', 'repo', 5)).toBe('https://github.com/owner/repo/pull/5');
  });

  it('returns null when any input is missing or invalid', () => {
    expect(buildPullRequestUrl(null, 'repo', 5)).toBeNull();
    expect(buildPullRequestUrl('owner', null, 5)).toBeNull();
    expect(buildPullRequestUrl('owner', 'repo', null)).toBeNull();
    expect(buildPullRequestUrl('owner', 'repo', 0)).toBeNull();
  });
});

describe('formatPrBadgeLabel', () => {
  it('formats merged PRs with the merged suffix', () => {
    expect(formatPrBadgeLabel({ number: 12, state: 'closed', merged: true })).toBe(
      'PR #12 · merged',
    );
  });

  it('formats open PRs with the open suffix', () => {
    expect(formatPrBadgeLabel({ number: 7, state: 'open', merged: false })).toBe('PR #7 · open');
  });

  it('formats closed (unmerged) PRs with the closed suffix', () => {
    expect(formatPrBadgeLabel({ number: 9, state: 'closed', merged: false })).toBe(
      'PR #9 · closed',
    );
  });

  it('omits suffix when state is unknown', () => {
    expect(formatPrBadgeLabel({ number: 3 })).toBe('PR #3');
  });

  it('returns an empty string for missing numbers', () => {
    expect(formatPrBadgeLabel({ number: null })).toBe('');
    expect(formatPrBadgeLabel({ number: 0 })).toBe('');
  });
});

describe('listPullRequests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('includes state=open and head when provided', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('[]', { status: 200 });
    });
    (globalThis as any).fetch = fetchMock;

    await listPullRequests('owner', 'repo', {
      state: 'open',
      head: 'owner:branch',
      perPage: 30,
      token: 'token',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/repos/owner/repo/pulls');
    expect(parsed.searchParams.get('state')).toBe('open');
    expect(parsed.searchParams.get('per_page')).toBe('30');
    expect(parsed.searchParams.get('head')).toBe('owner:branch');
  });

  it('includes state=closed when requested', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('[]', { status: 200 });
    });
    (globalThis as any).fetch = fetchMock;

    await listPullRequests('owner', 'repo', { state: 'closed' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('state')).toBe('closed');
  });

  it('returns an empty array without calling fetch when owner/repo missing', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response('[]', { status: 200 });
    });
    (globalThis as any).fetch = fetchMock;

    await expect(listPullRequests('', 'repo', { state: 'open' })).resolves.toEqual([]);
    await expect(listPullRequests('owner', '', { state: 'open' })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
