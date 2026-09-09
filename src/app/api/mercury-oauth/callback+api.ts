import { handleMercuryOAuthCallback, MercuryOAuthError } from '@/server/mercury/oauth';

export async function GET(request: Request): Promise<Response> {
  // OAuth providers cannot present the user's Supabase session here. The
  // callback is authenticated by the short-lived, hashed, single-use state
  // record and its server-side PKCE verifier in handleMercuryOAuthCallback.
  try {
    return await handleMercuryOAuthCallback(request);
  } catch (error) {
    const message =
      error instanceof MercuryOAuthError
        ? error.message
        : 'Mercury OAuth callback is unavailable.';
    return Response.json(
      { error: message },
      { status: error instanceof MercuryOAuthError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
