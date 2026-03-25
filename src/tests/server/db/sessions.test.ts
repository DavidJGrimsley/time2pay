import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/server/db/_shared/db';
import { stopSession } from '@/server/db/_queries/sessions';

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
  tx: MockTx;

  constructor(tx: MockTx) {
    this.tx = tx;
  }

  async transaction<T>(work: (tx: MockTx) => Promise<T>): Promise<T> {
    return work(this.tx);
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
