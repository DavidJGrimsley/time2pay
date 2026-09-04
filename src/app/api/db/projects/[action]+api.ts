import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import { createProject, updateProjectPricing } from '@/server/db/_queries/projects';
import { projectInsertSchema } from '@/database/hosted/clients-projects/schema';

const pricingModeSchema = z.enum(['hourly', 'milestone']);

const createProjectSchema = projectInsertSchema
  .pick({
    id: true,
    clientId: true,
    name: true,
    githubRepo: true,
    pricingMode: true,
    totalProjectFee: true,
  })
  .extend({
    pricingMode: pricingModeSchema.optional(),
    totalProjectFee: z.coerce.number().nullable().optional(),
  })
  .strict();

const updateProjectPricingSchema = projectInsertSchema
  .pick({
    id: true,
    pricingMode: true,
    totalProjectFee: true,
  })
  .extend({
    pricingMode: pricingModeSchema,
    totalProjectFee: z.coerce.number().nullable(),
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
      return handleDbWrite(request, createProjectSchema, createProject);
    case 'update-pricing':
      return handleDbWrite(request, updateProjectPricingSchema, updateProjectPricing);
    default:
      return Response.json({ error: `Unsupported projects action: ${action ?? 'unknown'}` }, { status: 404 });
  }
}
