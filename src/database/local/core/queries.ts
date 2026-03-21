import type { CoreDbValidationReport, Session } from '@/database/types';
import {
  buildTestId,
  getCurrentSchemaVersion,
  getDb,
  initializeDatabase,
} from '@/database/local/shared/runtime';
import { createClient } from '@/database/local/clients-projects/queries';
import {
  addManualSession,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
} from '@/database/local/sessions/queries';
import { assignSessionsToInvoice, createInvoice } from '@/database/local/invoices/queries';

export { getDb, initializeDatabase, getCurrentSchemaVersion };

export async function runCoreDbValidationScript(): Promise<CoreDbValidationReport> {
  await initializeDatabase();

  const testClientId = buildTestId('client');
  const timedSessionId = buildTestId('timed_session');
  const manualSessionId = buildTestId('manual_session');
  const invoiceId = buildTestId('invoice');

  const baseTimeMs = Date.now() - 5 * 60_000;
  const timedStart = new Date(baseTimeMs).toISOString();
  const timedEnd = new Date(baseTimeMs + 90_000).toISOString();
  const manualStart = new Date(baseTimeMs + 120_000).toISOString();
  const manualEnd = new Date(baseTimeMs + 180_000).toISOString();

  await createClient({
    id: testClientId,
    name: 'Validation Client',
    email: 'validation@time2pay.local',
    hourly_rate: 100,
  });

  await startSession({
    id: timedSessionId,
    client: 'Validation Client',
    start_time: timedStart,
    notes: 'timed session',
  });

  await stopSession({
    id: timedSessionId,
    end_time: timedEnd,
  });

  const pausedSessionId = buildTestId('paused_session');
  const pausedStart = new Date(baseTimeMs + 200_000).toISOString();
  const pausedEnd = new Date(baseTimeMs + 320_000).toISOString();
  const pausedBreakStart = new Date(baseTimeMs + 240_000).toISOString();
  const pausedBreakEnd = new Date(baseTimeMs + 280_000).toISOString();

  await startSession({
    id: pausedSessionId,
    client: 'Validation Client',
    start_time: pausedStart,
    notes: 'paused session',
  });

  await pauseSession({
    sessionId: pausedSessionId,
    start_time: pausedBreakStart,
  });

  await resumeSession({
    sessionId: pausedSessionId,
    end_time: pausedBreakEnd,
  });

  await stopSession({
    id: pausedSessionId,
    end_time: pausedEnd,
  });

  await addManualSession({
    id: manualSessionId,
    client: 'Validation Client',
    start_time: manualStart,
    end_time: manualEnd,
    notes: 'manual session',
  });

  await createInvoice({
    id: invoiceId,
    client_id: testClientId,
    total: 250,
    status: 'draft',
    payment_link: 'https://paypal.me/example/250',
  });

  await assignSessionsToInvoice([timedSessionId, manualSessionId], invoiceId);

  const db = await getDb();
  const linkedRows = await db.getAllAsync<Pick<Session, 'id' | 'invoice_id'>>(
    'SELECT id, invoice_id FROM sessions WHERE id IN (?, ?)',
    timedSessionId,
    manualSessionId,
  );

  const pausedDurationRow = await db.getFirstAsync<Pick<Session, 'duration'>>(
    'SELECT duration FROM sessions WHERE id = ?',
    pausedSessionId,
  );

  if ((pausedDurationRow?.duration ?? 0) !== 80) {
    throw new Error('Core DB validation failed: paused session duration mismatch');
  }

  const allLinked = linkedRows.length === 2 && linkedRows.every((row) => row.invoice_id === invoiceId);
  if (!allLinked) {
    throw new Error('Core DB validation failed: sessions were not linked to invoice as expected');
  }

  return {
    schemaVersion: await getCurrentSchemaVersion(),
    startedSessionId: timedSessionId,
    manualSessionId,
    invoiceId,
    linkedSessionCount: linkedRows.length,
  };
}
