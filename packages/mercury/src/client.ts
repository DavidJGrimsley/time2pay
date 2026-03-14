import {
  createMercuryApiError,
  MercuryApiError,
  MercuryValidationError,
} from './errors';
import { parseMercuryCollection } from './internal/guards';
import { createMercuryCursorIterator } from './pagination';
import { createAccountsResource } from './resources/accounts';
import { createArCustomersResource } from './resources/ar-customers';
import { createArInvoicesResource } from './resources/ar-invoices';
import { createRecipientsResource } from './resources/recipients';
import { createSendMoneyResource } from './resources/send-money';
import { createTransactionsResource } from './resources/transactions';
import { createTransfersResource } from './resources/transfers';
import { parseMercuryWebhookEvent, verifyMercuryWebhookSignature } from './webhooks';
import { encodeMercuryPath, maskMercuryToken, sleep, toUploadBytes } from './utils';
import type {
  MercuryAttachmentUploadInput,
  MercuryClientConfig,
  MercuryCollection,
  MercuryMethod,
  MercuryQueryValue,
  MercuryRecord,
  MercuryRequestOptions,
} from './types';

const DEFAULT_BASE_URL_BY_ENVIRONMENT = {
  production: 'https://api.mercury.com/api/v1',
  sandbox: 'https://api-sandbox.mercury.com/api/v1',
} as const;

const DEFAULT_RETRY = {
  retries: 2,
  baseDelayMs: 250,
  maxDelayMs: 2000,
};

export type MercuryTransport = {
  requestJson<T>(path: string, options?: MercuryRequestOptions): Promise<T>;
  requestCollection<T extends MercuryRecord>(
    path: string,
    keys: string[],
    options?: MercuryRequestOptions,
  ): Promise<MercuryCollection<T>>;
  requestArrayBuffer(path: string, options?: MercuryRequestOptions): Promise<ArrayBuffer>;
  buildAttachmentFormData(input: MercuryAttachmentUploadInput): FormData;
  iterate<T extends MercuryRecord>(
    fetchPage: (cursor?: string | null) => Promise<MercuryCollection<T>>,
  ): AsyncGenerator<T, void, void>;
};

export type MercuryAccountsResource = ReturnType<typeof createAccountsResource>;
export type MercuryTransactionsResource = ReturnType<typeof createTransactionsResource>;
export type MercuryRecipientsResource = ReturnType<typeof createRecipientsResource>;
export type MercurySendMoneyResource = ReturnType<typeof createSendMoneyResource>;
export type MercuryTransfersResource = ReturnType<typeof createTransfersResource>;
export type MercuryArCustomersResource = ReturnType<typeof createArCustomersResource>;
export type MercuryArInvoicesResource = ReturnType<typeof createArInvoicesResource>;
export type MercuryWebhooksResource = {
  verifySignature: typeof verifyMercuryWebhookSignature;
  parseEvent: typeof parseMercuryWebhookEvent;
};

export type MercuryClient = {
  requestJson<T>(path: string, options?: MercuryRequestOptions): Promise<T>;
  requestArrayBuffer(path: string, options?: MercuryRequestOptions): Promise<ArrayBuffer>;
  accounts: MercuryAccountsResource;
  transactions: MercuryTransactionsResource;
  recipients: MercuryRecipientsResource;
  sendMoney: MercurySendMoneyResource;
  transfers: MercuryTransfersResource;
  ar: {
    customers: MercuryArCustomersResource;
    invoices: MercuryArInvoicesResource;
  };
  webhooks: MercuryWebhooksResource;
};

function resolveFetch(config: MercuryClientConfig): typeof fetch {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('Mercury client requires a fetch implementation.');
  }

  return fetchImpl;
}

function shouldRetry(input: {
  attempt: number;
  method: MercuryMethod;
  status?: number;
  error?: unknown;
  idempotencyKey?: string;
  retries: number;
}): boolean {
  if (input.attempt >= input.retries) {
    return false;
  }

  if (input.error) {
    return input.method === 'GET' || Boolean(input.idempotencyKey);
  }

  if (input.status == null) {
    return false;
  }

  if (input.status === 429 || input.status >= 500) {
    return input.method === 'GET' || Boolean(input.idempotencyKey);
  }

  return false;
}

function resolveBaseUrl(config: MercuryClientConfig): string {
  const baseUrl =
    config.baseUrl?.trim() || DEFAULT_BASE_URL_BY_ENVIRONMENT[config.environment ?? 'production'];
  return baseUrl.replace(/\/$/, '');
}

function normalizeMethod(method?: string): MercuryMethod {
  const resolved = (method ?? 'GET').toUpperCase();
  if (
    resolved !== 'GET' &&
    resolved !== 'POST' &&
    resolved !== 'PUT' &&
    resolved !== 'PATCH' &&
    resolved !== 'DELETE'
  ) {
    throw new MercuryValidationError(`Unsupported Mercury method: ${resolved}`, {
      method: 'LOCAL',
      path: 'method',
    });
  }

  return resolved;
}

async function parseMercuryErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => undefined);
  }

  return response.text().catch(() => undefined);
}

function buildMercuryHeaders(
  apiKey: string,
  userAgent: string | undefined,
  options: MercuryRequestOptions,
): Headers {
  const headers = new Headers(options.headers ?? {});
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');

  if (userAgent) {
    headers.set('User-Agent', userAgent);
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  return headers;
}

export function createMercuryClient(config: MercuryClientConfig): MercuryClient {
  if (!config.apiKey?.trim()) {
    throw new Error('Mercury client requires an apiKey.');
  }

  const fetchImpl = resolveFetch(config);
  const baseUrl = resolveBaseUrl(config);
  const retry = { ...DEFAULT_RETRY, ...config.retry };
  const userAgent = config.userAgent ?? '@mrdj/mercury-incubation';

  const requestJson = async <T>(path: string, options: MercuryRequestOptions = {}): Promise<T> => {
    const method = normalizeMethod(options.method);
    const url = `${baseUrl}${encodeMercuryPath(
      path,
      options.query as Record<string, MercuryQueryValue> | undefined,
    )}`;

    for (let attempt = 0; ; attempt += 1) {
      const startedAt = Date.now();
      const headers = buildMercuryHeaders(config.apiKey, userAgent, options);
      let body: BodyInit | undefined;

      if (options.rawBody) {
        body = options.rawBody;
      } else if (options.body != null) {
        if (options.body instanceof FormData) {
          body = options.body;
        } else {
          headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
          body = JSON.stringify(options.body);
        }
      }

      config.logger?.onRequest?.({
        method,
        url,
        headers: {
          authorization: maskMercuryToken(config.apiKey),
          accept: headers.get('Accept') ?? 'application/json',
          'content-type': headers.get('Content-Type') ?? '',
          'idempotency-key': headers.get('Idempotency-Key') ?? '',
        },
        hasBody: body != null,
      });

      try {
        const response = await fetchImpl(url, {
          method,
          headers,
          body,
        });
        const durationMs = Date.now() - startedAt;

        if (!response.ok) {
          const details = await parseMercuryErrorBody(response);
          const error = createMercuryApiError({
            message: `Mercury request failed with status ${response.status}.`,
            method,
            path,
            status: response.status,
            details,
          });

          config.logger?.onError?.({ method, url, durationMs, error });

          if (
            shouldRetry({
              attempt,
              method,
              status: response.status,
              retries: retry.retries,
              idempotencyKey: options.idempotencyKey,
            })
          ) {
            const delayMs = Math.min(retry.baseDelayMs * 2 ** attempt, retry.maxDelayMs);
            await sleep(delayMs);
            continue;
          }

          throw error;
        }

        config.logger?.onResponse?.({ method, url, status: response.status, durationMs });

        if (response.status === 204) {
          return undefined as T;
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          return (await response.json()) as T;
        }

        const text = await response.text();
        return ({ value: text } as unknown) as T;
      } catch (error) {
        const isMercuryError = error instanceof MercuryApiError;
        if (
          !isMercuryError &&
          shouldRetry({
            attempt,
            method,
            error,
            retries: retry.retries,
            idempotencyKey: options.idempotencyKey,
          })
        ) {
          const delayMs = Math.min(retry.baseDelayMs * 2 ** attempt, retry.maxDelayMs);
          await sleep(delayMs);
          continue;
        }

        throw error;
      }
    }
  };

  const requestCollection = <T extends MercuryRecord>(
    path: string,
    keys: string[],
    options?: MercuryRequestOptions,
  ): Promise<MercuryCollection<T>> =>
    requestJson<unknown>(path, options).then((value) => parseMercuryCollection<T>(value, keys));

  const requestArrayBuffer = async (
    path: string,
    options: MercuryRequestOptions = {},
  ): Promise<ArrayBuffer> => {
    const method = normalizeMethod(options.method);
    const url = `${baseUrl}${encodeMercuryPath(
      path,
      options.query as Record<string, MercuryQueryValue> | undefined,
    )}`;
    const optionHeaders = new Headers(options.headers ?? {});
    optionHeaders.set('Accept', 'application/pdf');
    const headers = buildMercuryHeaders(config.apiKey, userAgent, {
      ...options,
      headers: optionHeaders,
    });
    const response = await fetchImpl(url, {
      method,
      headers,
    });

    if (!response.ok) {
      const details = await parseMercuryErrorBody(response);
      throw createMercuryApiError({
        message: `Mercury request failed with status ${response.status}.`,
        method,
        path,
        status: response.status,
        details,
      });
    }

    return response.arrayBuffer();
  };

  const buildAttachmentFormData = (input: MercuryAttachmentUploadInput): FormData => {
    const formData = new FormData();
    const bytes = toUploadBytes(input.file);
    formData.append(
      'file',
      new Blob([bytes], { type: input.contentType ?? 'application/octet-stream' }),
      input.fileName,
    );

    if (input.purpose) {
      formData.append('purpose', input.purpose);
    }

    return formData;
  };

  const transport: MercuryTransport = {
    requestJson,
    requestCollection,
    requestArrayBuffer,
    buildAttachmentFormData,
    iterate: createMercuryCursorIterator,
  };

  return {
    requestJson,
    requestArrayBuffer,
    accounts: createAccountsResource(transport),
    transactions: createTransactionsResource(transport),
    recipients: createRecipientsResource(transport),
    sendMoney: createSendMoneyResource(transport),
    transfers: createTransfersResource(transport),
    ar: {
      customers: createArCustomersResource(transport),
      invoices: createArInvoicesResource(transport),
    },
    webhooks: {
      verifySignature: verifyMercuryWebhookSignature,
      parseEvent: parseMercuryWebhookEvent,
    },
  };
}
