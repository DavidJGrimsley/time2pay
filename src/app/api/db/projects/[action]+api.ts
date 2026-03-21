import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import { createProject, updateProjectPricing } from '@/app/api/db/_queries/projects';
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

export async function POST(
  request: Request,
  { params }: { params: { action: string } },
): Promise<Response> {
  switch (params.action) {
    case 'create':
      return handleDbWrite(request, createProjectSchema, createProject);
    case 'update-pricing':
      return handleDbWrite(request, updateProjectPricingSchema, updateProjectPricing);
    default:
      return Response.json({ error: `Unsupported projects action: ${params.action}` }, { status: 404 });
  }
}
