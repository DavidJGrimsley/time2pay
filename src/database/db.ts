export type SessionRecord = {
  id: string;
  startedAt: string;
  endedAt?: string;
  notes?: string;
};

const sessions: SessionRecord[] = [];

export const db = {
  listSessions(): SessionRecord[] {
    return sessions;
  },
};
