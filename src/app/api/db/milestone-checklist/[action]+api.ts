import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import {
  createMilestoneChecklistItem,
  updateMilestoneChecklistItem,
} from '@/app/api/db/_queries/milestone-checklist';

const createChecklistSchema = z.object({
  id: z.string().min(1),
  milestoneId: z.string().min(1),
  label: z.string().min(1),
  sortOrder: z.number().int(),
});

const updateChecklistSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sortOrder: z.number().int(),
  isCompleted: z.boolean(),
  completedAt: z.string().nullable().optional(),
});

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
