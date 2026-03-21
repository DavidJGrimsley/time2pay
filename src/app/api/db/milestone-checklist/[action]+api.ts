import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import {
  createMilestoneChecklistItem,
  updateMilestoneChecklistItem,
} from '@/app/api/db/_queries/milestone-checklist';
import { milestoneChecklistItemInsertSchema } from '@/database/hosted/milestones/schema';

const createChecklistSchema = milestoneChecklistItemInsertSchema
  .pick({
    id: true,
    milestoneId: true,
    label: true,
    sortOrder: true,
  })
  .extend({
    sortOrder: z.coerce.number().int(),
  })
  .strict();

const updateChecklistSchema = milestoneChecklistItemInsertSchema
  .pick({
    id: true,
    label: true,
    sortOrder: true,
    isCompleted: true,
    completedAt: true,
  })
  .extend({
    sortOrder: z.coerce.number().int(),
    isCompleted: z.boolean(),
    completedAt: z.string().nullable().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: { action: string } },
): Promise<Response> {
  switch (params.action) {
    case 'create':
      return handleDbWrite(request, createChecklistSchema, createMilestoneChecklistItem);
    case 'update':
      return handleDbWrite(request, updateChecklistSchema, updateMilestoneChecklistItem);
    default:
      return Response.json(
        { error: `Unsupported milestone-checklist action: ${params.action}` },
        { status: 404 },
      );
  }
}
