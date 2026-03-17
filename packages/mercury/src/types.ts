import type { MercuryApiError } from './errors';

export type MercuryEnvironment = 'production' | 'sandbox';
export type MercuryMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type MercuryQueryValue = string | number | boolean | null | undefined;
export type MercuryRecord = Record<string, unknown>;

export type MercuryRetryConfig = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export type MercuryLoggerHooks = {
  onRequest?: (event: {
    method: string;
    url: string;
    headers: Record<string, string>;
    hasBody: boolean;
  }) => void;
  onResponse?: (event: {
    method: string;
    url: string;
    status: number;
    durationMs: number;
  }) => void;
  onError?: (event: {
    method: string;
    url: string;
    durationMs: number;
    error: Error;
  }) => void;
};

export type MercuryClientConfig = {
  apiKey: string;
  environment?: MercuryEnvironment;
  baseUrl?: string;
  fetch?: typeof fetch;
  retry?: MercuryRetryConfig;
  logger?: MercuryLoggerHooks;
  userAgent?: string;
};

export type MercuryRequestOptions = {
  method?: MercuryMethod;
  query?: Record<string, MercuryQueryValue>;
  headers?: HeadersInit;
  body?: unknown;
  rawBody?: BodyInit;
  idempotencyKey?: string;
};

export type MercuryPageInfo = {
  nextPage?: string | null;
  previousPage?: string | null;
};

export type MercuryCollection<T> = {
  items: T[];
  page?: MercuryPageInfo;
  raw: MercuryRecord;
};

export type MercuryAttachmentUploadInput = {
  fileName: string;
  contentType?: string;
  file: ArrayBuffer | Uint8Array;
  purpose?: string;
};

export type MercuryAccount = {
  id?: string;
  status?: string;
  type?: string;
  kind?: string;
  accountType?: string | null;
  name?: string;
  nickname?: string | null;
  balances?: Record<string, unknown>;
  availableBalance?: number | string | null;
  currentBalance?: number | string | null;
  [key: string]: unknown;
};

export type MercuryTransaction = {
  id?: string;
  status?: string;
  amount?: number | string | null;
  [key: string]: unknown;
};

export type MercuryStatement = {
  id?: string;
  month?: number;
  year?: number;
  [key: string]: unknown;
};

export type MercuryRecipient = {
  id?: string;
  name?: string;
  email?: string;
  defaultPaymentMethod?: string | null;
  paymentMethod?: string | null;
  paymentMethods?: (string | MercuryRecord)[] | null;
  [key: string]: unknown;
};

export type MercuryCustomer = {
  id: string;
  name: string;
  email: string;
  deletedAt?: string | null;
  [key: string]: unknown;
};

export type MercuryAttachment = {
  id?: string;
  name?: string;
  url?: string;
  [key: string]: unknown;
};

export type MercuryLineItemPayload = {
  name: string;
  quantity: number;
  unitPrice: number;
  salesTaxRate?: number;
};

export type MercurySendEmailOption = 'DontSend' | 'SendNow';

export type MercuryInvoicePayload = {
  customerName: string;
  customerEmail?: string;
  amount: number;
  currency?: string;
  description?: string;
  dueDateIso?: string;
  invoiceDateIso?: string;
  servicePeriodStartDate?: string;
  servicePeriodEndDate?: string;
  destinationAccountId?: string;
  lineItems?: MercuryLineItemPayload[];
  sendEmailOption?: MercurySendEmailOption;
  achDebitEnabled?: boolean;
  creditCardEnabled?: boolean;
  useRealAccountNumber?: boolean;
  ccEmails?: string[];
};

export type MercuryInvoiceResponse = {
  id: string;
  status?: string;
  slug?: string;
  hosted_url?: string;
  hostedUrl?: string;
  [key: string]: unknown;
};

export type MercurySendMoneyInput = MercuryRecord & {
  idempotencyKey: string;
  paymentMethod?: string;
};

export type MercuryTransferInput = MercuryRecord & {
  idempotencyKey: string;
};

export type MercuryWebhookVerificationInput = {
  secret: string;
  payload: string | ArrayBuffer | Uint8Array;
  signature: string;
  algorithm?: 'sha256';
  prefix?: string;
};

export type MercuryWebhookEvent = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type MercuryRequestResult<T> = {
  data: T;
  error?: MercuryApiError;
};
