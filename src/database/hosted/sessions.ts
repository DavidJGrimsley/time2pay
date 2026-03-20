import * as queries from '@/database/hosted/sessions/queries';

export const startSession = queries.startSession;
export const stopSession = queries.stopSession;
export const addManualSession = queries.addManualSession;
export const updateSession = queries.updateSession;
export const listSessions = queries.listSessions;
export const listSessionsByClientAndRange = queries.listSessionsByClientAndRange;
export const listSessionsByProject = queries.listSessionsByProject;
export const updateSessionNotes = queries.updateSessionNotes;

export const listSessionBreaksBySessionId = queries.listSessionBreaksBySessionId;
export const listSessionBreaksBySessionIds = queries.listSessionBreaksBySessionIds;
export const isSessionPaused = queries.isSessionPaused;
export const pauseSession = queries.pauseSession;
export const resumeSession = queries.resumeSession;

