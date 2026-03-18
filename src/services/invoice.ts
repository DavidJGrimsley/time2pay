import {
  assignSessionsToInvoice,
  createInvoiceSessionLinks,
  createInvoice,
  type InvoiceSessionLinkMode,
  type InvoiceType,
  type MilestoneAmountType,
  type MilestoneCompletionMode,
  type SessionBreak,
  listSessions,
  type Invoice,
  type Session,
} from '@/database/db';
import {
  createMercuryInvoice,
  type MercuryInvoiceResponse,
  type MercuryLineItemPayload,
  type MercurySendEmailOption,
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

export type MilestoneInvoiceComputation = {
  totalAmount: number;
  linkedSessionCount: number;
  linkedSessions: SessionWithComputed[];
  sessionLinkMode: InvoiceSessionLinkMode | null;
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
    amount?: number;
    currency?: string;
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
};

export type ExportableInvoice = {
  invoiceId: string;
  invoiceType?: InvoiceType;
  issuedAtIso: string;
  hourlyRate: number;
  sessions: SessionWithComputed[];
  includeSessionAppendix?: boolean;
  sessionLinkMode?: InvoiceSessionLinkMode | null;
  milestoneSummary?: {
    projectName: string;
    milestoneTitle: string;
    amountType: MilestoneAmountType;
    amountValue: number;
    completionMode: MilestoneCompletionMode;
    completedAtIso?: string | null;
  } | null;
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

export type CreateMilestoneInvoiceInput = {
  invoiceId: string;
  clientId: string;
  projectId: string;
  projectName: string;
  projectTotalFee: number | null;
  milestoneId: string;
  milestoneTitle: string;
  milestoneAmountType: MilestoneAmountType;
  milestoneAmountValue: number;
  milestoneCompletionMode: MilestoneCompletionMode;
  milestoneCompletedAtIso?: string | null;
  sessionIds?: string[];
  markAttachedSessionsInvoiced?: boolean;
  hourlyRateForSessionAppendix?: number;
  status?: Invoice['status'];
  mercury?: CreateInvoiceFromSessionsInput['mercury'];
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

function toIsoDay(input: Date): string {
  return input.toISOString().slice(0, 10);
}

export function buildNet7DueDateIso(baseDate = new Date()): string {
  const dueDate = new Date(baseDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + 7);
  return toIsoDay(dueDate);
}

export function computeMilestoneInvoiceAmount(input: {
  amountType: MilestoneAmountType;
  amountValue: number;
  projectTotalFee: number | null;
}): number {
  if (!Number.isFinite(input.amountValue) || input.amountValue < 0) {
    throw new Error('Milestone amount must be a non-negative number.');
  }

  if (input.amountType === 'fixed') {
    return toMoney(input.amountValue);
  }

  if (input.amountType !== 'percent') {
    throw new Error('Invalid milestone amount type.');
  }

  if (input.projectTotalFee === null || !Number.isFinite(input.projectTotalFee) || input.projectTotalFee < 0) {
    throw new Error('Project total fee is required for percent-based milestones.');
  }

  return toMoney((input.projectTotalFee * input.amountValue) / 100);
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

function sanitizeSingleLineText(value: string | null | undefined): string {
  return `${value ?? ''}`
    .replace(/\r\n?/g, ' ')
    .replace(/\u2028|\u2029/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatMercurySessionDate(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return sanitizeSingleLineText(isoString);
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatMercurySessionTime(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return sanitizeSingleLineText(isoString);
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatMercurySessionWindow(session: SessionWithComputed): string {
  const startLabel = formatMercurySessionDate(session.start_time);
  if (!session.end_time) {
    return startLabel;
  }

  return `${startLabel} ${formatMercurySessionTime(session.start_time)}-${formatMercurySessionTime(session.end_time)}`;
}

function summarizeLabels(labels: string[], maxCount: number, fallback: string): string {
  if (labels.length === 0) {
    return fallback;
  }

  if (labels.length <= maxCount) {
    return labels.join(', ');
  }

  return `${labels.slice(0, maxCount).join(', ')} +${labels.length - maxCount} more`;
}

function normalizePdfText(
  value: string | null | undefined,
  options?: { preserveNewlines?: boolean },
): string {
  let normalized = `${value ?? ''}`
    .replace(/\r\n?/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

  if (options?.preserveNewlines) {
    return normalized
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  normalized = normalized.replace(/\n+/g, ' ');
  return normalized.trim();
}

export function buildMercuryInvoiceDescriptionFromSessions(
  sessions: SessionWithComputed[],
): string {
  if (sessions.length === 0) {
    return 'Invoice generated with Time2Pay.';
  }

  const sortedSessions = [...sessions].sort((left, right) =>
    left.start_time < right.start_time ? -1 : 1,
  );
  const firstSession = sortedSessions[0];
  const lastSession = sortedSessions[sortedSessions.length - 1];
  const firstDateLabel = formatMercurySessionDate(firstSession.start_time);
  const lastDateLabel = formatMercurySessionDate(lastSession.start_time);
  const rangeLabel =
    firstDateLabel === lastDateLabel ? firstDateLabel : `${firstDateLabel} - ${lastDateLabel}`;

  const projectLabels = Array.from(
    new Set(
      sortedSessions
        .map((session) => sanitizeSingleLineText(session.project_name ?? session.project_id))
        .filter(Boolean),
    ),
  );
  const taskLabels = Array.from(
    new Set(
      sortedSessions
        .map((session) => sanitizeSingleLineText(session.task_name ?? session.task_id))
        .filter(Boolean),
    ),
  );

  const projectPrefix = projectLabels.length === 1 ? 'Project' : 'Projects';
  const taskPrefix = taskLabels.length === 1 ? 'task including' : 'tasks including';

  return truncateText(
    `Service period: ${rangeLabel}. ${projectPrefix}: ${summarizeLabels(projectLabels, 3, 'General work')}; ${taskPrefix} ${summarizeLabels(taskLabels, 6, 'session work')}. Invoice generated with Time2Pay.`,
    280,
  );
}

export function buildMercuryServicePeriodFromSessions(sessions: SessionWithComputed[]): {
  startDate: string | undefined;
  endDate: string | undefined;
} {
  if (sessions.length === 0) {
    return {
      startDate: undefined,
      endDate: undefined,
    };
  }

  const sortedSessions = [...sessions].sort((left, right) =>
    left.start_time < right.start_time ? -1 : 1,
  );

  return {
    startDate: sortedSessions[0]?.start_time.slice(0, 10),
    endDate: sortedSessions[sortedSessions.length - 1]?.start_time.slice(0, 10),
  };
}

export function buildMercurySessionLineItems(
  sessions: SessionWithComputed[],
  hourlyRate: number,
): MercuryLineItemPayload[] {
  assertNonNegativeFinite(hourlyRate, 'hourlyRate');

  return [...sessions]
    .sort((left, right) => (left.start_time < right.start_time ? -1 : 1))
    .filter((session) => session.hours > 0)
    .map((session) => {
      const projectLabel = sanitizeSingleLineText(
        session.project_name ?? session.project_id ?? 'Uncategorized project',
      );
      const taskLabel = sanitizeSingleLineText(
        session.task_name ?? session.task_id ?? 'Uncategorized task',
      );
      const noteLabel = truncateText(sanitizeSingleLineText(session.notes), 110);
      const commitLabel = session.commit_sha ? `Commit ${shortCommitSha(session.commit_sha)}` : null;
      const nameParts = [
        formatMercurySessionWindow(session),
        projectLabel,
        taskLabel,
        noteLabel ? `Notes: ${noteLabel}` : null,
        commitLabel,
      ].filter((part): part is string => Boolean(part));

      return {
        name: truncateText(nameParts.join(' | '), 240),
        quantity: session.hours,
        unitPrice: toMoney(hourlyRate),
      };
    });
}

export function buildMercuryMilestoneLineItems(input: {
  projectName: string;
  milestoneTitle: string;
  amount: number;
}): MercuryLineItemPayload[] {
  const safeProject = sanitizeSingleLineText(input.projectName) || 'Project';
  const safeMilestone = sanitizeSingleLineText(input.milestoneTitle) || 'Milestone';
  return [
    {
      name: truncateText(`Milestone: ${safeProject} - ${safeMilestone}`, 240),
      quantity: 1,
      unitPrice: toMoney(input.amount),
    },
  ];
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
    const mercuryLineItems: MercuryLineItemPayload[] =
      input.mercury.lineItems && input.mercury.lineItems.length > 0
        ? input.mercury.lineItems
        : buildMercurySessionLineItems(totals.sessions, input.hourlyRate);

    try {
      mercuryInvoice = await createMercuryInvoice({
        customerName: input.mercury.customerName,
        customerEmail: input.mercury.customerEmail,
        amount: input.mercury.amount ?? totals.totalAmount,
        currency: input.mercury.currency ?? 'USD',
        description:
          input.mercury.description ?? buildMercuryInvoiceDescriptionFromSessions(totals.sessions),
        dueDateIso: input.mercury.dueDateIso,
        invoiceDateIso: input.mercury.invoiceDateIso,
        servicePeriodStartDate: input.mercury.servicePeriodStartDate,
        servicePeriodEndDate: input.mercury.servicePeriodEndDate,
        destinationAccountId: input.mercury.destinationAccountId,
        lineItems: mercuryLineItems,
        sendEmailOption: input.mercury.sendEmailOption,
        achDebitEnabled: input.mercury.achDebitEnabled,
        creditCardEnabled: input.mercury.creditCardEnabled,
        useRealAccountNumber: input.mercury.useRealAccountNumber,
        ccEmails: input.mercury.ccEmails,
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
    invoice_type: 'hourly',
    payment_link: mercuryInvoice?.hosted_url ?? input.paypalLink ?? null,
    mercury_invoice_id: mercuryInvoice?.id ?? null,
  });

  const sessionIds = selected.map((session) => session.id);
  await assignSessionsToInvoice(sessionIds, input.invoiceId);
  await createInvoiceSessionLinks({
    invoiceId: input.invoiceId,
    sessionIds,
    linkMode: 'billed',
  });

  return {
    ...totals,
    mercuryInvoice,
    mercuryWarning,
  };
}

export async function createMilestoneInvoice(
  input: CreateMilestoneInvoiceInput,
): Promise<MilestoneInvoiceComputation> {
  const milestoneAmount = computeMilestoneInvoiceAmount({
    amountType: input.milestoneAmountType,
    amountValue: input.milestoneAmountValue,
    projectTotalFee: input.projectTotalFee,
  });
  const selectedSessionIds = Array.from(new Set((input.sessionIds ?? []).filter(Boolean)));

  const allSessions = await listSessions();
  const linkedSessions = allSessions.filter((session) => selectedSessionIds.includes(session.id));
  if (linkedSessions.length !== selectedSessionIds.length) {
    throw new Error('One or more selected sessions could not be found.');
  }

  const sessionTotals = computeInvoiceTotals(linkedSessions, input.hourlyRateForSessionAppendix ?? 0);
  const sessionLinkMode: InvoiceSessionLinkMode | null =
    selectedSessionIds.length === 0
      ? null
      : input.markAttachedSessionsInvoiced === false
        ? 'context'
        : 'billed';

  let mercuryInvoice: MercuryInvoiceResponse | undefined;
  let mercuryWarning: string | undefined;
  if (input.mercury?.enabled) {
    const invoiceDateIso = input.mercury.invoiceDateIso ?? toIsoDay(new Date());
    const dueDateIso = input.mercury.dueDateIso ?? buildNet7DueDateIso();
    const lineItems =
      input.mercury.lineItems && input.mercury.lineItems.length > 0
        ? input.mercury.lineItems
        : buildMercuryMilestoneLineItems({
            projectName: input.projectName,
            milestoneTitle: input.milestoneTitle,
            amount: input.mercury.amount ?? milestoneAmount,
          });
    const description =
      input.mercury.description ??
      `Milestone invoice for ${sanitizeSingleLineText(input.projectName)} - ${sanitizeSingleLineText(input.milestoneTitle)}.`;

    try {
      mercuryInvoice = await createMercuryInvoice({
        customerName: input.mercury.customerName,
        customerEmail: input.mercury.customerEmail,
        amount: input.mercury.amount ?? milestoneAmount,
        currency: input.mercury.currency ?? 'USD',
        description,
        dueDateIso,
        invoiceDateIso,
        servicePeriodStartDate: input.mercury.servicePeriodStartDate,
        servicePeriodEndDate: input.mercury.servicePeriodEndDate,
        destinationAccountId: input.mercury.destinationAccountId,
        lineItems,
        sendEmailOption: input.mercury.sendEmailOption,
        achDebitEnabled: input.mercury.achDebitEnabled,
        creditCardEnabled: input.mercury.creditCardEnabled,
        useRealAccountNumber: input.mercury.useRealAccountNumber,
        ccEmails: input.mercury.ccEmails,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Unknown Mercury API error';
      mercuryWarning = `Mercury sync skipped: ${reason}`;
    }
  }

  await createInvoice({
    id: input.invoiceId,
    client_id: input.clientId,
    total: milestoneAmount,
    status: input.status ?? 'draft',
    invoice_type: 'milestone',
    payment_link: mercuryInvoice?.hosted_url ?? null,
    mercury_invoice_id: mercuryInvoice?.id ?? null,
    source_project_id: input.projectId,
    source_project_name: input.projectName,
    source_milestone_id: input.milestoneId,
    source_milestone_title: input.milestoneTitle,
    source_milestone_amount_type: input.milestoneAmountType,
    source_milestone_amount_value: input.milestoneAmountValue,
    source_milestone_completion_mode: input.milestoneCompletionMode,
    source_milestone_completed_at: input.milestoneCompletedAtIso ?? null,
    source_session_link_mode: sessionLinkMode,
  });

  if (selectedSessionIds.length > 0 && sessionLinkMode) {
    await createInvoiceSessionLinks({
      invoiceId: input.invoiceId,
      sessionIds: selectedSessionIds,
      linkMode: sessionLinkMode,
    });

    if (sessionLinkMode === 'billed') {
      await assignSessionsToInvoice(selectedSessionIds, input.invoiceId);
    }
  }

  return {
    totalAmount: milestoneAmount,
    linkedSessionCount: selectedSessionIds.length,
    linkedSessions: sessionTotals.sessions,
    sessionLinkMode,
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

  const isMilestoneInvoice = invoice.invoiceType === 'milestone';
  const includeSessionAppendix = isMilestoneInvoice
    ? (invoice.includeSessionAppendix ?? invoice.sessions.length > 0)
    : true;
  const projectLineItems = includeSessionAppendix ? groupInvoiceLineItemsByProject(invoice.sessions) : [];
  const senderDisplayName = normalizePdfText(
    invoice.sender.companyName?.trim() ||
      invoice.sender.fullName?.trim() ||
      'Your Business Name',
  );
  const senderLines = [
    invoice.sender.companyName?.trim() && invoice.sender.fullName?.trim()
      ? invoice.sender.fullName.trim()
      : null,
    invoice.sender.phone?.trim() || null,
    invoice.sender.email?.trim() || null,
  ]
    .map((line) => normalizePdfText(line))
    .filter((line): line is string => Boolean(line));
  const recipientLines = [
    invoice.recipient.companyName.trim(),
    invoice.recipient.phone?.trim() || null,
    invoice.recipient.email?.trim() || null,
  ]
    .map((line) => normalizePdfText(line))
    .filter((line): line is string => Boolean(line));

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
    const safeText = normalizePdfText(text);
    if (!safeText) {
      return;
    }

    const font = bold ? fontBold : fontRegular;
    const width = font.widthOfTextAtSize(safeText, size);
    targetPage.drawText(safeText, {
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
    const safeProjectLabel = normalizePdfText(projectLabel);
    const title = continuation
      ? `Project: ${safeProjectLabel} (cont.)`
      : `Project: ${safeProjectLabel}`;
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
    const normalized = normalizePdfText(text, { preserveNewlines: true });
    if (!normalized) {
      return;
    }

    for (const paragraph of normalized.split('\n')) {
      const words = paragraph.split(' ');
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

  if (isMilestoneInvoice && invoice.milestoneSummary) {
    ensurePageSpace(94);
    page.drawRectangle({
      x: margin,
      y: y - 78,
      width: contentWidth,
      height: 82,
      color: tableHeaderColor,
    });
    page.drawText('Milestone summary', {
      x: margin + 10,
      y: y - 12,
      size: 11,
      font: fontBold,
      color: textColor,
    });
    const amountLabel =
      invoice.milestoneSummary.amountType === 'percent'
        ? `${invoice.milestoneSummary.amountValue.toFixed(2)}% of project fee`
        : `$${invoice.milestoneSummary.amountValue.toFixed(2)} fixed amount`;
    const summaryLines = [
      `Project: ${invoice.milestoneSummary.projectName}`,
      `Milestone: ${invoice.milestoneSummary.milestoneTitle}`,
      `Pricing: ${amountLabel}`,
      `Completion mode: ${invoice.milestoneSummary.completionMode}`,
      invoice.milestoneSummary.completedAtIso
        ? `Completed: ${formatDateEST(invoice.milestoneSummary.completedAtIso)}`
        : null,
      invoice.sessionLinkMode
        ? `Attached session mode: ${invoice.sessionLinkMode}`
        : 'No sessions attached',
    ].filter((line): line is string => Boolean(line));
    for (const [index, line] of summaryLines.entries()) {
      page.drawText(normalizePdfText(line), {
        x: margin + 10,
        y: y - 28 - index * 11,
        size: 9,
        font: fontRegular,
        color: mutedText,
      });
    }
    drawRightText(page, `Milestone total: $${invoice.totalAmount.toFixed(2)}`, amountRightX, y - 12, 10, true);
    y -= 92;
  }

  if (includeSessionAppendix && projectLineItems.length > 0) {
    ensurePageSpace(18);
    page.drawText(isMilestoneInvoice ? 'Session appendix' : 'Session details', {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: textColor,
    });
    y -= 16;
  }

  for (const projectGroup of projectLineItems) {
    activeProjectLabel = projectGroup.projectLabel;
    drawProjectHeader(projectGroup.projectLabel);

    for (const taskGroup of projectGroup.tasks) {
      ensurePageSpace(16, true);
      page.drawText(normalizePdfText(taskGroup.taskLabel), {
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
          const commitText = normalizePdfText(`Commit: ${shortCommitSha(session.commit_sha)}`);
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

  if (!isMilestoneInvoice) {
    drawRightText(page, `Grand total hours: ${invoice.totalHours.toFixed(2)}`, amountRightX, y, 11, true);
    y -= 20;
    drawRightText(page, `Grand total amount: $${invoice.totalAmount.toFixed(2)}`, amountRightX, y, 14, true);
  } else {
    if (includeSessionAppendix && invoice.sessions.length > 0) {
      drawRightText(page, `Appendix hours: ${invoice.totalHours.toFixed(2)}`, amountRightX, y, 10, true, mutedText);
      y -= 16;
    }
    drawRightText(page, `Milestone amount due: $${invoice.totalAmount.toFixed(2)}`, amountRightX, y, 14, true);
  }

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
