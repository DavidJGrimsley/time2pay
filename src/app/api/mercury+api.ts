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

type MercuryActionRequest =
  | { action: 'testConnection' }
  | { action: 'testInvoiceAccess' }
  | { action: 'ensureCustomer'; payload: { name: string; email: string } }
  | { action: 'listAccounts' }
  | { action: 'createInvoice'; payload: MercuryInvoicePayload }
  | { action: 'listRecipients' }
  | { action: 'createRecipient'; payload: Record<string, unknown> }
  | { action: 'updateRecipient'; payload: { recipientId: string; input: Record<string, unknown> } }
  | { action: 'sendMoney'; payload: { accountId: string; input: MercurySendMoneyInput } };

function getMercuryClient(): MercuryClient {
  const apiKey = process.env.MERCURY_API_KEY?.trim();
  const environment = (process.env.MERCURY_ENVIRONMENT?.trim() ||
    'production') as MercuryEnvironment;
  const baseUrl = process.env.MERCURY_BASE_URL?.trim();

  if (!apiKey) {
    throw new Error('Missing MERCURY_API_KEY environment variable.');
  }

  return createMercuryClient({
    apiKey,
    environment,
    baseUrl: baseUrl || undefined,
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
    sendEmailOption: resolvedPayload.sendEmailOption ?? 'SendNow',
    internalNote: resolvedPayload.description,
    payerMemo: resolvedPayload.description,
  });

  return Response.json({ invoice });
}

async function listAccounts(client: MercuryClient): Promise<Response> {
  const result = await client.accounts.list({ limit: 200 });
  return Response.json({ accounts: result.items });
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

async function testConnection(client: MercuryClient): Promise<Response> {
  await client.accounts.list({ limit: 1 });
  const environment = process.env.MERCURY_ENVIRONMENT?.trim() || 'production';
  return Response.json({ ok: true, environment });
}

async function testInvoiceAccess(client: MercuryClient): Promise<Response> {
  await client.ar.invoices.list({ limit: 1 });
  const environment = process.env.MERCURY_ENVIRONMENT?.trim() || 'production';
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

export async function POST(request: Request): Promise<Response> {
  let payload: MercuryActionRequest;
  let client: MercuryClient;

  try {
    payload = await parseRequestPayload(request);
    client = getMercuryClient();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request.' },
      { status: 400 },
    );
  }

  try {
    switch (payload.action) {
      case 'testConnection':
        return await testConnection(client);
      case 'testInvoiceAccess':
        return await testInvoiceAccess(client);
      case 'ensureCustomer':
        return await ensureCustomer(client, payload.payload);
      case 'listAccounts':
        return await listAccounts(client);
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
    const message = error instanceof Error ? error.message : 'Mercury request failed.';
    console.error('Mercury action failed:', error);
    return Response.json({ error: message }, { status: 502 });
  }
}

