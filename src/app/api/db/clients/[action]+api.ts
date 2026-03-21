import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import {
  createClient,
  updateClientContact,
  updateClientHourlyRate,
} from '@/app/api/db/_queries/clients';
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

export async function POST(
  request: Request,
  { params }: { params: { action: string } },
): Promise<Response> {
  switch (params.action) {
    case 'create':
      return handleDbWrite(request, createClientSchema, createClient);
    case 'update-contact':
      return handleDbWrite(request, updateClientContactSchema, updateClientContact);
    case 'update-hourly-rate':
      return handleDbWrite(request, updateClientHourlyRateSchema, updateClientHourlyRate);
    default:
      return Response.json({ error: `Unsupported clients action: ${params.action}` }, { status: 404 });
  }
}
