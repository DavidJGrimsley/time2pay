import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import { createProject, updateProjectPricing } from '@/app/api/db/_queries/projects';

const pricingModeSchema = z.enum(['hourly', 'milestone']);

const createProjectSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1),
  githubRepo: z.string().nullable().optional(),
  pricingMode: pricingModeSchema.optional(),
  totalProjectFee: z.number().nullable().optional(),
});

const updateProjectPricingSchema = z.object({
  id: z.string().min(1),
  pricingMode: pricingModeSchema,
  totalProjectFee: z.number().nullable(),
});

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
