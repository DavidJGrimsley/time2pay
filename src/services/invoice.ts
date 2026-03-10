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
import { shortCommitSha } from '@/services/github';

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

export type ProjectLineItemGroup = {
  projectLabel: string;
  totalHours: number;
  totalAmount: number;
  tasks: TaskLineItemGroup[];
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
  issuedAtIso: string;
  hourlyRate: number;
  sessions: SessionWithComputed[];
  breaksBySessionId?: Record<string, SessionBreak[]>;
  totalHours: number;
  totalAmount: number;
  paymentLink?: string | null;
  sender: {
    companyName?: string | null;
    logoUrl?: string | null;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  recipient: {
    companyName: string;
    phone?: string | null;
    email?: string | null;
  };
  footerLogoUrl?: string | null;
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

function formatInvoiceNumber(invoiceId: string): string {
  return invoiceId.replace(/^invoice[_-]/i, '');
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

export function groupInvoiceLineItemsByProject(
  sessions: SessionWithComputed[],
): ProjectLineItemGroup[] {
  const grouped = new Map<string, SessionWithComputed[]>();

  for (const session of sessions) {
    const label = session.project_name ?? session.project_id ?? 'Uncategorized project';
    const existing = grouped.get(label) ?? [];
    existing.push(session);
    grouped.set(label, existing);
  }

  return Array.from(grouped.entries())
    .map(([projectLabel, projectSessions]) => {
      const tasks = groupInvoiceLineItemsByTask(projectSessions);
      return {
        projectLabel,
        totalHours: toMoney(tasks.reduce((sum, task) => sum + task.totalHours, 0)),
        totalAmount: toMoney(tasks.reduce((sum, task) => sum + task.totalAmount, 0)),
        tasks,
      };
    })
    .sort((a, b) => (a.projectLabel < b.projectLabel ? -1 : 1));
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

  const { PDFDocument, PDFArray, PDFName, PDFNumber, PDFString, StandardFonts, rgb } =
    pdfLibModule;
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  async function embedImageFromUrl(
    url: string | null | undefined,
  ): Promise<{ image: any; width: number; height: number } | null> {
    const trimmed = url?.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const response = await fetch(trimmed);
      if (!response.ok) {
        return null;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      try {
        const png = await pdfDoc.embedPng(bytes);
        return { image: png, width: png.width, height: png.height };
      } catch {
        const jpg = await pdfDoc.embedJpg(bytes);
        return { image: jpg, width: jpg.width, height: jpg.height };
      }
    } catch {
      return null;
    }
  }

  function fitIntoBox(
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } {
    if (width <= 0 || height <= 0) {
      return { width: maxWidth, height: maxHeight };
    }

    const ratio = Math.min(maxWidth / width, maxHeight / height);
    return {
      width: width * ratio,
      height: height * ratio,
    };
  }

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 44;
  const footerHeight = 64;
  const minBottom = footerHeight + 18;
  const contentWidth = pageWidth - margin * 2;

  const projectLineItems = groupInvoiceLineItemsByProject(invoice.sessions);
  const senderDisplayName =
    invoice.sender.companyName?.trim() ||
    invoice.sender.fullName?.trim() ||
    'Your Business Name';
  const senderLines = [
    invoice.sender.companyName?.trim() && invoice.sender.fullName?.trim()
      ? invoice.sender.fullName.trim()
      : null,
    invoice.sender.phone?.trim() || null,
    invoice.sender.email?.trim() || null,
  ].filter((line): line is string => Boolean(line));
  const recipientLines = [
    invoice.recipient.companyName.trim(),
    invoice.recipient.phone?.trim() || null,
    invoice.recipient.email?.trim() || null,
  ].filter((line): line is string => Boolean(line));

  const senderLogo = await embedImageFromUrl(invoice.sender.logoUrl ?? null);
  const footerLogo = await embedImageFromUrl(invoice.footerLogoUrl ?? '/images/time2payLogo.png');

  const textColor = rgb(0.1, 0.1, 0.12);
  const mutedText = rgb(0.28, 0.3, 0.32);
  const secondaryColor = rgb(0.733, 0.494, 0.365);
  const tableHeaderColor = rgb(0.92, 0.92, 0.94);
  const alternatingRowColor = rgb(0.91, 0.95, 0.91);
  const dividerColor = rgb(0.86, 0.86, 0.88);

  const colItemX = margin + 10;
  const colQtyX = margin + contentWidth * 0.58;
  const colRateX = margin + contentWidth * 0.73;
  const colAmountX = margin + contentWidth * 0.87;
  const amountRightX = pageWidth - margin - 10;
  const detailStartX = colItemX + 12;
  const detailEndX = margin + contentWidth * 0.41;
  const detailHoursRightX = margin + contentWidth * 0.87;

  function drawRightText(
    targetPage: any,
    text: string,
    rightX: number,
    atY: number,
    size: number,
    bold = false,
    color = textColor,
  ): void {
    const font = bold ? fontBold : fontRegular;
    const width = font.widthOfTextAtSize(text, size);
    targetPage.drawText(text, {
      x: rightX - width,
      y: atY,
      size,
      font,
      color,
    });
  }

  function drawFooter(targetPage: any): void {
    targetPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: footerHeight,
      color: secondaryColor,
    });

    const footerBrandSize = 10.35;
    const footerContactSize = 10.35;
    const footerY = footerHeight / 2 - 4;
    let footerTextX = margin;

    if (footerLogo) {
      const ratio = footerHeight / footerLogo.height;
      const fitted = {
        width: footerLogo.width * ratio,
        height: footerHeight,
      };
      targetPage.drawImage(footerLogo.image, {
        x: margin,
        y: 0,
        width: fitted.width,
        height: fitted.height,
      });
      footerTextX += fitted.width + 12;
    }

    targetPage.drawText('Invoice created by TIME2PAY by MrDJ', {
      x: footerTextX,
      y: footerY + 3.5,
      size: footerBrandSize,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    drawRightText(
      targetPage,
      'mrdj@davidjgrimsley.com | 252-220-2512',
      pageWidth - margin,
      footerY + 3.5,
      footerContactSize,
      false,
      rgb(1, 1, 1),
    );
  }

  function createPage(): any {
    const nextPage = pdfDoc.addPage([pageWidth, pageHeight]);
    drawFooter(nextPage);
    return nextPage;
  }

  function addLinkAnnotation(input: {
    targetPage: any;
    x: number;
    y: number;
    width: number;
    height: number;
    url: string;
  }): void {
    const sanitizedUrl = input.url.trim();
    if (!sanitizedUrl || input.width <= 0 || input.height <= 0) {
      return;
    }

    const context = pdfDoc.context;
    const rect = context.obj([
      PDFNumber.of(input.x),
      PDFNumber.of(input.y),
      PDFNumber.of(input.x + input.width),
      PDFNumber.of(input.y + input.height),
    ]);
    const border = context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]);
    const action = context.obj({
      Type: PDFName.of('Action'),
      S: PDFName.of('URI'),
      URI: PDFString.of(sanitizedUrl),
      // Best-effort hint for viewers that support opening URI actions in a new tab/window.
      NewWindow: true,
    });
    const annotation = context.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Link'),
      Rect: rect,
      Border: border,
      A: action,
    });
    const annotationRef = context.register(annotation);
    const existingAnnots =
      input.targetPage.node.lookupMaybe(PDFName.of('Annots'), PDFArray) ??
      context.obj([]);
    existingAnnots.push(annotationRef);
    input.targetPage.node.set(PDFName.of('Annots'), existingAnnots);
  }

  let page = createPage();
  let y = pageHeight - margin;
  let activeProjectLabel: string | null = null;

  function drawTableHeader(): void {
    const headerHeight = 22;
    ensurePageSpace(headerHeight + 8);
    page.drawRectangle({
      x: margin,
      y: y - headerHeight + 4,
      width: contentWidth,
      height: headerHeight,
      color: tableHeaderColor,
    });

    page.drawText('Task', { x: colItemX, y: y - 10, size: 10, font: fontBold, color: textColor });
    page.drawText('Time', { x: colQtyX, y: y - 10, size: 10, font: fontBold, color: textColor });
    page.drawText('Rate', { x: colRateX, y: y - 10, size: 10, font: fontBold, color: textColor });
    page.drawText('Amount', { x: colAmountX, y: y - 10, size: 10, font: fontBold, color: textColor });
    y -= headerHeight + 8;
  }

  function drawProjectHeader(projectLabel: string, continuation = false): void {
    ensurePageSpace(34);
    const title = continuation ? `Project: ${projectLabel} (cont.)` : `Project: ${projectLabel}`;
    page.drawText(title, {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: textColor,
    });
    drawRightText(
      page,
      `Hourly rate: $${invoice.hourlyRate.toFixed(2)}`,
      amountRightX,
      y,
      10,
      false,
      mutedText,
    );
    y -= 16;
    drawTableHeader();
  }

  function ensurePageSpace(requiredHeight = 16, redrawProjectTable = false): void {
    if (y - requiredHeight >= minBottom) {
      return;
    }

    page = createPage();
    y = pageHeight - margin;

    if (redrawProjectTable && activeProjectLabel) {
      drawProjectHeader(activeProjectLabel, true);
    }
  }

  function drawWrappedText(
    text: string,
    options: {
      x: number;
      size: number;
      maxWidth: number;
      bold?: boolean;
      lineHeight?: number;
      color?: any;
    },
  ): void {
    const font = options.bold ? fontBold : fontRegular;
    const lineHeight = options.lineHeight ?? options.size + 4;
    const color = options.color ?? mutedText;
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
        ensurePageSpace(lineHeight, Boolean(activeProjectLabel));
        page.drawText(current, {
          x: options.x,
          y,
          size: options.size,
          font,
          color,
        });
        y -= lineHeight;
      }
      current = word;
    }

    if (current) {
      ensurePageSpace(lineHeight, Boolean(activeProjectLabel));
      page.drawText(current, {
        x: options.x,
        y,
        size: options.size,
        font,
        color,
      });
      y -= lineHeight;
    }
  }

  const senderLogoSize = senderLogo ? fitIntoBox(senderLogo.width, senderLogo.height, 50, 50) : null;
  const headerTextSize = 22;
  const invoiceNoSize = 11;
  const headerRowHeight = Math.max(senderLogoSize?.height ?? 0, headerTextSize + 4);
  const headerRowBottomY = y - headerRowHeight;
  const businessNameX = margin + (senderLogoSize ? senderLogoSize.width + 10 : 0);

  if (senderLogo && senderLogoSize) {
    page.drawImage(senderLogo.image, {
      x: margin,
      y: headerRowBottomY + (headerRowHeight - senderLogoSize.height) / 2,
      width: senderLogoSize.width,
      height: senderLogoSize.height,
    });
  }
  page.drawText(senderDisplayName, {
    x: businessNameX,
    y: headerRowBottomY + (headerRowHeight - headerTextSize) / 2,
    size: headerTextSize,
    font: fontBold,
    color: textColor,
  });
  drawRightText(
    page,
    `INVOICE NO. ${formatInvoiceNumber(invoice.invoiceId)}`,
    pageWidth - margin,
    headerRowBottomY + (headerRowHeight - invoiceNoSize) / 2 + 1,
    invoiceNoSize,
    true,
  );
  y = headerRowBottomY - 8;
  drawRightText(page, `Date: ${formatDateEST(invoice.issuedAtIso)}`, pageWidth - margin, y, 10, false, mutedText);
  y -= 26;

  const leftInfoX = margin;
  const rightInfoX = margin + contentWidth / 2 + 20;
  page.drawText('Billed to:', {
    x: leftInfoX,
    y,
    size: 11,
    font: fontBold,
    color: textColor,
  });

  page.drawText('From:', {
    x: rightInfoX,
    y,
    size: 11,
    font: fontBold,
    color: textColor,
  });
  y -= 14;

  const blockLineHeight = 12;
  for (let index = 0; index < recipientLines.length; index += 1) {
    page.drawText(recipientLines[index], {
      x: leftInfoX,
      y: y - index * blockLineHeight,
      size: 10,
      font: fontRegular,
      color: mutedText,
    });
  }

  const fromLines = [senderDisplayName, ...senderLines];
  for (let index = 0; index < fromLines.length; index += 1) {
    page.drawText(fromLines[index], {
      x: rightInfoX,
      y: y - index * blockLineHeight,
      size: 10,
      font: fontRegular,
      color: mutedText,
    });
  }

  const contactRows = Math.max(recipientLines.length, fromLines.length);
  y -= contactRows * blockLineHeight + 14;

  for (const projectGroup of projectLineItems) {
    activeProjectLabel = projectGroup.projectLabel;
    drawProjectHeader(projectGroup.projectLabel);

    for (const taskGroup of projectGroup.tasks) {
      ensurePageSpace(16, true);
      page.drawText(taskGroup.taskLabel, {
        x: colItemX,
        y,
        size: 10,
        font: fontRegular,
        color: textColor,
        maxWidth: colQtyX - colItemX - 8,
      });
      page.drawText(`${taskGroup.totalHours.toFixed(2)}h`, {
        x: colQtyX,
        y,
        size: 10,
        font: fontRegular,
        color: textColor,
      });
      page.drawText(`$${invoice.hourlyRate.toFixed(2)}`, {
        x: colRateX,
        y,
        size: 10,
        font: fontRegular,
        color: textColor,
      });
      drawRightText(page, `$${taskGroup.totalAmount.toFixed(2)}`, amountRightX, y, 10);
      y -= 13;

      ensurePageSpace(14, true);
      page.drawText('Start', {
        x: detailStartX,
        y,
        size: 7.5,
        font: fontBold,
        color: mutedText,
      });
      page.drawText('End', {
        x: detailEndX,
        y,
        size: 7.5,
        font: fontBold,
        color: mutedText,
      });
      drawRightText(page, 'Hrs', detailHoursRightX, y, 7.5, true, mutedText);
      drawRightText(page, '$', amountRightX, y, 7.5, true, mutedText);
      y -= 10;

      for (const [sessionIndex, session] of taskGroup.sessions.entries()) {
        const sessionBreaks = invoice.breaksBySessionId?.[session.id] ?? [];
        const timelineRows = deriveSessionTimelineRows({
          session,
          breaks: sessionBreaks,
          hourlyRate: invoice.hourlyRate,
        });
        const highlightSession = sessionIndex % 2 === 0;

        for (const row of timelineRows) {
          ensurePageSpace(11, true);
          if (highlightSession) {
            page.drawRectangle({
              x: detailStartX - 2,
              y: y - 1.5,
              width: amountRightX - detailStartX + 2,
              height: 10.5,
              color: alternatingRowColor,
            });
          }

          page.drawText(formatDateTimeEST(row.start_time), {
            x: detailStartX,
            y,
            size: 7.5,
            font: fontRegular,
            color: row.isBreak ? secondaryColor : mutedText,
          });
          page.drawText(formatDateTimeEST(row.end_time), {
            x: detailEndX,
            y,
            size: 7.5,
            font: fontRegular,
            color: row.isBreak ? secondaryColor : mutedText,
          });
          if (row.isBreak) {
            drawRightText(page, 'Break', detailHoursRightX, y, 7.5, true, secondaryColor);
            drawRightText(page, '-', amountRightX, y, 7.5, false, secondaryColor);
          } else {
            drawRightText(page, row.hours.toFixed(2), detailHoursRightX, y, 7.5, false, mutedText);
            drawRightText(page, row.amount.toFixed(2), amountRightX, y, 7.5, false, mutedText);
          }
          y -= 10;
        }

        if (session.commit_sha) {
          const commitText = `Commit: ${shortCommitSha(session.commit_sha)}`;
          const commitTextSize = 7.5;
          const commitX = detailStartX + 2;
          ensurePageSpace(10, true);
          const commitY = y;
          page.drawText(commitText, {
            x: commitX,
            y: commitY,
            size: commitTextSize,
            font: fontRegular,
            color: secondaryColor,
          });

          if (session.commit_url) {
            addLinkAnnotation({
              targetPage: page,
              x: commitX,
              y: commitY - 1.25,
              width: fontRegular.widthOfTextAtSize(commitText, commitTextSize),
              height: commitTextSize + 2.5,
              url: session.commit_url,
            });
          }
          y -= 10;
        }

        if (session.notes) {
          drawWrappedText(`Note: ${session.notes}`, {
            x: detailStartX + 2,
            size: 7.5,
            maxWidth: contentWidth - 28,
            lineHeight: 10,
            color: mutedText,
          });
        }
        y -= 2;
      }

      y -= 2;
    }

    ensurePageSpace(30, true);
    page.drawLine({
      start: { x: margin, y: y + 6 },
      end: { x: margin + contentWidth, y: y + 6 },
      thickness: 0.8,
      color: dividerColor,
    });
    y -= 8;
    drawRightText(page, `Project hours: ${projectGroup.totalHours.toFixed(2)}`, amountRightX, y, 9, true, mutedText);
    y -= 13;
    drawRightText(page, `Project amount: $${projectGroup.totalAmount.toFixed(2)}`, amountRightX, y, 10, true, textColor);
    y -= 18;
  }

  activeProjectLabel = null;
  ensurePageSpace(60);
  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: margin + contentWidth, y: y + 4 },
    thickness: 1,
    color: dividerColor,
  });
  y -= 16;

  drawRightText(page, `Grand total hours: ${invoice.totalHours.toFixed(2)}`, amountRightX, y, 11, true);
  y -= 20;
  drawRightText(page, `Grand total amount: $${invoice.totalAmount.toFixed(2)}`, amountRightX, y, 14, true);

  if (invoice.paymentLink) {
    y -= 24;
    drawWrappedText(`Payment link: ${invoice.paymentLink}`, {
      x: margin,
      size: 9,
      maxWidth: contentWidth,
      lineHeight: 12,
      color: mutedText,
    });
  }

  return await pdfDoc.save();
}
