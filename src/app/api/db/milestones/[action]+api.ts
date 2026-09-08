import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import {
  createMilestone,
  deleteMilestone,
  setMilestoneCompletion,
  updateMilestone,
} from '@/server/db/_queries/milestones';
import { projectMilestoneInsertSchema } from '@/database/hosted/milestones/schema';

const amountTypeSchema = z.enum(['percent', 'fixed']);
const completionModeSchema = z.enum(['toggle', 'checklist']);

const createMilestoneSchema = projectMilestoneInsertSchema
  .pick({
    id: true,
    projectId: true,
    title: true,
    amountType: true,
    amountValue: true,
    completionMode: true,
    dueNote: true,
    sortOrder: true,
  })
  .extend({
    amountType: amountTypeSchema,
    amountValue: z.coerce.number().min(0),
    completionMode: completionModeSchema,
    sortOrder: z.coerce.number().int(),
  })
  .strict();

const updateMilestoneSchema = projectMilestoneInsertSchema
  .pick({
    id: true,
    title: true,
    amountType: true,
    amountValue: true,
    completionMode: true,
    dueNote: true,
    sortOrder: true,
  })
  .extend({
    amountType: amountTypeSchema,
    amountValue: z.coerce.number().min(0),
    completionMode: completionModeSchema,
    sortOrder: z.coerce.number().int(),
  })
  .strict();

const deleteMilestoneSchema = z.object({
  milestoneId: z.string().min(1),
}).strict();

const setCompletionSchema = z.object({
  milestoneId: z.string().min(1),
  isCompleted: z.boolean(),
  completedAt: z.string().nullable().optional(),
}).strict();

function getRequestAction(request: Request, params?: { action?: string }): string | undefined {
  const routeAction = params?.action;
  if (typeof routeAction === 'string' && routeAction.trim()) {
    return routeAction;
  }

  try {
    const lastPathSegment = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
    return lastPathSegment && lastPathSegment !== 'db' ? lastPathSegment : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(
  request: Request,
  { params }: { params?: { action?: string } },
): Promise<Response> {
  const action = getRequestAction(request, params);

  switch (action) {
    case 'create':
      return handleDbWrite(request, createMilestoneSchema, createMilestone);
    case 'update':
      return handleDbWrite(request, updateMilestoneSchema, updateMilestone);
    case 'delete':
      return handleDbWrite(request, deleteMilestoneSchema, deleteMilestone);
    case 'set-completion':
      return handleDbWrite(request, setCompletionSchema, setMilestoneCompletion);
    default:
      return Response.json(
        { error: `Unsupported milestones action: ${action ?? 'unknown'}` },
        { status: 404 },
      );
  }
}
