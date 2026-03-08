import {
  assignSessionsToInvoice,
  createInvoice,
  type SessionBreak,
  listSessions,
  type Invoice,
  type Session,
} from '@/database/db';
import {
  createMercuryInvoice,
  type MercuryInvoiceResponse,
  type MercuryLineItemPayload,
} from '@/services/mercury';

export type SessionWithComputed = Session & {
  hours: number;
  amount: number;
};

export type InvoiceComputation = {
  totalHours: number;
  totalAmount: number;
  sessions: SessionWithComputed[];
  mercuryInvoice?: MercuryInvoiceResponse;
  mercuryWarning?: string;
};

export type TaskLineItemGroup = {
  taskLabel: string;
  totalHours: number;
  totalAmount: number;
  sessions: SessionWithComputed[];
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
  breaksBySessionId?: Record<string, SessionBreak[]>;
  totalHours: number;
  totalAmount: number;
  paymentLink?: string | null;
};

export type SessionBillableSegment = {
  id: string;
  session_id: string;
  start_time: string;
  end_time: string;
  durationSeconds: number;
  hours: number;
  amount: number;
};

export type SessionTimelineRow = {
  id: string;
  start_time: string;
  end_time: string;
  hours: number;
  amount: number;
  isBreak: boolean;
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

function toIsoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function toMs(isoString: string): number | null {
  const parsed = new Date(isoString).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function mergeIntervals(intervals: [number, number][]): [number, number][] {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const [nextStart, nextEnd] = sorted[index];
    const [currentStart, currentEnd] = merged[merged.length - 1];
    if (nextStart <= currentEnd) {
      merged[merged.length - 1] = [currentStart, Math.max(currentEnd, nextEnd)];
      continue;
    }
    merged.push([nextStart, nextEnd]);
  }

  return merged;
}

const EST_TIME_ZONE = 'America/New_York';

function formatDateEST(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(parsed);
}

function formatDateTimeEST(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(parsed);
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

export function groupSessionBreaksBySessionId(
  breaks: SessionBreak[],
): Record<string, SessionBreak[]> {
  return breaks.reduce<Record<string, SessionBreak[]>>((accumulator, sessionBreak) => {
    if (!accumulator[sessionBreak.session_id]) {
      accumulator[sessionBreak.session_id] = [];
    }

    accumulator[sessionBreak.session_id].push(sessionBreak);
    return accumulator;
  }, {});
}

export function deriveBillableSegmentsForSession(input: {
  session: SessionWithComputed;
  breaks: SessionBreak[];
  hourlyRate: number;
}): SessionBillableSegment[] {
  const { session, breaks, hourlyRate } = input;
  const sessionStartMs = toMs(session.start_time);
  const sessionEndMs = session.end_time ? toMs(session.end_time) : null;

  if (sessionStartMs === null || sessionEndMs === null || sessionEndMs <= sessionStartMs) {
    return [];
  }

  const breakIntervals = mergeIntervals(
    breaks
      .map((sessionBreak) => {
        const breakStartMs = toMs(sessionBreak.start_time);
        const breakEndMs = sessionBreak.end_time ? toMs(sessionBreak.end_time) : sessionEndMs;
        if (breakStartMs === null || breakEndMs === null) {
          return null;
        }

        const clampedStart = Math.max(sessionStartMs, breakStartMs);
        const clampedEnd = Math.min(sessionEndMs, Math.max(breakStartMs, breakEndMs));
        if (clampedEnd <= clampedStart) {
          return null;
        }

        return [clampedStart, clampedEnd] as [number, number];
      })
      .filter((interval): interval is [number, number] => interval !== null),
  );

  const segments: [number, number][] = [];
  let cursorMs = sessionStartMs;

  for (const [breakStartMs, breakEndMs] of breakIntervals) {
    if (breakStartMs > cursorMs) {
      segments.push([cursorMs, breakStartMs]);
    }
    cursorMs = Math.max(cursorMs, breakEndMs);
  }

  if (cursorMs < sessionEndMs) {
    segments.push([cursorMs, sessionEndMs]);
  }

  return segments.map(([segmentStartMs, segmentEndMs], index) => {
    const durationSeconds = Math.max(0, Math.round((segmentEndMs - segmentStartMs) / 1000));
    const hours = durationSeconds / 3600;
    return {
      id: `${session.id}_segment_${index + 1}`,
      session_id: session.id,
      start_time: toIsoFromMs(segmentStartMs),
      end_time: toIsoFromMs(segmentEndMs),
      durationSeconds,
      hours,
      amount: toMoney(hours * hourlyRate),
    };
  });
}

export function deriveSessionTimelineRows(input: {
  session: SessionWithComputed;
  breaks: SessionBreak[];
  hourlyRate: number;
}): SessionTimelineRow[] {
  const { session } = input;
  const sessionEnd = session.end_time ?? session.start_time;
  const segments = deriveBillableSegmentsForSession(input);

  if (segments.length <= 1) {
    return [
      {
        id: `${session.id}_timeline_full`,
        start_time: session.start_time,
        end_time: sessionEnd,
        hours: session.hours,
        amount: session.amount,
        isBreak: false,
      },
    ];
  }

  const rows: SessionTimelineRow[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    rows.push({
      id: `${session.id}_timeline_work_${index + 1}`,
      start_time: segment.start_time,
      end_time: segment.end_time,
      hours: segment.hours,
      amount: segment.amount,
      isBreak: false,
    });

    if (index >= segments.length - 1) {
      continue;
    }

    const nextSegment = segments[index + 1];
    rows.push({
      id: `${session.id}_timeline_break_${index + 1}`,
      start_time: segment.end_time,
      end_time: nextSegment.start_time,
      hours: 0,
      amount: 0,
      isBreak: true,
    });
  }

  return rows;
}

export function groupInvoiceLineItemsByTask(sessions: SessionWithComputed[]): TaskLineItemGroup[] {
  const grouped = new Map<string, SessionWithComputed[]>();

  for (const session of sessions) {
    const label = session.task_name ?? session.task_id ?? 'Uncategorized task';
    const existing = grouped.get(label) ?? [];
    existing.push(session);
    grouped.set(label, existing);
  }

  return Array.from(grouped.entries())
    .map(([taskLabel, groupedSessions]) => ({
      taskLabel,
      totalHours: toMoney(groupedSessions.reduce((sum, session) => sum + session.hours, 0)),
      totalAmount: toMoney(groupedSessions.reduce((sum, session) => sum + session.amount, 0)),
      sessions: groupedSessions.sort((a, b) => (a.start_time < b.start_time ? -1 : 1)),
    }))
    .sort((a, b) => (a.taskLabel < b.taskLabel ? -1 : 1));
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
  let mercuryWarning: string | undefined;
  if (input.mercury?.enabled) {
    const mercuryLineItems: MercuryLineItemPayload[] = groupInvoiceLineItemsByTask(totals.sessions).map(
      (group) => ({
        name: group.taskLabel,
        quantity: 1,
        unitPrice: group.totalAmount,
      }),
    );

    try {
      mercuryInvoice = await createMercuryInvoice({
        customerName: input.mercury.customerName,
        customerEmail: input.mercury.customerEmail,
        amount: totals.totalAmount,
        currency: 'USD',
        description: input.mercury.description,
        dueDateIso: input.mercury.dueDateIso,
        lineItems: mercuryLineItems,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Unknown Mercury API error';
      mercuryWarning = `Mercury sync skipped: ${reason}`;
    }
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
    mercuryWarning,
  };
}

export async function exportInvoicePdf(invoice: ExportableInvoice): Promise<Uint8Array> {
  let pdfLibModule: typeof import('pdf-lib');
  try {
    // Use the pre-bundled ESM build to avoid Metro resolving the cjs entrypoint.
    const pdfLibModuleName = 'pdf-lib/dist/pdf-lib.esm.min.js';
    pdfLibModule = (await import(pdfLibModuleName)) as typeof import('pdf-lib');
  } catch {
    throw new Error('PDF dependency missing. Install `pdf-lib` to enable PDF export.');
  }

  const { PDFDocument, StandardFonts, rgb } = pdfLibModule;
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 44;
  const minBottom = 52;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin - 10;

  const lineItems = groupInvoiceLineItemsByTask(invoice.sessions);
  const colItemX = margin + 10;
  const colQtyX = margin + contentWidth * 0.56;
  const colRateX = margin + contentWidth * 0.7;
  const colAmountX = margin + contentWidth * 0.84;
  const amountRightX = pageWidth - margin - 10;

  function drawRightText(
    text: string,
    rightX: number,
    atY: number,
    size: number,
    bold = false,
  ): void {
    const font = bold ? fontBold : fontRegular;
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: rightX - width,
      y: atY,
      size,
      font,
      color: rgb(0.1, 0.1, 0.12),
    });
  }

  function ensurePageSpace(requiredHeight = 16, withTableHeader = false): void {
    if (y - requiredHeight >= minBottom) {
      return;
    }

    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;

    if (withTableHeader) {
      drawTableHeader();
    }
  }

  function drawWrappedText(
    text: string,
    options: { x: number; size: number; maxWidth: number; bold?: boolean; lineHeight?: number },
  ): void {
    const font = options.bold ? fontBold : fontRegular;
    const lineHeight = options.lineHeight ?? options.size + 4;
    const words = text.split(' ');
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, options.size);
      if (width <= options.maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        ensurePageSpace(lineHeight, true);
        page.drawText(current, {
          x: options.x,
          y,
          size: options.size,
          font,
          color: rgb(0.18, 0.2, 0.22),
        });
        y -= lineHeight;
      }
      current = word;
    }

    if (current) {
      ensurePageSpace(lineHeight, true);
      page.drawText(current, {
        x: options.x,
        y,
        size: options.size,
        font,
        color: rgb(0.18, 0.2, 0.22),
      });
      y -= lineHeight;
    }
  }

  function drawTableHeader(): void {
    const headerHeight = 22;
    ensurePageSpace(headerHeight + 10);
    page.drawRectangle({
      x: margin,
      y: y - headerHeight + 4,
      width: contentWidth,
      height: headerHeight,
      color: rgb(0.92, 0.92, 0.94),
    });

    page.drawText('Item', { x: colItemX, y: y - 10, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.16) });
    page.drawText('Quantity', { x: colQtyX, y: y - 10, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.16) });
    page.drawText('Rate', { x: colRateX, y: y - 10, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.16) });
    page.drawText('Amount', { x: colAmountX, y: y - 10, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.16) });
    y -= headerHeight + 8;
  }

  // Header
  page.drawText('TIME2PAY', {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.45, 0.45, 0.48),
  });
  drawRightText(`NO. ${invoice.invoiceId}`, pageWidth - margin, y, 9);

  y -= 54;
  page.drawText('INVOICE', {
    x: margin,
    y,
    size: 48,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.12),
  });

  y -= 44;
  const leftInfoX = margin;
  const rightInfoX = margin + contentWidth / 2 + 16;
  const lineGap = 18;

  page.drawText('Date:', { x: leftInfoX, y, size: 11, font: fontBold, color: rgb(0.15, 0.15, 0.16) });
  page.drawText(formatDateEST(invoice.issuedAtIso), {
    x: leftInfoX + 46,
    y,
    size: 11,
    font: fontRegular,
    color: rgb(0.22, 0.22, 0.24),
  });
  y -= lineGap + 6;

  page.drawText('Billed to:', {
    x: leftInfoX,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.16),
  });
  page.drawText(invoice.clientLabel, {
    x: leftInfoX,
    y: y - 16,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.22),
  });

  page.drawText('From:', { x: rightInfoX, y, size: 11, font: fontBold, color: rgb(0.15, 0.15, 0.16) });
  page.drawText('Time2Pay', {
    x: rightInfoX,
    y: y - 16,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.22),
  });

  page.drawText(`Hourly rate: $${invoice.hourlyRate.toFixed(2)}`, {
    x: rightInfoX,
    y: y - 34,
    size: 10,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.37),
  });

  y -= 58;
  drawTableHeader();

  for (const taskGroup of lineItems) {
    ensurePageSpace(18, true);
    page.drawText(taskGroup.taskLabel, {
      x: colItemX,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.12),
      maxWidth: colQtyX - colItemX - 8,
    });
    page.drawText(`${taskGroup.totalHours.toFixed(2)}h`, {
      x: colQtyX,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.12, 0.12, 0.14),
    });
    page.drawText(`$${invoice.hourlyRate.toFixed(2)}`, {
      x: colRateX,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.12, 0.12, 0.14),
    });
    drawRightText(`$${taskGroup.totalAmount.toFixed(2)}`, amountRightX, y, 10);
    y -= 14;

    const detailStartX = colItemX + 12;
    const detailEndX = margin + contentWidth * 0.38;
    const detailHoursRightX = margin + contentWidth * 0.84;

    ensurePageSpace(18, true);
    page.drawText('Start', {
      x: detailStartX,
      y,
      size: 7,
      font: fontBold,
      color: rgb(0.35, 0.35, 0.37),
    });
    page.drawText('End', {
      x: detailEndX,
      y,
      size: 7,
      font: fontBold,
      color: rgb(0.35, 0.35, 0.37),
    });
    drawRightText('Hrs', detailHoursRightX, y, 7, true);
    drawRightText('$', amountRightX, y, 7, true);
    y -= 11;

    for (const session of taskGroup.sessions) {
      const sessionBreaks = invoice.breaksBySessionId?.[session.id] ?? [];
      const timelineRows = deriveSessionTimelineRows({
        session,
        breaks: sessionBreaks,
        hourlyRate: invoice.hourlyRate,
      });

      for (const row of timelineRows) {
        ensurePageSpace(11, true);
        page.drawText(formatDateTimeEST(row.start_time), {
          x: detailStartX,
          y,
          size: 7.5,
          font: fontRegular,
          color: row.isBreak ? rgb(0.58, 0.34, 0.24) : rgb(0.2, 0.2, 0.22),
        });
        page.drawText(formatDateTimeEST(row.end_time), {
          x: detailEndX,
          y,
          size: 7.5,
          font: fontRegular,
          color: row.isBreak ? rgb(0.58, 0.34, 0.24) : rgb(0.2, 0.2, 0.22),
        });
        if (row.isBreak) {
          drawRightText('Break', detailHoursRightX, y, 7.5, true);
          drawRightText('-', amountRightX, y, 7.5);
        } else {
          drawRightText(row.hours.toFixed(2), detailHoursRightX, y, 7.5);
          drawRightText(row.amount.toFixed(2), amountRightX, y, 7.5);
        }
        y -= 10;
      }

      if (session.notes) {
        drawWrappedText(`Note: ${session.notes}`, {
          x: detailStartX + 4,
          size: 7.5,
          maxWidth: contentWidth - 28,
          lineHeight: 10,
        });
      }
      y -= 2;
    }

    y -= 3;
  }

  ensurePageSpace(70, true);
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: margin + contentWidth, y: y + 4 },
    thickness: 1,
    color: rgb(0.86, 0.86, 0.88),
  });
  y -= 16;

  drawRightText(`Total hours: ${invoice.totalHours.toFixed(2)}`, amountRightX, y, 11, true);
  y -= 20;
  drawRightText(`Total amount: $${invoice.totalAmount.toFixed(2)}`, amountRightX, y, 14, true);

  if (invoice.paymentLink) {
    y -= 34;
    drawWrappedText(`Payment link: ${invoice.paymentLink}`, {
      x: margin,
      size: 9,
      maxWidth: contentWidth,
      lineHeight: 12,
    });
  }

  return await pdfDoc.save();
}
