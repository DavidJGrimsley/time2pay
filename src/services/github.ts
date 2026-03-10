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
  name?: string | null;
  full_name?: string | null;
  private?: boolean | null;
  owner?: {
    login?: string | null;
  } | null;
  default_branch?: string | null;
};

type GitHubBranchListResponse = {
  name?: string | null;
};

export type CommitInfo = {
  sha: string;
  message: string;
  authorName: string | null;
  date: string | null;
  htmlUrl: string;
};

export type GitHubRepoSummary = {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string | null;
  isPrivate: boolean;
};

export type GitHubCommitSummary = {
  sha: string;
  shortSha: string;
  message: string;
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
      token,
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
      token,
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

export async function listAuthenticatedRepos(token?: string): Promise<GitHubRepoSummary[]> {
  if (!token?.trim()) {
    return [];
  }

  try {
    const response = await githubFetch(
      `${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
      token,
    );
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as GitHubRepoResponse[];
    return data
      .map((repo) => {
        const owner = repo.owner?.login?.trim() ?? '';
        const repoName = repo.name?.trim() ?? '';
        if (!owner || !repoName) {
          return null;
        }

        return {
          owner,
          repo: repoName,
          fullName: repo.full_name?.trim() || `${owner}/${repoName}`,
          defaultBranch: repo.default_branch?.trim() ?? null,
          isPrivate: Boolean(repo.private),
        } satisfies GitHubRepoSummary;
      })
      .filter((repo): repo is GitHubRepoSummary => repo !== null)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch {
    return [];
  }
}

export async function listRepoBranches(
  owner: string,
  repo: string,
  token?: string,
): Promise<string[]> {
  if (!owner || !repo) {
    return [];
  }

  try {
    const response = await githubFetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
      token,
    );
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as GitHubBranchListResponse[];
    return data
      .map((branch) => branch.name?.trim() ?? '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function listRecentCommits(
  owner: string,
  repo: string,
  input: {
    token?: string;
    branch?: string | null;
    perPage?: number;
  } = {},
): Promise<GitHubCommitSummary[]> {
  if (!owner || !repo) {
    return [];
  }

  const perPage = Math.max(1, Math.min(input.perPage ?? 20, 100));
  const searchParams = new URLSearchParams();
  searchParams.set('per_page', String(perPage));
  if (input.branch?.trim()) {
    searchParams.set('sha', input.branch.trim());
  }

  try {
    const response = await githubFetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${searchParams.toString()}`,
      input.token,
    );
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as GitHubCommitResponse[];
    return data
      .map((commit) => {
        const sha = commit.sha?.trim() ?? '';
        const message = commit.commit?.message?.trim() ?? '';
        if (!sha || !message) {
          return null;
        }

        return {
          sha,
          shortSha: shortCommitSha(sha),
          message: message.split('\n')[0],
          htmlUrl: commit.html_url,
        } satisfies GitHubCommitSummary;
      })
      .filter((commit): commit is GitHubCommitSummary => commit !== null);
  } catch {
    return [];
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
