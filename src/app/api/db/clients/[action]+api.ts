import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import {
  createClient,
  updateClientContact,
  updateClientHourlyRate,
} from '@/server/db/_queries/clients';
import { clientInsertSchema } from '@/database/hosted/clients-projects/schema';

const createClientSchema = clientInsertSchema
  .pick({
    id: true,
    name: true,
    email: true,
    phone: true,
    hourlyRate: true,
    githubOrg: true,
  })
  .extend({
    hourlyRate: z.coerce.number().min(0).optional(),
  })
  .strict();

const updateClientContactSchema = clientInsertSchema
  .pick({
    id: true,
    name: true,
    email: true,
    phone: true,
  })
  .strict();

const updateClientHourlyRateSchema = clientInsertSchema
  .pick({
    id: true,
    hourlyRate: true,
  })
  .extend({
    hourlyRate: z.coerce.number().min(0),
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
      return handleDbWrite(request, createClientSchema, createClient);
    case 'update-contact':
      return handleDbWrite(request, updateClientContactSchema, updateClientContact);
    case 'update-hourly-rate':
      return handleDbWrite(request, updateClientHourlyRateSchema, updateClientHourlyRate);
    default:
      return Response.json({ error: `Unsupported clients action: ${action ?? 'unknown'}` }, { status: 404 });
  }
}
