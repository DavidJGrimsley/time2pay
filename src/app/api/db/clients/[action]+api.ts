import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import {
  createClient,
  updateClientContact,
  updateClientHourlyRate,
} from '@/app/api/db/_queries/clients';

const createClientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  hourlyRate: z.number().min(0).optional(),
  githubOrg: z.string().nullable().optional(),
});

const updateClientContactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
});

const updateClientHourlyRateSchema = z.object({
  id: z.string().min(1),
  hourlyRate: z.number().min(0),
});

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
