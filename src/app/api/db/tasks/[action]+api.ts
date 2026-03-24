import { handleDbWrite } from '@/app/api/db/_shared/route';
import { createTask } from '@/app/api/db/_queries/tasks';
import { taskInsertSchema } from '@/database/hosted/clients-projects/schema';

const createTaskSchema = taskInsertSchema
  .pick({
    id: true,
    projectId: true,
    name: true,
    githubBranch: true,
  })
  .strict();

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
