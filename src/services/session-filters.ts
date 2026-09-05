import type { Session } from '@/database/db';

export type SessionPeriodFilter = 'all' | 'this-week' | 'last-week' | 'last-4-weeks';

export type SessionPeriodOption = {
  id: SessionPeriodFilter;
  label: string;
};

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function filterSessionsForToolbar(input: {
  sessions: Session[];
  clientId: string | null;
  projectId: string | null;
  period: SessionPeriodFilter;
  now?: Date;
}): Session[] {
  const now = input.now ?? new Date();
  const thisWeekStart = startOfWeekMonday(now).getTime();
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const fourWeeksStart = new Date(thisWeekStart);
  fourWeeksStart.setDate(fourWeeksStart.getDate() - 21);

  return input.sessions.filter((session) => {
    if (input.clientId && session.client_id !== input.clientId) return false;
    if (input.projectId && session.project_id !== input.projectId) return false;
    if (input.period === 'all') return true;
    const started = new Date(session.start_time).getTime();
    if (!Number.isFinite(started)) return false;
    if (input.period === 'this-week') return started >= thisWeekStart;
    if (input.period === 'last-week') return started >= lastWeekStart.getTime() && started < thisWeekStart;
    return started >= fourWeeksStart.getTime();
  });
}

export function getAvailableSessionPeriods(input: {
  sessions: Session[];
  clientId: string | null;
  projectId: string | null;
  now?: Date;
}): SessionPeriodOption[] {
  const candidates = (period: SessionPeriodFilter) =>
    filterSessionsForToolbar({ ...input, period }).length > 0;
  const options: SessionPeriodOption[] = [
    { id: 'all', label: 'All time' },
    { id: 'this-week', label: 'This week' },
    { id: 'last-week', label: 'Last week' },
    { id: 'last-4-weeks', label: 'Last 4 weeks' },
  ];
  return options.filter((option) => candidates(option.id));
}
