import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import { createTask } from '@/app/api/db/_queries/tasks';

const createTaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  githubBranch: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { action: string } },
): Promise<Response> {
  switch (params.action) {
    case 'create':
      return handleDbWrite(request, createTaskSchema, createTask);
    default:
      return Response.json({ error: `Unsupported tasks action: ${params.action}` }, { status: 404 });
  }
}
