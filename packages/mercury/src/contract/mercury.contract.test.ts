import { beforeAll, describe, expect, it } from 'vitest';
import webhookInvoiceCreatedFixture from './fixtures/webhook.invoice.created.json';
import {
  createMercuryClient,
  createMercuryIdempotencyKey,
  findBestCheckingAccount,
  parseMercuryWebhookEvent,
  verifyMercuryWebhookSignature,
  type MercuryClient,
  type MercuryRecord,
} from '../index';

const contractRunEnabled = process.env.MERCURY_CONTRACT_RUN === 'true';
const arEnabled = process.env.MERCURY_CONTRACT_AR_ENABLED === 'true';

const describeContract = contractRunEnabled ? describe : describe.skip;

describeContract('Mercury Contract Suite (test environment)', () => {
  let client: MercuryClient;

  beforeAll(() => {
    const apiKey = process.env.MERCURY_SANDBOX_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('Set MERCURY_SANDBOX_API_KEY to run Mercury contract tests.');
    }

    client = createMercuryClient({
      apiKey,
      environment: 'sandbox',
      baseUrl: process.env.MERCURY_SANDBOX_BASE_URL?.trim() || undefined,
      retry: {
        retries: 1,
        baseDelayMs: 250,
      },
    });
  });

  it(
    'lists accounts from Mercury',
    async () => {
      const result = await client.accounts.list({ limit: 50 });
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.raw).toBeTruthy();
    },
    45_000,
  );

  it(
    'lists recipients from Mercury',
    async () => {
      const result = await client.recipients.list({ limit: 50 });
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.raw).toBeTruthy();
    },
    45_000,
  );

  it(
    'ensures a customer and creates an invoice when AR is enabled',
    async () => {
      if (!arEnabled) {
        expect(true).toBe(true);
        return;
      }

      const accountId =
        process.env.MERCURY_CONTRACT_DESTINATION_ACCOUNT_ID?.trim() ||
        findBestCheckingAccount((await client.accounts.list({ limit: 100 })).items)?.id;

      if (!accountId) {
        throw new Error(
          'No destination account available. Set MERCURY_CONTRACT_DESTINATION_ACCOUNT_ID.',
        );
      }

      const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const email = `time2pay.contract.${nonce}@example.com`;
      const customerId = await client.ar.customers.ensureCustomer({
        name: `Time2Pay Contract ${nonce}`,
        email,
      });

      expect(customerId).toBeTruthy();

      const now = new Date();
      const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const invoice = await client.ar.invoices.create({
        dueDate: due.toISOString().slice(0, 10),
        invoiceDate: now.toISOString().slice(0, 10),
        customerId,
        destinationAccountId: accountId,
        lineItems: [
          {
            name: 'Contract Validation Item',
            quantity: 1,
            unitPrice: 12.5,
          },
        ],
        sendEmailOption: 'DontSend',
        achDebitEnabled: true,
        creditCardEnabled: false,
      });

      expect(invoice.id).toBeTruthy();
    },
    90_000,
  );

  it(
    'creates an internal transfer when transfer payload is provided',
    async () => {
      const payloadRaw = process.env.MERCURY_CONTRACT_TRANSFER_PAYLOAD_JSON?.trim();
      if (!payloadRaw) {
        expect(true).toBe(true);
        return;
      }

      const payload = JSON.parse(payloadRaw) as MercuryRecord;
      const result = await client.transfers.create({
        ...payload,
        idempotencyKey: createMercuryIdempotencyKey('contract_transfer'),
      });

      expect(result).toBeTruthy();
    },
    90_000,
  );

  it(
    'creates a send-money transaction when payload and account are provided',
    async () => {
      const accountId = process.env.MERCURY_CONTRACT_SEND_MONEY_ACCOUNT_ID?.trim();
      const payloadRaw = process.env.MERCURY_CONTRACT_SEND_MONEY_PAYLOAD_JSON?.trim();
      if (!accountId || !payloadRaw) {
        expect(true).toBe(true);
        return;
      }

      const payload = JSON.parse(payloadRaw) as MercuryRecord;
      const transaction = await client.sendMoney.send(accountId, {
        ...payload,
        idempotencyKey: createMercuryIdempotencyKey('contract_send_money'),
      });

      expect(transaction).toBeTruthy();
    },
    90_000,
  );

  it('verifies webhook fixtures', async () => {
    const payload = JSON.stringify(webhookInvoiceCreatedFixture);
    const secret = 'contract_webhook_secret';

    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signatureBytes = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(payload),
    );
    const signature = Array.from(new Uint8Array(signatureBytes))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    const verified = await verifyMercuryWebhookSignature({
      secret,
      payload,
      signature: `sha256=${signature}`,
      prefix: 'sha256',
    });
    expect(verified).toBe(true);

    const event = parseMercuryWebhookEvent(payload);
    expect(event.id).toBe('evt_contract_invoice_created_001');
    expect(event.type).toBe('invoice.created');
  });
});
