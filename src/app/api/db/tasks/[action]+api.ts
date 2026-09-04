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
      return handleDbWrite(request, createTaskSchema, createTask);
    default:
      return Response.json({ error: `Unsupported tasks action: ${action ?? 'unknown'}` }, { status: 404 });
  }
}
