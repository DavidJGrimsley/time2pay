/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assignSessionsToInvoiceMock,
  createInvoiceSessionLinksMock,
  createInvoiceMilestoneLinksMock,
  createInvoiceMock,
  getProjectMilestoneByIdMock,
  listInvoicesMock,
  listSessionsMock,
  createMercuryInvoiceMock,
} = vi.hoisted(() => ({
  assignSessionsToInvoiceMock: vi.fn(),
  createInvoiceSessionLinksMock: vi.fn(),
  createInvoiceMilestoneLinksMock: vi.fn(),
  createInvoiceMock: vi.fn(),
  getProjectMilestoneByIdMock: vi.fn(),
  listInvoicesMock: vi.fn(),
  listSessionsMock: vi.fn(),
  createMercuryInvoiceMock: vi.fn(),
}));

vi.mock('@/database/db', () => ({
  assignSessionsToInvoice: assignSessionsToInvoiceMock,
  createInvoiceSessionLinks: createInvoiceSessionLinksMock,
  createInvoiceMilestoneLinks: createInvoiceMilestoneLinksMock,
  createInvoice: createInvoiceMock,
  getProjectMilestoneById: getProjectMilestoneByIdMock,
  listInvoices: listInvoicesMock,
  listSessions: listSessionsMock,
}));

vi.mock('@/services/mercury', () => ({
  createMercuryInvoice: createMercuryInvoiceMock,
}));

vi.mock('@/services/github', () => ({
  shortCommitSha: vi.fn((sha: string) => sha.slice(0, 7)),
}));

import {
  createMilestoneInvoice,
  createInvoiceFromSessions,
  buildMercurySessionLineItems,
  buildNet7DueDateIso,
  computeInvoiceTotals,
  computeMilestoneInvoiceAmount,
} from '@/services/invoice';
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
    pr_url: null,
    pr_number: null,
    invoice_id: null,
    created_at: '2026-03-18T10:00:00.000Z',
    updated_at: '2026-03-18T10:50:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  assignSessionsToInvoiceMock.mockReset();
  createInvoiceSessionLinksMock.mockReset();
  createInvoiceMilestoneLinksMock.mockReset();
  createInvoiceMock.mockReset();
  getProjectMilestoneByIdMock.mockReset();
  listInvoicesMock.mockReset();
  listSessionsMock.mockReset();
  createMercuryInvoiceMock.mockReset();
});

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

describe('createMilestoneInvoice', () => {
  function completedMilestone() {
    return {
      id: 'milestone_1',
      project_id: 'project_1',
      title: 'Milestone 1',
      amount_type: 'percent' as const,
      amount_value: 50,
      completion_mode: 'toggle' as const,
      completed_at: '2026-03-18T12:00:00.000Z',
      is_completed: 1,
    };
  }

  it('creates context links without locking sessions when markAttachedSessionsInvoiced is false', async () => {
    listSessionsMock.mockResolvedValue([buildSession()]);
    getProjectMilestoneByIdMock.mockResolvedValue(completedMilestone());
    listInvoicesMock.mockResolvedValue([]);
    createInvoiceMock.mockResolvedValue(undefined);
    createInvoiceSessionLinksMock.mockResolvedValue(undefined);
    assignSessionsToInvoiceMock.mockResolvedValue(undefined);

    await createMilestoneInvoice({
      invoiceId: 'invoice_1',
      clientId: 'client_1',
      projectId: 'project_1',
      projectName: 'Website refresh',
      projectTotalFee: 10000,
      milestoneId: 'milestone_1',
      milestoneTitle: 'Milestone 1',
      milestoneAmountType: 'percent',
      milestoneAmountValue: 50,
      milestoneCompletionMode: 'toggle',
      sessionIds: ['session_1'],
      markAttachedSessionsInvoiced: false,
      hourlyRateForSessionAppendix: 100,
    });

    expect(createInvoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_type: 'milestone',
        source_session_link_mode: 'context',
      }),
    );
    expect(createInvoiceSessionLinksMock).toHaveBeenCalledWith({
      invoiceId: 'invoice_1',
      sessionIds: ['session_1'],
      linkMode: 'context',
    });
    expect(assignSessionsToInvoiceMock).not.toHaveBeenCalled();
  });

  it('marks sessions invoiced when markAttachedSessionsInvoiced is true', async () => {
    listSessionsMock.mockResolvedValue([buildSession()]);
    getProjectMilestoneByIdMock.mockResolvedValue(completedMilestone());
    listInvoicesMock.mockResolvedValue([]);
    createInvoiceMock.mockResolvedValue(undefined);
    createInvoiceSessionLinksMock.mockResolvedValue(undefined);
    assignSessionsToInvoiceMock.mockResolvedValue(undefined);

    await createMilestoneInvoice({
      invoiceId: 'invoice_2',
      clientId: 'client_1',
      projectId: 'project_1',
      projectName: 'Website refresh',
      projectTotalFee: 10000,
      milestoneId: 'milestone_1',
      milestoneTitle: 'Milestone 1',
      milestoneAmountType: 'fixed',
      milestoneAmountValue: 2000,
      milestoneCompletionMode: 'toggle',
      sessionIds: ['session_1'],
      markAttachedSessionsInvoiced: true,
      hourlyRateForSessionAppendix: 100,
    });

    expect(createInvoiceSessionLinksMock).toHaveBeenCalledWith({
      invoiceId: 'invoice_2',
      sessionIds: ['session_1'],
      linkMode: 'billed',
    });
    expect(assignSessionsToInvoiceMock).toHaveBeenCalledWith(['session_1'], 'invoice_2');
  });

  it('rejects billed session attachment when any selected session is already invoiced', async () => {
    listSessionsMock.mockResolvedValue([buildSession({ invoice_id: 'invoice_existing' })]);
    getProjectMilestoneByIdMock.mockResolvedValue(completedMilestone());
    listInvoicesMock.mockResolvedValue([]);
    createInvoiceMock.mockResolvedValue(undefined);
    createInvoiceSessionLinksMock.mockResolvedValue(undefined);
    assignSessionsToInvoiceMock.mockResolvedValue(undefined);

    await expect(
      createMilestoneInvoice({
        invoiceId: 'invoice_3',
        clientId: 'client_1',
        projectId: 'project_1',
        projectName: 'Website refresh',
        projectTotalFee: 10000,
        milestoneId: 'milestone_1',
        milestoneTitle: 'Milestone 1',
        milestoneAmountType: 'fixed',
        milestoneAmountValue: 2000,
        milestoneCompletionMode: 'toggle',
        sessionIds: ['session_1'],
        markAttachedSessionsInvoiced: true,
        hourlyRateForSessionAppendix: 100,
      }),
    ).rejects.toThrow('already invoiced');

    expect(createInvoiceMock).not.toHaveBeenCalled();
    expect(createInvoiceSessionLinksMock).not.toHaveBeenCalled();
    expect(assignSessionsToInvoiceMock).not.toHaveBeenCalled();
  });

  it('rejects an incomplete milestone and an active duplicate draft', async () => {
    getProjectMilestoneByIdMock.mockResolvedValue({ ...completedMilestone(), is_completed: 0 });
    await expect(
      createMilestoneInvoice({
        invoiceId: 'invoice_4', clientId: 'client_1', projectId: 'project_1', projectName: 'Website refresh', projectTotalFee: 10000,
        milestoneId: 'milestone_1', milestoneTitle: 'Milestone 1', milestoneAmountType: 'fixed', milestoneAmountValue: 1, milestoneCompletionMode: 'toggle',
      }),
    ).rejects.toThrow('Complete this milestone');

    getProjectMilestoneByIdMock.mockResolvedValue(completedMilestone());
    listInvoicesMock.mockResolvedValue([{ source_milestone_id: 'milestone_1' }]);
    await expect(
      createMilestoneInvoice({
        invoiceId: 'invoice_5', clientId: 'client_1', projectId: 'project_1', projectName: 'Website refresh', projectTotalFee: 10000,
        milestoneId: 'milestone_1', milestoneTitle: 'Milestone 1', milestoneAmountType: 'fixed', milestoneAmountValue: 1, milestoneCompletionMode: 'toggle',
      }),
    ).rejects.toThrow('already has an active invoice draft');
  });
});

describe('createInvoiceFromSessions with milestone sources', () => {
  it('allows milestone-only drafts and attaches automatic source links', async () => {
    listSessionsMock.mockResolvedValue([]);
    getProjectMilestoneByIdMock.mockResolvedValue({
      id: 'milestone_1', project_id: 'project_1', title: 'Launch', amount_type: 'fixed', amount_value: 750,
      completion_mode: 'toggle', completed_at: '2026-03-18T12:00:00.000Z', is_completed: 1,
    });
    createInvoiceMock.mockResolvedValue(undefined);
    createInvoiceMilestoneLinksMock.mockResolvedValue(undefined);

    const result = await createInvoiceFromSessions({
      invoiceId: 'invoice_milestone_only', clientId: 'client_1', sessionIds: [], hourlyRate: 100,
      milestoneSources: [{ milestoneId: 'milestone_1', projectId: 'project_1', projectName: 'Website', projectTotalFee: null }],
    });

    expect(result.totalAmount).toBe(750);
    expect(createInvoiceMock).toHaveBeenCalledWith(expect.objectContaining({ invoice_type: 'milestone', total: 750 }));
    expect(createInvoiceMilestoneLinksMock).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: 'invoice_milestone_only' }));
  });
});

describe('computeMilestoneInvoiceAmount', () => {
  it('computes fixed milestone amounts directly', () => {
    expect(
      computeMilestoneInvoiceAmount({
        amountType: 'fixed',
        amountValue: 1250,
        projectTotalFee: null,
      }),
    ).toBe(1250);
  });

  it('computes percent milestone amounts from project total fee', () => {
    expect(
      computeMilestoneInvoiceAmount({
        amountType: 'percent',
        amountValue: 25,
        projectTotalFee: 8000,
      }),
    ).toBe(2000);
  });
});

describe('buildNet7DueDateIso', () => {
  it('defaults to seven days after invoice date', () => {
    const base = new Date('2026-03-18T10:00:00.000Z');
    expect(buildNet7DueDateIso(base)).toBe('2026-03-25');
  });
});
