import { describe, expect, it } from 'vitest';
import {
  buildPullRequestUrl,
  formatPrBadgeLabel,
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
