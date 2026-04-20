import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/server/db/_shared/db';
import { deleteSession, stopSession } from '@/server/db/_queries/sessions';

type Query = ReturnType<typeof sql>;

type SessionRow = {
  id: string;
  start_time: string;
  end_time: string | null;
  deleted_at?: string | null;
};

type SessionBreakRow = {
  id: string;
  start_time: string;
  end_time: string | null;
  deleted_at?: string | null;
};

function queryParts(query: Query): { sql: string; params: unknown[] } {
  const chunks = (query as unknown as { queryChunks?: unknown[] }).queryChunks ?? [];
  const params: unknown[] = [];
  const sqlText = chunks
    .map((chunk) => {
      if (chunk && typeof chunk === 'object' && 'value' in (chunk as { value?: unknown })) {
        const value = (chunk as { value?: unknown }).value;
        return Array.isArray(value) ? value.join('') : String(value ?? '');
      }
      params.push(chunk);
      return '?';
    })
    .join('');
  return { sql: sqlText, params };
}

class MockTx {
  session: SessionRow;
  breaks: SessionBreakRow[];
  sessionUpdate?: { sql: string; params: unknown[] };

  constructor(session: SessionRow, breaks: SessionBreakRow[]) {
    this.session = session;
    this.breaks = breaks;
  }

  async execute(query: Query): Promise<{ rows: unknown[] }> {
    const { sql: text, params } = queryParts(query);

    if (text.includes('from sessions') && text.includes('limit 1')) {
      return { rows: [this.session] };
    }

    if (text.includes('update session_breaks')) {
      const [endTimeParam, , breakId] = params as [string, string, string];
      const target = this.breaks.find((row) => row.id === breakId);
      if (target) {
        target.end_time = endTimeParam;
        return { rows: [{ id: breakId }] };
      }
      return { rows: [] };
    }

    if (text.includes('from session_breaks') && text.includes('end_time is null')) {
      const openBreaks = this.breaks
        .filter((row) => (row.deleted_at ?? null) === null && row.end_time === null)
        .sort((a, b) => b.start_time.localeCompare(a.start_time));
      return { rows: openBreaks.slice(0, 1) };
    }

    if (text.includes('from session_breaks')) {
      return {
        rows: this.breaks.filter((row) => (row.deleted_at ?? null) === null),
      };
    }

    if (text.includes('update sessions')) {
      this.sessionUpdate = { sql: text, params };
      return { rows: [{ id: this.session.id }] };
    }

    throw new Error(`Unhandled SQL: ${text}`);
  }
}

class MockDb {
  tx: unknown;

  constructor(tx: unknown) {
    this.tx = tx;
  }

  async transaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work(this.tx);
  }
}

class MockDeleteSessionTx {
  session: {
    id: string;
    end_time: string | null;
    invoice_id: string | null;
    deleted_at?: string | null;
  } | null;
  links: { id: string }[];
  breaks: Array<SessionBreakRow & { updated_at?: string | null }>;

  constructor(input: {
    session: MockDeleteSessionTx['session'];
    links?: { id: string }[];
    breaks?: Array<SessionBreakRow & { updated_at?: string | null }>;
  }) {
    this.session = input.session;
    this.links = input.links ?? [];
    this.breaks = input.breaks ?? [];
  }

  async execute(query: Query): Promise<{ rows: unknown[] }> {
    const { sql: text, params } = queryParts(query);

    if (text.includes('from sessions') && text.includes('limit 1')) {
      return { rows: this.session && (this.session.deleted_at ?? null) === null ? [this.session] : [] };
    }

    if (text.includes('from invoice_session_links')) {
      return { rows: this.links };
    }

    if (text.includes('update session_breaks')) {
      const [deletedAt, updatedAt] = params as [string, string];
      this.breaks = this.breaks.map((row) =>
        (row.deleted_at ?? null) === null
          ? { ...row, deleted_at: deletedAt, updated_at: updatedAt }
          : row,
      );
      return { rows: [] };
    }

    if (text.includes('update sessions')) {
      if (!this.session || !this.session.end_time || this.session.invoice_id !== null) {
        return { rows: [] };
      }

      const [deletedAt] = params as [string];
      this.session = { ...this.session, deleted_at: deletedAt };
      return { rows: [{ id: this.session.id }] };
    }

    throw new Error(`Unhandled SQL: ${text}`);
  }
}

describe('stopSession (hosted)', () => {
  it('closes open breaks and stores billed duration seconds', async () => {
    const sessionId = 'session_1';
    const endTime = '2024-01-01T11:00:00.000Z';
    const mockTx = new MockTx(
      {
        id: sessionId,
        start_time: '2024-01-01T10:00:00.000Z',
        end_time: null,
        deleted_at: null,
      },
      [
        {
          id: 'break_1',
          start_time: '2024-01-01T10:30:00.000Z',
          end_time: null,
          deleted_at: null,
        },
      ],
    );
    const db = new MockDb(mockTx);

    await stopSession(db as unknown as WriteDb, 'user-1', { id: sessionId, endTime });

    expect(mockTx.breaks[0]?.end_time).toBe(endTime);
    expect(mockTx.sessionUpdate?.params[1]).toBe(1800);
  });

  it('rejects clock out times before an active break start', async () => {
    const sessionId = 'session_2';
    const mockTx = new MockTx(
      {
        id: sessionId,
        start_time: '2024-01-01T10:00:00.000Z',
        end_time: null,
        deleted_at: null,
      },
      [
        {
          id: 'break_1',
          start_time: '2024-01-01T10:30:00.000Z',
          end_time: null,
          deleted_at: null,
        },
      ],
    );
    const db = new MockDb(mockTx);

    await expect(
      stopSession(db as unknown as WriteDb, 'user-2', {
        id: sessionId,
        endTime: '2024-01-01T10:15:00.000Z',
      }),
    ).rejects.toThrow('Cannot clock out before active break start.');
    expect(mockTx.breaks[0]?.end_time).toBeNull();
    expect(mockTx.sessionUpdate).toBeUndefined();
  });
});

describe('deleteSession (hosted)', () => {
  it('soft-deletes a completed uninvoiced session and its breaks', async () => {
    const sessionId = 'session_delete_1';
    const tx = new MockDeleteSessionTx({
      session: {
        id: sessionId,
        end_time: '2024-01-01T11:00:00.000Z',
        invoice_id: null,
        deleted_at: null,
      },
      breaks: [
        {
          id: 'break_delete_1',
          start_time: '2024-01-01T10:30:00.000Z',
          end_time: '2024-01-01T10:45:00.000Z',
          deleted_at: null,
        },
      ],
    });

    await deleteSession(new MockDb(tx) as unknown as WriteDb, 'user-1', { id: sessionId });

    expect(tx.session?.deleted_at).toEqual(expect.any(String));
    expect(tx.breaks[0]?.deleted_at).toEqual(expect.any(String));
  });

  it('blocks invoiced sessions', async () => {
    const tx = new MockDeleteSessionTx({
      session: {
        id: 'session_delete_2',
        end_time: '2024-01-01T11:00:00.000Z',
        invoice_id: 'invoice_1',
        deleted_at: null,
      },
    });

    await expect(
      deleteSession(new MockDb(tx) as unknown as WriteDb, 'user-1', {
        id: 'session_delete_2',
      }),
    ).rejects.toThrow('Invoiced sessions cannot be deleted.');
  });

  it('blocks active sessions', async () => {
    const tx = new MockDeleteSessionTx({
      session: {
        id: 'session_delete_3',
        end_time: null,
        invoice_id: null,
        deleted_at: null,
      },
    });

    await expect(
      deleteSession(new MockDb(tx) as unknown as WriteDb, 'user-1', {
        id: 'session_delete_3',
      }),
    ).rejects.toThrow('Only completed sessions can be deleted.');
  });

  it('blocks sessions attached to invoice history', async () => {
    const tx = new MockDeleteSessionTx({
      session: {
        id: 'session_delete_4',
        end_time: '2024-01-01T11:00:00.000Z',
        invoice_id: null,
        deleted_at: null,
      },
      links: [{ id: 'invoice_link_1' }],
    });

    await expect(
      deleteSession(new MockDb(tx) as unknown as WriteDb, 'user-1', {
        id: 'session_delete_4',
      }),
    ).rejects.toThrow('Sessions attached to invoice history cannot be deleted.');
  });
});
