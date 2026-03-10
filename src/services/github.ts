const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const SHORT_SHA_LENGTH = 7;
const SHA_RE = /^[0-9a-f]{7,40}$/i;

const COMMON_BRANCH_PREFIX_RE =
  /^(refs\/heads\/)?(feature|feat|fix|bugfix|hotfix|chore|task|issue|refactor|docs|release|test|tests|ci|build|style)[/_-]+/i;

type GitHubCommitResponse = {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    } | null;
  };
  html_url: string;
};

type GitHubBranchWhereHeadResponse = {
  name: string;
};

type GitHubRepoResponse = {
  default_branch?: string | null;
};

export type CommitInfo = {
  sha: string;
  message: string;
  authorName: string | null;
  date: string | null;
  htmlUrl: string;
};

export type ParsedGitHubUrl =
  | {
      kind: 'repo';
      owner: string;
      repo: string;
      branch: string | null;
    }
  | {
      kind: 'commit';
      owner: string;
      repo: string;
      sha: string;
    };

export type BranchInferenceResult = {
  branch: string | null;
  source: 'commit-head' | 'default-branch' | 'none';
  confidence: 'high' | 'medium' | 'none';
  requiresConfirmation: boolean;
  reason: string | null;
};

function buildGitHubHeaders(token?: string): Record<string, string> {
  return buildGitHubHeadersWithScheme(token, 'bearer');
}

function buildGitHubHeadersWithScheme(
  token: string | undefined,
  scheme: 'bearer' | 'token',
): Record<string, string> {
  const trimmedToken = token?.trim();
  const authorizationValue =
    trimmedToken && scheme === 'bearer'
      ? `Bearer ${trimmedToken}`
      : trimmedToken
        ? `token ${trimmedToken}`
        : null;

  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(authorizationValue ? { Authorization: authorizationValue } : {}),
  };
}

async function githubFetch(url: string, token?: string): Promise<Response> {
  if (!token?.trim()) {
    return fetch(url, {
      method: 'GET',
      headers: buildGitHubHeaders(),
    });
  }

  const bearerResponse = await fetch(url, {
    method: 'GET',
    headers: buildGitHubHeadersWithScheme(token, 'bearer'),
  });
  if (bearerResponse.status !== 401) {
    return bearerResponse;
  }

  return fetch(url, {
    method: 'GET',
    headers: buildGitHubHeadersWithScheme(token, 'token'),
  });
}

function toTitleCaseWords(input: string): string {
  return input
    .split(' ')
    .map((word) => {
      if (!word) {
        return '';
      }
      return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

export function shortCommitSha(sha: string | null | undefined): string {
  const trimmed = sha?.trim() ?? '';
  if (!trimmed) {
    return '';
  }

  return trimmed.slice(0, SHORT_SHA_LENGTH);
}

export function formatCommitBadgeLabel(sha: string | null | undefined): string {
  const shortSha = shortCommitSha(sha);
  return shortSha ? `via commit ${shortSha}` : '';
}

export function prettifyBranchName(branch: string): string {
  const trimmed = branch.trim();
  if (!trimmed) {
    return '';
  }

  const withoutPrefix = trimmed.replace(COMMON_BRANCH_PREFIX_RE, '');
  const cleaned = withoutPrefix
    .replace(/[/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  return toTitleCaseWords(cleaned);
}

export function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  if (!GITHUB_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    return null;
  }

  const segments = parsedUrl.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');
  if (!owner || !repo) {
    return null;
  }

  if (segments[2]?.toLowerCase() === 'commit') {
    const sha = segments[3] ?? '';
    if (!SHA_RE.test(sha)) {
      return null;
    }

    return {
      kind: 'commit',
      owner,
      repo,
      sha,
    };
  }

  if (segments[2]?.toLowerCase() === 'tree') {
    const branchPath = segments.slice(3).join('/');
    return {
      kind: 'repo',
      owner,
      repo,
      branch: branchPath ? decodeURIComponent(branchPath) : null,
    };
  }

  return {
    kind: 'repo',
    owner,
    repo,
    branch: null,
  };
}

/**
 * Fetch commit metadata from the GitHub public API (unauthenticated).
 *
 * Rate limit: 60 requests/hour per IP without a token.
 * Returns `null` on any failure (private repo, network error, rate limit, bad SHA).
 */
export async function fetchCommitInfo(
  owner: string,
  repo: string,
  sha: string,
  token?: string,
): Promise<CommitInfo | null> {
  if (!owner || !repo || !sha) {
    return null;
  }

  try {
    const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`;
    const response = await githubFetch(url, token);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubCommitResponse;

    return {
      sha: data.sha,
      message: data.commit.message,
      authorName: data.commit.author?.name ?? null,
      date: data.commit.author?.date ?? null,
      htmlUrl: data.html_url,
    };
  } catch {
    return null;
  }
}

export async function inferBranchFromCommit(
  owner: string,
  repo: string,
  sha: string,
  token?: string,
): Promise<BranchInferenceResult> {
  if (!owner || !repo || !sha) {
    return {
      branch: null,
      source: 'none',
      confidence: 'none',
      requiresConfirmation: true,
      reason: 'Owner, repository, and SHA are required.',
    };
  }

  try {
    const headBranchResponse = await githubFetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}/branches-where-head`,
    );

    if (headBranchResponse.ok) {
      const headBranches = (await headBranchResponse.json()) as GitHubBranchWhereHeadResponse[];
      const matchingBranch = headBranches.find((branch) => branch?.name?.trim())?.name?.trim() ?? null;
      if (matchingBranch) {
        return {
          branch: matchingBranch,
          source: 'commit-head',
          confidence: 'high',
          requiresConfirmation: true,
          reason: 'Branch inferred from commit HEAD mapping.',
        };
      }
    }

    const repoResponse = await githubFetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );

    if (repoResponse.ok) {
      const repoInfo = (await repoResponse.json()) as GitHubRepoResponse;
      const defaultBranch = repoInfo.default_branch?.trim() ?? null;
      if (defaultBranch) {
        return {
          branch: defaultBranch,
          source: 'default-branch',
          confidence: 'medium',
          requiresConfirmation: true,
          reason: 'Branch fallback uses repository default branch.',
        };
      }
    }

    return {
      branch: null,
      source: 'none',
      confidence: 'none',
      requiresConfirmation: true,
      reason: 'No branch could be inferred from the commit.',
    };
  } catch {
    return {
      branch: null,
      source: 'none',
      confidence: 'none',
      requiresConfirmation: true,
      reason: 'GitHub API request failed.',
    };
  }
}

/**
 * Build a GitHub commit URL from owner, repo, and SHA.
 * Returns `null` if any input is missing.
 */
export function buildCommitUrl(
  owner: string | null | undefined,
  repo: string | null | undefined,
  sha: string | null | undefined,
): string | null {
  if (!owner || !repo || !sha) {
    return null;
  }

  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${encodeURIComponent(sha)}`;
}
