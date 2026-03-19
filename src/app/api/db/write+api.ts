import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

type WriteAction =
  | 'client.create'
  | 'client.updateContact'
  | 'client.updateHourlyRate'
  | 'project.create'
  | 'project.updatePricing'
  | 'task.create'
  | 'milestone.create'
  | 'milestone.update'
  | 'milestone.delete'
  | 'milestone.setCompletion'
  | 'milestoneChecklist.create'
  | 'milestoneChecklist.update'
  | 'session.start'
  | 'session.stop'
  | 'session.addManual'
  | 'session.update'
  | 'session.notes'
  | 'session.pause'
  | 'session.resume'
  | 'invoice.create'
  | 'invoice.assignSessions'
  | 'invoiceSessionLinks.upsert';

type WriteBody = {
  action?: WriteAction;
  payload?: Record<string, unknown>;
};

function getSupabaseAuthConfig(): { url: string; anonKey: string } {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    '';

  if (!url || !anonKey) {
    throw new Error('Supabase auth config missing. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_DIRECT_URL?.trim() ??
    process.env.DATABASE_URL?.trim() ??
    '';
  if (!url) {
    throw new Error('DATABASE_DIRECT_URL or DATABASE_URL is required for hosted write routes.');
  }

  return url;
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value.trim();
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid field: ${key}`);
  }
  return value;
}

function readOptionalNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric field: ${key}`);
  }
  return value;
}

function readOptionalBoolean(payload: Record<string, unknown>, key: string): boolean | null {
  const value = payload[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid boolean field: ${key}`);
  }
  return value;
}

function readStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    throw new Error(`Invalid field: ${key}`);
  }

  return value
    .map((item) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid ${key} entry`);
      }
      return item.trim();
    })
    .filter((item) => item.length > 0);
}

function nowIso(): string {
  return new Date().toISOString();
}

function toIsoOrNow(value: string | null): string {
  if (!value) {
    return nowIso();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid ISO timestamp.');
  }
  return parsed.toISOString();
}

async function requireAuthUserId(request: Request): Promise<string> {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (!token) {
    throw new Error('Missing Bearer token.');
  }

  const { url, anonKey } = getSupabaseAuthConfig();
  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new Error('Invalid Supabase session token.');
  }

  return data.user.id;
}

async function parseBody(request: Request): Promise<WriteBody> {
  try {
    return (await request.json()) as WriteBody;
  } catch {
    throw new Error('Invalid JSON request body.');
  }
}

async function runWrite(action: WriteAction, payload: Record<string, unknown>, authUserId: string) {
  const client = postgres(getDatabaseUrl(), { prepare: false });
  const db = drizzle(client);

  try {
    const timestamp = nowIso();

    switch (action) {
      case 'client.create': {
        const id = readString(payload, 'id');
        const name = readString(payload, 'name');
        await db.execute(sql`
          insert into clients (
            id, auth_user_id, name, email, phone, hourly_rate, github_org, created_at, updated_at, deleted_at
          ) values (
            ${id},
            ${authUserId}::uuid,
            ${name},
            ${readOptionalString(payload, 'email')},
            ${readOptionalString(payload, 'phone')},
            ${String(readOptionalNumber(payload, 'hourly_rate') ?? 0)},
            ${readOptionalString(payload, 'github_org')},
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'client.updateContact': {
        const id = readString(payload, 'id');
        const name = readString(payload, 'name');
        await db.execute(sql`
          update clients
          set
            name = ${name},
            email = ${readOptionalString(payload, 'email')},
            phone = ${readOptionalString(payload, 'phone')},
            updated_at = ${timestamp}
          where id = ${id}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'client.updateHourlyRate': {
        const id = readString(payload, 'id');
        const hourlyRate = readOptionalNumber(payload, 'hourly_rate');
        if (hourlyRate === null || hourlyRate < 0) {
          throw new Error('hourly_rate must be a non-negative number.');
        }
        await db.execute(sql`
          update clients
          set hourly_rate = ${String(hourlyRate)}, updated_at = ${timestamp}
          where id = ${id}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'project.create': {
        const id = readString(payload, 'id');
        const clientId = readString(payload, 'client_id');
        const pricingMode = readOptionalString(payload, 'pricing_mode') ?? 'hourly';
        await db.execute(sql`
          insert into projects (
            id, auth_user_id, client_id, name, github_repo, pricing_mode, total_project_fee, created_at, updated_at, deleted_at
          ) values (
            ${id},
            ${authUserId}::uuid,
            ${clientId},
            ${readString(payload, 'name')},
            ${readOptionalString(payload, 'github_repo')},
            ${pricingMode},
            ${readOptionalNumber(payload, 'total_project_fee') !== null ? String(readOptionalNumber(payload, 'total_project_fee') as number) : null},
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'project.updatePricing': {
        const id = readString(payload, 'id');
        const pricingMode = readString(payload, 'pricing_mode');
        const totalProjectFee = readOptionalNumber(payload, 'total_project_fee');
        await db.execute(sql`
          update projects
          set
            pricing_mode = ${pricingMode},
            total_project_fee = ${totalProjectFee !== null ? String(totalProjectFee) : null},
            updated_at = ${timestamp}
          where id = ${id}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'task.create': {
        await db.execute(sql`
          insert into tasks (
            id, auth_user_id, project_id, name, github_branch, created_at, updated_at, deleted_at
          ) values (
            ${readString(payload, 'id')},
            ${authUserId}::uuid,
            ${readString(payload, 'project_id')},
            ${readString(payload, 'name')},
            ${readOptionalString(payload, 'github_branch')},
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'milestone.create': {
        await db.execute(sql`
          insert into project_milestones (
            id, auth_user_id, project_id, title, amount_type, amount_value, completion_mode,
            due_note, sort_order, is_completed, completed_at, created_at, updated_at, deleted_at
          ) values (
            ${readString(payload, 'id')},
            ${authUserId}::uuid,
            ${readString(payload, 'project_id')},
            ${readString(payload, 'title')},
            ${readString(payload, 'amount_type')},
            ${String(readOptionalNumber(payload, 'amount_value') ?? 0)},
            ${readString(payload, 'completion_mode')},
            ${readOptionalString(payload, 'due_note')},
            ${Math.trunc(readOptionalNumber(payload, 'sort_order') ?? 0)},
            false,
            null,
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'milestone.update': {
        await db.execute(sql`
          update project_milestones
          set
            title = ${readString(payload, 'title')},
            amount_type = ${readString(payload, 'amount_type')},
            amount_value = ${String(readOptionalNumber(payload, 'amount_value') ?? 0)},
            completion_mode = ${readString(payload, 'completion_mode')},
            due_note = ${readOptionalString(payload, 'due_note')},
            sort_order = ${Math.trunc(readOptionalNumber(payload, 'sort_order') ?? 0)},
            updated_at = ${timestamp}
          where id = ${readString(payload, 'id')}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'milestone.delete': {
        const milestoneId = readString(payload, 'milestone_id');
        await db.execute(sql`
          update project_milestones
          set deleted_at = ${timestamp}, updated_at = ${timestamp}
          where id = ${milestoneId}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        await db.execute(sql`
          update milestone_checklist_items
          set deleted_at = ${timestamp}, updated_at = ${timestamp}
          where milestone_id = ${milestoneId}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'milestone.setCompletion': {
        const milestoneId = readString(payload, 'milestone_id');
        const isCompleted = readOptionalBoolean(payload, 'is_completed');
        if (isCompleted === null) {
          throw new Error('is_completed is required.');
        }
        const completedAt = isCompleted ? toIsoOrNow(readOptionalString(payload, 'completed_at')) : null;

        await db.execute(sql`
          update project_milestones
          set
            is_completed = ${isCompleted},
            completed_at = ${completedAt},
            updated_at = ${timestamp}
          where id = ${milestoneId}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'milestoneChecklist.create': {
        await db.execute(sql`
          insert into milestone_checklist_items (
            id, auth_user_id, milestone_id, label, sort_order, is_completed, completed_at, created_at, updated_at, deleted_at
          ) values (
            ${readString(payload, 'id')},
            ${authUserId}::uuid,
            ${readString(payload, 'milestone_id')},
            ${readString(payload, 'label')},
            ${Math.trunc(readOptionalNumber(payload, 'sort_order') ?? 0)},
            false,
            null,
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'milestoneChecklist.update': {
        const isCompleted = readOptionalBoolean(payload, 'is_completed');
        const completedAt = isCompleted ? toIsoOrNow(readOptionalString(payload, 'completed_at')) : null;
        await db.execute(sql`
          update milestone_checklist_items
          set
            label = ${readString(payload, 'label')},
            sort_order = ${Math.trunc(readOptionalNumber(payload, 'sort_order') ?? 0)},
            is_completed = ${isCompleted ?? false},
            completed_at = ${completedAt},
            updated_at = ${timestamp}
          where id = ${readString(payload, 'id')}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'session.start': {
        await db.execute(sql`
          insert into sessions (
            id, auth_user_id, client, client_id, project_id, task_id, start_time, end_time,
            duration, notes, commit_sha, invoice_id, created_at, updated_at, deleted_at
          ) values (
            ${readString(payload, 'id')},
            ${authUserId}::uuid,
            ${readString(payload, 'client')},
            ${readOptionalString(payload, 'client_id')},
            ${readOptionalString(payload, 'project_id')},
            ${readOptionalString(payload, 'task_id')},
            ${toIsoOrNow(readOptionalString(payload, 'start_time'))},
            null,
            null,
            ${readOptionalString(payload, 'notes')},
            null,
            null,
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'session.stop': {
        await db.execute(sql`
          update sessions
          set end_time = ${toIsoOrNow(readOptionalString(payload, 'end_time'))}, updated_at = ${timestamp}
          where id = ${readString(payload, 'id')}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
            and end_time is null
        `);
        break;
      }
      case 'session.addManual': {
        const startTime = toIsoOrNow(readOptionalString(payload, 'start_time'));
        const endTime = toIsoOrNow(readOptionalString(payload, 'end_time'));
        const durationSeconds = Math.max(
          0,
          Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000),
        );
        await db.execute(sql`
          insert into sessions (
            id, auth_user_id, client, client_id, project_id, task_id, start_time, end_time,
            duration, notes, commit_sha, invoice_id, created_at, updated_at, deleted_at
          ) values (
            ${readString(payload, 'id')},
            ${authUserId}::uuid,
            ${readString(payload, 'client')},
            ${readOptionalString(payload, 'client_id')},
            ${readOptionalString(payload, 'project_id')},
            ${readOptionalString(payload, 'task_id')},
            ${startTime},
            ${endTime},
            ${durationSeconds},
            ${readOptionalString(payload, 'notes')},
            null,
            null,
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'session.update': {
        await db.execute(sql`
          update sessions
          set
            client_id = ${readString(payload, 'client_id')},
            project_id = ${readString(payload, 'project_id')},
            task_id = ${readString(payload, 'task_id')},
            start_time = ${toIsoOrNow(readOptionalString(payload, 'start_time'))},
            end_time = ${toIsoOrNow(readOptionalString(payload, 'end_time'))},
            notes = ${readOptionalString(payload, 'notes')},
            updated_at = ${timestamp}
          where id = ${readString(payload, 'id')}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'session.notes': {
        await db.execute(sql`
          update sessions
          set
            notes = ${readOptionalString(payload, 'notes')},
            commit_sha = ${readOptionalString(payload, 'commit_sha')},
            updated_at = ${timestamp}
          where id = ${readString(payload, 'id')}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
        `);
        break;
      }
      case 'session.pause': {
        const sessionId = readString(payload, 'session_id');
        await db.execute(sql`
          insert into session_breaks (
            id, auth_user_id, session_id, start_time, end_time, created_at, updated_at, deleted_at
          ) values (
            ${`break_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
            ${authUserId}::uuid,
            ${sessionId},
            ${toIsoOrNow(readOptionalString(payload, 'start_time'))},
            null,
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        await db.execute(sql`
          update sessions
          set updated_at = ${timestamp}
          where id = ${sessionId} and auth_user_id = ${authUserId}::uuid
        `);
        break;
      }
      case 'session.resume': {
        const sessionId = readString(payload, 'session_id');
        const endTime = toIsoOrNow(readOptionalString(payload, 'end_time'));
        await db.execute(sql`
          update session_breaks
          set end_time = ${endTime}, updated_at = ${timestamp}
          where id in (
            select id
            from session_breaks
            where session_id = ${sessionId}
              and auth_user_id = ${authUserId}::uuid
              and deleted_at is null
              and end_time is null
            order by start_time desc
            limit 1
          )
        `);
        await db.execute(sql`
          update sessions
          set updated_at = ${timestamp}
          where id = ${sessionId} and auth_user_id = ${authUserId}::uuid
        `);
        break;
      }
      case 'invoice.create': {
        await db.execute(sql`
          insert into invoices (
            id, auth_user_id, client_id, total, status, invoice_type, mercury_invoice_id, payment_link,
            source_project_id, source_project_name, source_milestone_id, source_milestone_title,
            source_milestone_amount_type, source_milestone_amount_value,
            source_milestone_completion_mode, source_milestone_completed_at, source_session_link_mode,
            source_session_hourly_rate, created_at, updated_at, deleted_at
          ) values (
            ${readString(payload, 'id')},
            ${authUserId}::uuid,
            ${readString(payload, 'client_id')},
            ${String(readOptionalNumber(payload, 'total') ?? 0)},
            ${readOptionalString(payload, 'status') ?? 'draft'},
            ${readOptionalString(payload, 'invoice_type') ?? 'hourly'},
            ${readOptionalString(payload, 'mercury_invoice_id')},
            ${readOptionalString(payload, 'payment_link')},
            ${readOptionalString(payload, 'source_project_id')},
            ${readOptionalString(payload, 'source_project_name')},
            ${readOptionalString(payload, 'source_milestone_id')},
            ${readOptionalString(payload, 'source_milestone_title')},
            ${readOptionalString(payload, 'source_milestone_amount_type')},
            ${readOptionalNumber(payload, 'source_milestone_amount_value') !== null ? String(readOptionalNumber(payload, 'source_milestone_amount_value') as number) : null},
            ${readOptionalString(payload, 'source_milestone_completion_mode')},
            ${readOptionalString(payload, 'source_milestone_completed_at')},
            ${readOptionalString(payload, 'source_session_link_mode')},
            ${readOptionalNumber(payload, 'source_session_hourly_rate') !== null ? String(readOptionalNumber(payload, 'source_session_hourly_rate') as number) : null},
            ${timestamp},
            ${timestamp},
            null
          )
        `);
        break;
      }
      case 'invoice.assignSessions': {
        const invoiceId = readString(payload, 'invoice_id');
        const sessionIds = readStringArray(payload, 'session_ids');
        if (sessionIds.length === 0) {
          break;
        }
        await db.execute(sql`
          update sessions
          set invoice_id = ${invoiceId}, updated_at = ${timestamp}
          where auth_user_id = ${authUserId}::uuid
            and id = any(${sessionIds}::text[])
        `);
        break;
      }
      case 'invoiceSessionLinks.upsert': {
        const invoiceId = readString(payload, 'invoice_id');
        const sessionIds = readStringArray(payload, 'session_ids');
        const linkMode = readString(payload, 'link_mode');
        for (const sessionId of sessionIds) {
          await db.execute(sql`
            insert into invoice_session_links (
              id, auth_user_id, invoice_id, session_id, link_mode, created_at, updated_at
            ) values (
              ${`invoice_session_link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
              ${authUserId}::uuid,
              ${invoiceId},
              ${sessionId},
              ${linkMode},
              ${timestamp},
              ${timestamp}
            )
            on conflict (invoice_id, session_id, auth_user_id) do update
            set link_mode = ${linkMode}, updated_at = ${timestamp}
          `);
        }
        break;
      }
      default:
        throw new Error(`Unsupported write action: ${action}`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function POST(request: Request): Promise<Response> {
  let authUserId: string;
  let body: WriteBody;

  try {
    authUserId = await requireAuthUserId(request);
    body = await parseBody(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request.' },
      { status: 401 },
    );
  }

  const action = body.action;
  const payload = body.payload ?? {};
  if (!action) {
    return Response.json({ error: 'Missing action.' }, { status: 400 });
  }

  try {
    await runWrite(action, payload, authUserId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Hosted DB write route failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Hosted write failed.' },
      { status: 400 },
    );
  }
}

