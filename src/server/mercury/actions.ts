import {
  buildMercuryLineItems,
  createMercuryClient,
  findBestCheckingAccount,
  toDayString,
  type MercuryClient,
  type MercuryEnvironment,
  type MercuryInvoicePayload,
  type MercuryRecipient,
  type MercurySendMoneyInput,
  type MercuryTransaction,
} from '@mr.dj2u/mercury';
import { requireAuthUserId } from '@/server/db/_shared/auth';
import { getDecryptedMercuryApiKeyForUser } from '@/server/mercury/credentials';
import { formatMercuryUnauthorizedMessage } from '@/server/mercury/messages';
import {
  getMercuryApiBaseUrl,
  getValidMercuryOAuthAccessForUser,
  MercuryOAuthError,
} from '@/server/mercury/oauth';
import { redactMercuryError, redactMercuryString } from '@/server/mercury/redact';

type MercuryAccessMode = 'local' | 'hosted' | 'tour';

type MercuryActionPayload =
  | { action: 'testConnection' }
  | { action: 'testInvoiceAccess' }
  | { action: 'ensureCustomer'; payload: { name: string; email: string } }
  | { action: 'listAccounts' }
  | { action: 'listTransactions'; payload: { accountId: string; limit?: number } }
  | { action: 'createInvoice'; payload: MercuryInvoicePayload }
  | { action: 'listRecipients' }
  | { action: 'createRecipient'; payload: Record<string, unknown> }
  | { action: 'updateRecipient'; payload: { recipientId: string; input: Record<string, unknown> } }
  | { action: 'sendMoney'; payload: { accountId: string; input: MercurySendMoneyInput } };

type MercuryActionRequest = MercuryActionPayload & {
  accessMode?: MercuryAccessMode;
};

type MercuryResolvedConfig = {
  apiKey: string;
  environment: MercuryEnvironment;
  baseUrl?: string;
};

const OAUTH_READ_ACTIONS = new Set<MercuryActionRequest['action']>([
  'testConnection',
  'listAccounts',
  'listTransactions',
]);

function hasBearerToken(request: Request): boolean {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') && Boolean(authorization.slice('Bearer '.length).trim());
}

async function resolveHostedMercuryConfig(
  request: Request,
  action: MercuryActionRequest['action'],
): Promise<MercuryResolvedConfig> {
  const authUserId = await requireAuthUserId(request);
  if (OAUTH_READ_ACTIONS.has(action)) {
    try {
      const oauthAccess = await getValidMercuryOAuthAccessForUser(authUserId);
      if (oauthAccess) {
        return {
          apiKey: oauthAccess.accessToken,
          environment: oauthAccess.environment,
          baseUrl: getMercuryApiBaseUrl(oauthAccess.environment),
        };
      }
    } catch (error) {
      const isConfigurationError =
        error instanceof MercuryOAuthError &&
        ['oauth_not_configured', 'oauth_configuration_invalid', 'oauth_site_origin_missing'].includes(
          error.code,
        );
      if (!isConfigurationError) {
        throw error;
      }
    }
  }

  const apiKey = await getDecryptedMercuryApiKeyForUser(authUserId);
  if (!apiKey) {
    throw new Error(
      OAUTH_READ_ACTIONS.has(action)
        ? 'Connect Mercury in Settings to use account and transaction reads.'
        : 'Save an advanced Mercury API key in Settings to use this feature.',
    );
  }

  return {
    apiKey,
    environment: 'production',
  };
}

function resolveTourMercuryConfig(): MercuryResolvedConfig {
  const apiKey = process.env.MERCURY_SANDBOX_API_KEY?.trim() ?? '';
  if (!apiKey) {
    throw new Error('Missing MERCURY_SANDBOX_API_KEY environment variable.');
  }

  return {
    apiKey,
    environment: 'sandbox',
    baseUrl:
      process.env.MERCURY_SANDBOX_BASE_URL?.trim() ||
      'https://api-sandbox.mercury.com/api/v1',
  };
}

async function resolveMercuryConfig(
  request: Request,
  payload: MercuryActionRequest,
): Promise<MercuryResolvedConfig> {
  const accessMode = payload.accessMode ?? 'local';

  if (hasBearerToken(request)) {
    return resolveHostedMercuryConfig(request, payload.action);
  }

  if (accessMode === 'hosted') {
    return resolveHostedMercuryConfig(request, payload.action);
  }

  if (accessMode === 'tour') {
    return resolveTourMercuryConfig();
  }

  throw new Error(
    'Mercury production actions require hosted mode with a saved Mercury API key, or tour mode with sandbox credentials.',
  );
}

function getMercuryClient(config: MercuryResolvedConfig): MercuryClient {
  return createMercuryClient({
    apiKey: config.apiKey,
    environment: config.environment,
    baseUrl: config.baseUrl,
  });
}

async function parseRequestPayload(request: Request): Promise<MercuryActionRequest> {
  try {
    const payload = (await request.json()) as MercuryActionRequest;
    if (!payload || typeof payload.action !== 'string') {
      throw new Error('Missing required "action" field.');
    }
    return payload;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Request body must be valid JSON.',
    );
  }
}

async function resolveDestinationAccountId(
  client: MercuryClient,
  explicitAccountId?: string,
): Promise<string> {
  if (explicitAccountId?.trim()) {
    return explicitAccountId.trim();
  }

  const result = await client.accounts.list({ limit: 200 });
  const bestAccount = findBestCheckingAccount(result.items);

  if (!bestAccount?.id) {
    throw new Error('No Mercury destination account found. Connect an account and try again.');
  }

  return bestAccount.id;
}

function assertInvoicePayload(payload: MercuryInvoicePayload | undefined): MercuryInvoicePayload {
  if (!payload) {
    throw new Error('Missing invoice payload.');
  }

  if (!payload.customerName?.trim()) {
    throw new Error('Customer name is required for Mercury invoice creation.');
  }

  if (!payload.customerEmail?.trim()) {
    throw new Error('Customer email is required to create a Mercury invoice.');
  }

  return payload;
}

async function createInvoice(
  client: MercuryClient,
  payload: MercuryInvoicePayload,
): Promise<Response> {
  const resolvedPayload = assertInvoicePayload(payload);
  const destinationAccountId = await resolveDestinationAccountId(
    client,
    resolvedPayload.destinationAccountId,
  );
  const customerId = await client.ar.customers.ensureCustomer({
    name: resolvedPayload.customerName,
    email: resolvedPayload.customerEmail ?? '',
  });

  const invoiceDate = toDayString(resolvedPayload.invoiceDateIso ?? new Date().toISOString());
  const dueDate = toDayString(
    resolvedPayload.dueDateIso ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  );
  const lineItems = buildMercuryLineItems(resolvedPayload);

  const invoice = await client.ar.invoices.create({
    dueDate,
    invoiceDate,
    servicePeriodStartDate: resolvedPayload.servicePeriodStartDate,
    servicePeriodEndDate: resolvedPayload.servicePeriodEndDate,
    customerId,
    ccEmails: resolvedPayload.ccEmails ?? [],
    destinationAccountId,
    creditCardEnabled: resolvedPayload.creditCardEnabled ?? false,
    achDebitEnabled: resolvedPayload.achDebitEnabled ?? true,
    useRealAccountNumber: resolvedPayload.useRealAccountNumber ?? false,
    lineItems,
    sendEmailOption: resolvedPayload.sendEmailOption ?? 'DontSend',
    internalNote: resolvedPayload.description,
    payerMemo: resolvedPayload.description,
  });

  return Response.json({ invoice });
}

async function listAccounts(client: MercuryClient): Promise<Response> {
  const result = await client.accounts.list({ limit: 200 });
  return Response.json({ accounts: result.items });
}

async function listTransactions(
  client: MercuryClient,
  payload: { accountId: string; limit?: number },
): Promise<Response> {
  const accountId = payload?.accountId?.trim();
  if (!accountId) {
    throw new Error('Account ID is required to list transactions.');
  }
  const requestedLimit = Number(payload.limit ?? 25);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 25;
  const result = await client.accounts.listTransactions(accountId, {
    limit,
    order: 'desc',
  });
  return Response.json({ transactions: result.items });
}

async function listRecipients(client: MercuryClient): Promise<Response> {
  const result = await client.recipients.list({ limit: 200 });
  return Response.json({ recipients: result.items as MercuryRecipient[] });
}

async function createRecipient(
  client: MercuryClient,
  payload: Record<string, unknown>,
): Promise<Response> {
  const recipient = await client.recipients.create(payload);
  return Response.json({ recipient: recipient as MercuryRecipient });
}

async function updateRecipient(
  client: MercuryClient,
  payload: { recipientId: string; input: Record<string, unknown> },
): Promise<Response> {
  if (!payload.recipientId?.trim()) {
    throw new Error('Recipient ID is required.');
  }

  const recipient = await client.recipients.update(payload.recipientId.trim(), payload.input);
  return Response.json({ recipient: recipient as MercuryRecipient });
}

function extractRecipientPaymentMethod(recipient: MercuryRecipient | Record<string, unknown>): string | null {
  const directCandidates = [recipient.paymentMethod, recipient.defaultPaymentMethod];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const paymentMethods = recipient.paymentMethods;
  if (!Array.isArray(paymentMethods)) {
    return null;
  }

  for (const method of paymentMethods) {
    if (typeof method === 'string' && method.trim()) {
      return method.trim();
    }

    if (!method || typeof method !== 'object' || Array.isArray(method)) {
      continue;
    }

    const record = method as Record<string, unknown>;
    const nestedCandidates = [record.paymentMethod, record.method, record.type];
    for (const candidate of nestedCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
}

async function sendMoney(
  client: MercuryClient,
  payload: { accountId: string; input: MercurySendMoneyInput },
): Promise<Response> {
  if (!payload.accountId?.trim()) {
    throw new Error('Account ID is required to send money.');
  }

  const input = { ...payload.input };
  const existingPaymentMethod =
    typeof input.paymentMethod === 'string' && input.paymentMethod.trim()
      ? input.paymentMethod.trim()
      : null;

  if (!existingPaymentMethod) {
    const recipientId =
      typeof input.recipientId === 'string' && input.recipientId.trim()
        ? input.recipientId.trim()
        : null;

    if (!recipientId) {
      throw new Error('Recipient and payment method are required to send money.');
    }

    const recipient = await client.recipients.get(recipientId);
    const resolvedPaymentMethod = extractRecipientPaymentMethod(
      recipient as MercuryRecipient | Record<string, unknown>,
    );

    if (!resolvedPaymentMethod) {
      throw new Error(
        'Mercury did not provide a usable payment method for this recipient. Pick or update a recipient with a supported payment method first.',
      );
    }

    input.paymentMethod = resolvedPaymentMethod;
  }

  const transaction = await client.sendMoney.send(payload.accountId.trim(), input);
  return Response.json({ transaction: transaction as MercuryTransaction });
}

async function testConnection(
  client: MercuryClient,
  environment: MercuryEnvironment,
): Promise<Response> {
  await client.accounts.list({ limit: 1 });
  return Response.json({ ok: true, environment });
}

async function testInvoiceAccess(
  client: MercuryClient,
  environment: MercuryEnvironment,
): Promise<Response> {
  await client.ar.invoices.list({ limit: 1 });
  return Response.json({ ok: true, environment });
}

async function ensureCustomer(
  client: MercuryClient,
  payload: { name: string; email: string },
): Promise<Response> {
  if (!payload.name?.trim()) {
    throw new Error('Customer name is required.');
  }

  if (!payload.email?.trim()) {
    throw new Error('Customer email is required.');
  }

  const customerId = await client.ar.customers.ensureCustomer({
    name: payload.name.trim(),
    email: payload.email.trim(),
  });

  return Response.json({ customerId });
}

export async function handleMercuryActionRequest(request: Request): Promise<Response> {
  let payload: MercuryActionRequest;
  let client: MercuryClient;
  let config: MercuryResolvedConfig;

  try {
    payload = await parseRequestPayload(request);
    config = await resolveMercuryConfig(request, payload);
    client = getMercuryClient(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    const status = error instanceof MercuryOAuthError ? error.status : 400;
    return Response.json({ error: redactMercuryString(message) }, { status });
  }

  try {
    switch (payload.action) {
      case 'testConnection':
        return await testConnection(client, config.environment);
      case 'testInvoiceAccess':
        return await testInvoiceAccess(client, config.environment);
      case 'ensureCustomer':
        return await ensureCustomer(client, payload.payload);
      case 'listAccounts':
        return await listAccounts(client);
      case 'listTransactions':
        return await listTransactions(client, payload.payload);
      case 'createInvoice':
        return await createInvoice(client, payload.payload);
      case 'listRecipients':
        return await listRecipients(client);
      case 'createRecipient':
        return await createRecipient(client, payload.payload);
      case 'updateRecipient':
        return await updateRecipient(client, payload.payload);
      case 'sendMoney':
        return await sendMoney(client, payload.payload);
      default:
        return Response.json({ error: 'Unsupported Mercury action.' }, { status: 400 });
    }
  } catch (error) {
    const redacted = redactMercuryError(error);
    console.error('mercury_action_failed', {
      action: payload.action,
      environment: config.environment,
      code: redacted.code,
      httpStatus: redacted.status,
      message: redacted.message,
    });
    const userMessage = formatMercuryActionError(redacted);
    return Response.json({ error: userMessage }, { status: 502 });
  }
}

const MERCURY_SUPPORT_CONTACT = 'If this keeps happening, please contact mrdj@davidjgrimsley.com.';

function formatMercuryActionError(redacted: {
  message: string;
  status: number | null;
}): string {
  const message = redacted.message ?? '';

  if (
    redacted.status === 401 ||
    /\b401\b|invalid.*token|unauthori[sz]ed/i.test(message)
  ) {
    return formatMercuryUnauthorizedMessage();
  }

  if (redacted.status === 403 || /\b403\b|forbidden/i.test(message)) {
    return `Mercury rejected this request — your Mercury plan may not include this feature. ${MERCURY_SUPPORT_CONTACT}`;
  }

  if (redacted.status === 429 || /\b429\b|rate limit/i.test(message)) {
    return `Mercury is rate-limiting your account. Please wait a minute and try again. ${MERCURY_SUPPORT_CONTACT}`;
  }

  if (
    /network|fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(message)
  ) {
    return `Couldn't reach Mercury just now. Please try again. ${MERCURY_SUPPORT_CONTACT}`;
  }

  return `${message || 'Mercury request failed.'} ${MERCURY_SUPPORT_CONTACT}`;
}

