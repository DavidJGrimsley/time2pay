import { getSupabaseClient } from '@/services/supabase-client';
import {
  callHostedWriteRoute,
  requireHostedUserId,
  toNumber,
  toNumberOrNull,
  withHostedRead,
} from '@/database/hosted/shared/runtime';
import type { Client, PricingMode, Project, Task } from '@/database/hosted/types';

export function createClient(input: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  hourly_rate?: number;
  github_org?: string | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/clients/create', {
    id: input.id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    hourlyRate: input.hourly_rate,
    githubOrg: input.github_org,
  });
}

export function listClients(): Promise<Client[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('clients')
      .select('id,name,email,phone,hourly_rate,github_org,created_at,updated_at,deleted_at')
      .eq('auth_user_id', userId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      hourly_rate: toNumber(row.hourly_rate),
      github_org: (row.github_org as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  });
}

export function getClientById(clientId: string): Promise<Client | null> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('clients')
      .select('id,name,email,phone,hourly_rate,github_org,created_at,updated_at,deleted_at')
      .eq('auth_user_id', userId)
      .eq('id', clientId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.name),
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      hourly_rate: toNumber(row.hourly_rate),
      github_org: (row.github_org as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    };
  });
}

export function updateClientInvoiceContact(input: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/clients/update-contact', input);
}

export function updateClientHourlyRate(input: {
  id: string;
  hourly_rate: number;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/clients/update-hourly-rate', {
    id: input.id,
    hourlyRate: input.hourly_rate,
  });
}

export function createProject(input: {
  id: string;
  client_id: string;
  name: string;
  github_repo?: string | null;
  pricing_mode?: PricingMode;
  total_project_fee?: number | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/projects/create', {
    id: input.id,
    clientId: input.client_id,
    name: input.name,
    githubRepo: input.github_repo,
    pricingMode: input.pricing_mode,
    totalProjectFee: input.total_project_fee,
  });
}

export function listProjectsByClient(clientId: string): Promise<Project[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('projects')
      .select('id,client_id,name,github_repo,pricing_mode,total_project_fee,created_at,updated_at,deleted_at')
      .eq('auth_user_id', userId)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      client_id: String(row.client_id),
      name: String(row.name),
      github_repo: (row.github_repo as string | null) ?? null,
      pricing_mode: (row.pricing_mode as PricingMode) ?? 'hourly',
      total_project_fee: toNumberOrNull(row.total_project_fee),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  });
}

export function listProjects(): Promise<Project[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('projects')
      .select('id,client_id,name,github_repo,pricing_mode,total_project_fee,created_at,updated_at,deleted_at')
      .eq('auth_user_id', userId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      client_id: String(row.client_id),
      name: String(row.name),
      github_repo: (row.github_repo as string | null) ?? null,
      pricing_mode: (row.pricing_mode as PricingMode) ?? 'hourly',
      total_project_fee: toNumberOrNull(row.total_project_fee),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  });
}

export function getProjectById(projectId: string): Promise<Project | null> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('projects')
      .select('id,client_id,name,github_repo,pricing_mode,total_project_fee,created_at,updated_at,deleted_at')
      .eq('auth_user_id', userId)
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      client_id: String(row.client_id),
      name: String(row.name),
      github_repo: (row.github_repo as string | null) ?? null,
      pricing_mode: (row.pricing_mode as PricingMode) ?? 'hourly',
      total_project_fee: toNumberOrNull(row.total_project_fee),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    };
  });
}

export function updateProjectPricing(input: {
  id: string;
  pricing_mode: PricingMode;
  total_project_fee: number | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/projects/update-pricing', {
    id: input.id,
    pricingMode: input.pricing_mode,
    totalProjectFee: input.total_project_fee,
  });
}

export function createTask(input: {
  id: string;
  project_id: string;
  name: string;
  github_branch?: string | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/tasks/create', {
    id: input.id,
    projectId: input.project_id,
    name: input.name,
    githubBranch: input.github_branch,
  });
}

export function listTasksByProject(projectId: string): Promise<Task[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('tasks')
      .select('id,project_id,name,github_branch,created_at,updated_at,deleted_at')
      .eq('auth_user_id', userId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      project_id: String(row.project_id),
      name: String(row.name),
      github_branch: (row.github_branch as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  });
}
