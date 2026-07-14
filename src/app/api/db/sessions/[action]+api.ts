import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import {
  addManualSession,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
  deleteSession,
  updateSession,
  updateSessionNotes,
} from '@/server/db/_queries/sessions';

const startSessionSchema = z.object({
  id: z.string().min(1),
  client: z.string().min(1),
  clientId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  startTime: z.string().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const stopSessionSchema = z.object({
  id: z.string().min(1),
  endTime: z.string().optional(),
}).strict();

const addManualSessionSchema = z.object({
  id: z.string().min(1),
  client: z.string().min(1),
  clientId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  notes: z.string().nullable().optional(),
}).strict();

const updateSessionSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  notes: z.string().nullable().optional(),
}).strict();

const updateSessionNotesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().nullable(),
  commitSha: z.string().nullable().optional(),
  prUrl: z.string().nullable().optional(),
  prNumber: z.number().int().positive().nullable().optional(),
}).strict();

const deleteSessionSchema = z.object({
  id: z.string().min(1),
}).strict();

const pauseSessionSchema = z.object({
  sessionId: z.string().min(1),
  startTime: z.string().optional(),
}).strict();

const resumeSessionSchema = z.object({
  sessionId: z.string().min(1),
  endTime: z.string().optional(),
}).strict();

export async function POST(
  request: Request,
  { action }: { action: string },
): Promise<Response> {
  switch (action) {
    case 'start':
      return handleDbWrite(request, startSessionSchema, startSession);
    case 'stop':
      return handleDbWrite(request, stopSessionSchema, stopSession);
    case 'add-manual':
      return handleDbWrite(request, addManualSessionSchema, addManualSession);
    case 'update':
      return handleDbWrite(request, updateSessionSchema, updateSession);
    case 'notes':
      return handleDbWrite(request, updateSessionNotesSchema, updateSessionNotes);
    case 'delete':
      return handleDbWrite(request, deleteSessionSchema, deleteSession);
    case 'pause':
      return handleDbWrite(request, pauseSessionSchema, pauseSession);
    case 'resume':
      return handleDbWrite(request, resumeSessionSchema, resumeSession);
    default:
      return Response.json({ error: `Unsupported sessions action: ${action}` }, { status: 404 });
  }
}
