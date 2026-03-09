const DEFAULT_MERCURY_BASE_URL = 'https://api.mercury.com/api/v1';
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_ENDPOINT_RULES = [
  { prefix: '/accounts', methods: new Set(['GET']) },
  { prefix: '/ar/invoices', methods: new Set(['GET', 'POST']) },
  { prefix: '/ar/customers', methods: new Set(['GET', 'POST']) },
];

type MercuryProxyPayload = {
  path: string;
  method?: string;
  body?: unknown;
};

function getMercuryApiConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.MERCURY_API_KEY?.trim();
  const baseUrl = process.env.MERCURY_BASE_URL ?? DEFAULT_MERCURY_BASE_URL;

  if (!apiKey) {
    throw new Error('Missing MERCURY_API_KEY environment variable.');
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
  };
}

function normalizeMethod(method?: string): string {
  const resolved = (method ?? 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(resolved)) {
    throw new Error(`Unsupported method: ${resolved}`);
  }

  return resolved;
}

function normalizePath(path: string): string {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error("Invalid path: expected a path starting with '/'.");
  }

  if (path.startsWith('//') || path.includes('://')) {
    throw new Error('Invalid path: absolute URLs are not allowed.');
  }

  return path;
}

function assertAllowedEndpoint(path: string, method: string): void {
  const matchedRule = ALLOWED_ENDPOINT_RULES.find((rule) => path === rule.prefix || path.startsWith(`${rule.prefix}/`) || path.startsWith(`${rule.prefix}?`));

  if (!matchedRule) {
    throw new Error('Path is not allowed by proxy policy.');
  }

  if (!matchedRule.methods.has(method)) {
    throw new Error(`Method ${method} is not allowed for path ${matchedRule.prefix}.`);
  }
}

async function parseRequestPayload(request: Request): Promise<MercuryProxyPayload> {
  try {
    const payload = (await request.json()) as MercuryProxyPayload;
    if (!payload || typeof payload.path !== 'string') {
      throw new Error('Missing required "path" field.');
    }
    return payload;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Request body must be valid JSON.',
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let payload: MercuryProxyPayload;
  let method: string;
  let path: string;
  let baseUrl: string;
  let apiKey: string;

  try {
    payload = await parseRequestPayload(request);
    method = normalizeMethod(payload.method);
    path = normalizePath(payload.path);
    assertAllowedEndpoint(path, method);
    ({ apiKey, baseUrl } = getMercuryApiConfig());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request.' },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : payload.body ? JSON.stringify(payload.body) : undefined,
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
      ? await upstream.json()
      : { message: await upstream.text() };

    return Response.json(data, { status: upstream.status });
  } catch (error) {
    console.error('Mercury proxy request failed:', error);
    return Response.json({ error: 'Failed to reach Mercury API.' }, { status: 502 });
  }
}
