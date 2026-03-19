import * as legacy from '@/database/local/legacy';

export const startSession = legacy.startSession;
export const stopSession = legacy.stopSession;
export const addManualSession = legacy.addManualSession;
export const updateSession = legacy.updateSession;
export const listSessions = legacy.listSessions;
export const listSessionsByClientAndRange = legacy.listSessionsByClientAndRange;
export const listSessionsByProject = legacy.listSessionsByProject;
export const updateSessionNotes = legacy.updateSessionNotes;

export const listSessionBreaksBySessionId = legacy.listSessionBreaksBySessionId;
export const listSessionBreaksBySessionIds = legacy.listSessionBreaksBySessionIds;
export const isSessionPaused = legacy.isSessionPaused;
export const pauseSession = legacy.pauseSession;
export const resumeSession = legacy.resumeSession;

