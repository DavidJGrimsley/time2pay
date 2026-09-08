import { describe, expect, it } from 'vitest';
import { filterSessionsForToolbar, getAvailableSessionPeriods } from '@/services/session-filters';
import type { Session } from '@/database/db';

function session(id: string, overrides: Partial<Session>): Session {
  return {
    id,
    client: 'Acme',
    client_id: 'client_1',
    project_id: 'project_1',
    task_id: null,
    start_time: '2026-09-01T12:00:00.000Z',
    end_time: '2026-09-01T13:00:00.000Z',
    duration: 3600,
    notes: null,
    commit_sha: null,
    pr_url: null,
    pr_number: null,
    invoice_id: null,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-09-01T13:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('session filter toolbar', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');
  const sessions = [
    session('this-week', {}),
    session('last-week', { start_time: '2026-08-26T12:00:00.000Z' }),
    session('other-project', { project_id: 'project_2', start_time: '2026-08-20T12:00:00.000Z' }),
    session('other-client', { client_id: 'client_2', start_time: '2026-08-20T12:00:00.000Z' }),
  ];

  it('composes customer, dependent project, and period filters', () => {
    expect(
      filterSessionsForToolbar({ sessions, clientId: 'client_1', projectId: 'project_1', period: 'last-week', now }).map((row) => row.id),
    ).toEqual(['last-week']);
  });

  it('only exposes recent periods backed by loaded data', () => {
    expect(
      getAvailableSessionPeriods({ sessions: [sessions[0]], clientId: 'client_1', projectId: 'project_1', now }).map((option) => option.id),
    ).toEqual(['all', 'this-week', 'last-4-weeks']);
  });

  it('uses local Monday boundaries and excludes future sessions from current and recent periods', () => {
    const localNow = new Date(2026, 8, 4, 12, 0, 0);
    const boundarySessions = [
      session('monday-start', { start_time: new Date(2026, 7, 31, 0, 0, 0).toISOString() }),
      session('sunday-end', { start_time: new Date(2026, 8, 6, 23, 59, 59).toISOString() }),
      session('next-monday', { start_time: new Date(2026, 8, 7, 0, 0, 0).toISOString() }),
      session('prior-week-sunday', { start_time: new Date(2026, 7, 30, 23, 59, 59).toISOString() }),
    ];

    expect(
      filterSessionsForToolbar({
        sessions: boundarySessions,
        clientId: 'client_1',
        projectId: 'project_1',
        period: 'this-week',
        now: localNow,
      }).map((row) => row.id),
    ).toEqual(['monday-start', 'sunday-end']);
    expect(
      filterSessionsForToolbar({
        sessions: boundarySessions,
        clientId: 'client_1',
        projectId: 'project_1',
        period: 'last-week',
        now: localNow,
      }).map((row) => row.id),
    ).toEqual(['prior-week-sunday']);
    expect(
      filterSessionsForToolbar({
        sessions: boundarySessions,
        clientId: 'client_1',
        projectId: 'project_1',
        period: 'last-4-weeks',
        now: localNow,
      }).map((row) => row.id),
    ).toEqual(['monday-start', 'sunday-end', 'prior-week-sunday']);
  });
});
