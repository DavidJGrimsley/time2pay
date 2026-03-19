import * as repository from '@/database/hosted/repository';

export const startSession = repository.startSession;
export const stopSession = repository.stopSession;
export const addManualSession = repository.addManualSession;
export const updateSession = repository.updateSession;
export const listSessions = repository.listSessions;
export const listSessionsByClientAndRange = repository.listSessionsByClientAndRange;
export const listSessionsByProject = repository.listSessionsByProject;
export const updateSessionNotes = repository.updateSessionNotes;

export const listSessionBreaksBySessionId = repository.listSessionBreaksBySessionId;
export const listSessionBreaksBySessionIds = repository.listSessionBreaksBySessionIds;
export const isSessionPaused = repository.isSessionPaused;
export const pauseSession = repository.pauseSession;
export const resumeSession = repository.resumeSession;

