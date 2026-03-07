import {
  assignSessionsToInvoice,
  createInvoice,
  listSessions,
  type Invoice,
  type Session,
} from '@/database/db';
import { createMercuryInvoice, type MercuryInvoiceResponse } from '@/services/mercury';

export type SessionWithComputed = Session & {
  hours: number;
  amount: number;
};

export type InvoiceComputation = {
  totalHours: number;
  totalAmount: number;
  sessions: SessionWithComputed[];
  mercuryInvoice?: MercuryInvoiceResponse;
};

export type CreateInvoiceFromSessionsInput = {
  invoiceId: string;
  clientId: string;
  sessionIds: string[];
  hourlyRate: number;
  paypalLink?: string | null;
  status?: Invoice['status'];
  mercury?: {
    enabled: boolean;
    customerName: string;
    customerEmail?: string;
    description?: string;
    dueDateIso?: string;
  };
};

export type ExportableInvoice = {
  invoiceId: string;
  clientLabel: string;
  issuedAtIso: string;
  hourlyRate: number;
  sessions: SessionWithComputed[];
  totalHours: number;
  totalAmount: number;
  paymentLink?: string | null;
};

function assertNonNegativeFinite(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${fieldName}: expected a non-negative finite number`);
  }
}

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function toHours(durationSeconds: number | null): number {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0;
  }
  return durationSeconds / 3600;
}

export function computeInvoiceTotals(sessions: Session[], hourlyRate: number): InvoiceComputation {
  assertNonNegativeFinite(hourlyRate, 'hourlyRate');

  const computed = sessions.map((session) => {
    const hours = toHours(session.duration);
    const amount = toMoney(hours * hourlyRate);

    return {
      ...session,
      hours,
      amount,
    };
  });

  const totalHours = toMoney(computed.reduce((sum, session) => sum + session.hours, 0));
  const totalAmount = toMoney(computed.reduce((sum, session) => sum + session.amount, 0));

  return {
    totalHours,
    totalAmount,
    sessions: computed,
  };
}

export function buildPayPalPaymentLink(input: {
  paypalHandleOrUrl: string;
  amount: number;
  currencyCode?: string;
}): string {
  const trimmed = input.paypalHandleOrUrl.trim();
  assertNonNegativeFinite(input.amount, 'amount');
  const currencyCode = (input.currencyCode ?? 'USD').toUpperCase();

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new Error('Invalid currencyCode: expected a 3-letter ISO code');
  }

  const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://paypal.me/${trimmed}`);

  const isPayPalHost = parsed.hostname === 'paypal.me' || parsed.hostname.endsWith('.paypal.com');
  if (!isPayPalHost) {
    throw new Error('Invalid PayPal URL: expected paypal.me or paypal.com host');
  }

  parsed.searchParams.set('amount', toMoney(input.amount).toString());
  parsed.searchParams.set('currency', currencyCode);

  return parsed.toString();
}

export function isValidPayPalPaymentLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isPayPalHost = parsed.hostname === 'paypal.me' || parsed.hostname.endsWith('.paypal.com');

    const amount = Number(parsed.searchParams.get('amount'));
    const currency = parsed.searchParams.get('currency');

    return isPayPalHost && Number.isFinite(amount) && amount >= 0 && !!currency;
  } catch {
    return false;
  }
}

export async function createInvoiceFromSessions(
  input: CreateInvoiceFromSessionsInput,
): Promise<InvoiceComputation> {
  const allSessions = await listSessions();
  const selected = allSessions.filter(
    (session) => input.sessionIds.includes(session.id) && session.invoice_id === null,
  );

  if (selected.length === 0) {
    throw new Error('No uninvoiced sessions found for the provided session IDs');
  }

  const totals = computeInvoiceTotals(selected, input.hourlyRate);

  if (input.paypalLink && !isValidPayPalPaymentLink(input.paypalLink)) {
    throw new Error('Invalid PayPal payment link format');
  }

  let mercuryInvoice: MercuryInvoiceResponse | undefined;
  if (input.mercury?.enabled) {
    mercuryInvoice = await createMercuryInvoice({
      customerName: input.mercury.customerName,
      customerEmail: input.mercury.customerEmail,
      amount: totals.totalAmount,
      currency: 'USD',
      description: input.mercury.description,
      dueDateIso: input.mercury.dueDateIso,
    });
  }

  await createInvoice({
    id: input.invoiceId,
    client_id: input.clientId,
    total: totals.totalAmount,
    status: input.status ?? 'draft',
    payment_link: mercuryInvoice?.hosted_url ?? input.paypalLink ?? null,
    mercury_invoice_id: mercuryInvoice?.id ?? null,
  });

  await assignSessionsToInvoice(
    selected.map((session) => session.id),
    input.invoiceId,
  );

  return {
    ...totals,
    mercuryInvoice,
  };
}

export async function exportInvoicePdf(invoice: ExportableInvoice): Promise<Uint8Array> {
  let jsPdfModule: unknown;
  try {
    const jsPdfModuleName = 'jspdf';
    jsPdfModule = await import(jsPdfModuleName);
  } catch {
    throw new Error('jsPDF dependency missing. Install `jspdf` to enable PDF export.');
  }

  const JsPdf = (jsPdfModule as { jsPDF?: new () => any }).jsPDF;
  if (!JsPdf) {
    throw new Error('Failed to load jsPDF constructor');
  }

  const doc = new JsPdf();
  let y = 20;

  doc.setFontSize(18);
  doc.text(`Invoice ${invoice.invoiceId}`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`Client: ${invoice.clientLabel}`, 14, y);
  y += 7;
  doc.text(`Issued: ${invoice.issuedAtIso}`, 14, y);
  y += 7;
  doc.text(`Hourly rate: $${invoice.hourlyRate.toFixed(2)}`, 14, y);
  y += 10;

  doc.text('Sessions', 14, y);
  y += 8;

  for (const session of invoice.sessions) {
    const endLabel = session.end_time ?? 'running';
    doc.text(
      `- ${session.id}: ${session.start_time} -> ${endLabel} | ${session.hours.toFixed(2)}h | $${session.amount.toFixed(2)}`,
      14,
      y,
    );
    y += 7;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  y += 5;
  doc.text(`Total hours: ${invoice.totalHours.toFixed(2)}`, 14, y);
  y += 7;
  doc.text(`Total amount: $${invoice.totalAmount.toFixed(2)}`, 14, y);

  if (invoice.paymentLink) {
    y += 9;
    doc.text(`Pay: ${invoice.paymentLink}`, 14, y);
  }

  const arrayBuffer = doc.output('arraybuffer') as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}
