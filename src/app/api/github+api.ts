type GitHubTokenExchangePayload = {
  code?: string;
  redirectUri?: string;
};

function getGitHubOAuthConfig():
  | { clientId: string; clientSecret: string }
  | { error: string } {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return {
      error:
        'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server.',
    };
  }

  return { clientId, clientSecret };
}

async function parsePayload(request: Request): Promise<GitHubTokenExchangePayload> {
  try {
    return (await request.json()) as GitHubTokenExchangePayload;
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = getGitHubOAuthConfig();
  if ('error' in config) {
    return Response.json({ error: config.error }, { status: 501 });
  }

  let payload: GitHubTokenExchangePayload;
  try {
    payload = await parsePayload(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request body.' },
      { status: 400 },
    );
  }

  const code = payload.code?.trim() ?? '';
  if (!code) {
    return Response.json({ error: 'Missing OAuth code.' }, { status: 400 });
  }

  const requestBody: Record<string, string> = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
  };
  const redirectUri = payload.redirectUri?.trim();
  if (redirectUri) {
    requestBody.redirect_uri = redirectUri;
  }

  try {
    const upstream = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const raw = (await upstream.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!upstream.ok || !raw.access_token) {
      const reason = raw.error_description ?? raw.error ?? 'GitHub token exchange failed.';
      return Response.json({ error: reason }, { status: upstream.ok ? 502 : upstream.status });
    }

    return Response.json({
      access_token: raw.access_token,
      token_type: raw.token_type ?? 'bearer',
      scope: raw.scope ?? '',
    });
  } catch (error) {
    console.error('GitHub OAuth exchange failed:', error);
    return Response.json({ error: 'Failed to reach GitHub OAuth endpoint.' }, { status: 502 });
  }
}
