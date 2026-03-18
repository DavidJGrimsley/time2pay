import { describe, expect, it, vi } from 'vitest';

vi.mock('@/database/db', () => ({
  assignSessionsToInvoice: vi.fn(),
  createInvoice: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock('@/services/mercury', () => ({
  createMercuryInvoice: vi.fn(),
}));

vi.mock('@/services/github', () => ({
  shortCommitSha: vi.fn((sha: string) => sha.slice(0, 7)),
}));

import { buildMercurySessionLineItems, computeInvoiceTotals } from '@/services/invoice';
import type { Session } from '@/database/db';

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session_1',
    client: 'Acme Co',
    client_id: 'client_1',
    project_id: 'project_1',
    task_id: 'task_1',
    project_name: 'Website refresh',
    task_name: 'Implementation',
    start_time: '2026-03-18T10:00:00.000Z',
    end_time: '2026-03-18T10:50:00.000Z',
    duration: 50 * 60,
    notes: 'Polished the checkout flow',
    commit_sha: 'abcdef1234567890',
    invoice_id: null,
    created_at: '2026-03-18T10:00:00.000Z',
    updated_at: '2026-03-18T10:50:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('buildMercurySessionLineItems', () => {
  it('preserves unrounded session hours so Mercury matches local invoice totals', () => {
    const totals = computeInvoiceTotals([buildSession()], 100);

    expect(totals.totalAmount).toBe(83.33);

    const [lineItem] = buildMercurySessionLineItems(totals.sessions, 100);

    expect(lineItem).toMatchObject({
      quantity: totals.sessions[0]?.hours,
      unitPrice: 100,
    });
    expect(lineItem.quantity).toBeCloseTo(50 / 60, 10);
    expect(Number((lineItem.quantity * lineItem.unitPrice).toFixed(2))).toBe(
      totals.sessions[0]?.amount,
    );
  });
});
