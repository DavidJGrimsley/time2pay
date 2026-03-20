import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import {
  createMilestone,
  deleteMilestone,
  setMilestoneCompletion,
  updateMilestone,
} from '@/app/api/db/_queries/milestones';

const amountTypeSchema = z.enum(['percent', 'fixed']);
const completionModeSchema = z.enum(['toggle', 'checklist']);

const createMilestoneSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  amountType: amountTypeSchema,
  amountValue: z.number().min(0),
  completionMode: completionModeSchema,
  dueNote: z.string().nullable().optional(),
  sortOrder: z.number().int(),
});

const updateMilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  amountType: amountTypeSchema,
  amountValue: z.number().min(0),
  completionMode: completionModeSchema,
  dueNote: z.string().nullable().optional(),
  sortOrder: z.number().int(),
});

const deleteMilestoneSchema = z.object({
  milestoneId: z.string().min(1),
});

const setCompletionSchema = z.object({
  milestoneId: z.string().min(1),
  isCompleted: z.boolean(),
  completedAt: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { action: string } },
): Promise<Response> {
  switch (params.action) {
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
        { error: `Unsupported milestones action: ${params.action}` },
        { status: 404 },
      );
  }
}
