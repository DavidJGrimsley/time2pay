import type {
  MercuryAccount,
  MercuryInvoicePayload,
  MercuryInvoiceResponse,
  MercuryRecipient,
  MercuryRecord,
  MercurySendMoneyInput,
  MercuryTransaction,
} from '@mrdj/mercury';

export type MercuryConfig = {
  proxyPath: string;
};

type MercuryActionName =
  | 'testConnection'
  | 'testInvoiceAccess'
  | 'ensureCustomer'
  | 'listAccounts'
  | 'createInvoice'
  | 'listRecipients'
  | 'createRecipient'
  | 'updateRecipient'
  | 'sendMoney';

type MercuryActionPayloadMap = {
  testConnection: undefined;
  testInvoiceAccess: undefined;
  ensureCustomer: { name: string; email: string };
  listAccounts: undefined;
  createInvoice: MercuryInvoicePayload;
  listRecipients: undefined;
  createRecipient: MercuryRecord;
  updateRecipient: { recipientId: string; input: MercuryRecord };
  sendMoney: { accountId: string; input: MercurySendMoneyInput };
};

type MercuryActionResponseMap = {
  testConnection: { ok: true; environment: string };
  testInvoiceAccess: { ok: true; environment: string };
  ensureCustomer: { customerId: string };
  listAccounts: { accounts: MercuryAccount[] };
  createInvoice: { invoice: MercuryInvoiceResponse };
  listRecipients: { recipients: MercuryRecipient[] };
  createRecipient: { recipient: MercuryRecipient };
  updateRecipient: { recipient: MercuryRecipient };
  sendMoney: { transaction: MercuryTransaction };
};

function getMercuryConfig(): MercuryConfig {
  return {
    proxyPath: process.env.EXPO_PUBLIC_MERCURY_PROXY_PATH ?? '/api/mercury',
  };
}

async function mercuryAction<TAction extends MercuryActionName>(
  action: TAction,
  payload?: MercuryActionPayloadMap[TAction],
): Promise<MercuryActionResponseMap[TAction]> {
  const config = getMercuryConfig();

  const response = await fetch(config.proxyPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      payload,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mercury API request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as MercuryActionResponseMap[TAction];
}

export async function testMercuryConnection(): Promise<{ ok: true; environment: string }> {
  return mercuryAction('testConnection');
}

export async function testMercuryInvoiceAccess(): Promise<{ ok: true; environment: string }> {
  return mercuryAction('testInvoiceAccess');
}

export async function ensureMercuryCustomer(input: {
  name: string;
  email: string;
}): Promise<string> {
  const result = await mercuryAction('ensureCustomer', input);
  return result.customerId;
}

export async function listMercuryAccounts(): Promise<MercuryAccount[]> {
  const result = await mercuryAction('listAccounts');
  return result.accounts;
}

export async function createMercuryInvoice(
  payload: MercuryInvoicePayload,
): Promise<MercuryInvoiceResponse> {
  const result = await mercuryAction('createInvoice', payload);
  return result.invoice;
}

export async function listMercuryRecipients(): Promise<MercuryRecipient[]> {
  const result = await mercuryAction('listRecipients');
  return result.recipients;
}

export async function createMercuryRecipient(
  input: MercuryRecord,
): Promise<MercuryRecipient> {
  const result = await mercuryAction('createRecipient', input);
  return result.recipient;
}

export async function updateMercuryRecipient(
  recipientId: string,
  input: MercuryRecord,
): Promise<MercuryRecipient> {
  const result = await mercuryAction('updateRecipient', { recipientId, input });
  return result.recipient;
}

export async function sendMercuryMoney(
  accountId: string,
  input: MercurySendMoneyInput,
): Promise<MercuryTransaction> {
  const result = await mercuryAction('sendMoney', { accountId, input });
  return result.transaction;
}

export type {
  MercuryAccount,
  MercuryInvoicePayload,
  MercuryInvoiceResponse,
  MercuryLineItemPayload,
  MercuryRecipient,
  MercurySendMoneyInput,
  MercurySendEmailOption,
  MercuryTransaction,
} from '@mrdj/mercury';
