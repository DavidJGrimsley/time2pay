import { handleDbWrite } from '@/server/db/_shared/route';
import { createTask } from '@/server/db/_queries/tasks';
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
  { action }: { action: string },
): Promise<Response> {
  switch (action) {
    case 'create':
      return handleDbWrite(request, createTaskSchema, createTask);
    default:
      return Response.json({ error: `Unsupported tasks action: ${action}` }, { status: 404 });
  }
}
