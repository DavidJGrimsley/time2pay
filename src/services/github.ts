const GITHUB_API_BASE = 'https://api.github.com';

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

export type CommitInfo = {
  sha: string;
  message: string;
  authorName: string | null;
  date: string | null;
  htmlUrl: string;
};

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
): Promise<CommitInfo | null> {
  if (!owner || !repo || !sha) {
    return null;
  }

  try {
    const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

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
