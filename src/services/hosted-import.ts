import type { BackupRecordCounts, Time2PayBackup } from '@/services/data-backup';
import { getSupabaseClient, requireSupabaseUserId } from '@/services/supabase-client';

type HostedImportOptions = {
  replaceAll: boolean;
};

type HostedImportReport = {
  counts: BackupRecordCounts;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toCounts(snapshot: Time2PayBackup): BackupRecordCounts {
  return {
    userProfile: snapshot.data.userProfile.length,
    clients: snapshot.data.clients.length,
    projects: snapshot.data.projects.length,
    tasks: snapshot.data.tasks.length,
    projectMilestones: snapshot.data.projectMilestones.length,
    milestoneChecklistItems: snapshot.data.milestoneChecklistItems.length,
    sessions: snapshot.data.sessions.length,
    sessionBreaks: snapshot.data.sessionBreaks.length,
    invoices: snapshot.data.invoices.length,
    invoiceSessionLinks: snapshot.data.invoiceSessionLinks.length,
  };
}

async function clearHostedUserData(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const deletes = [
    supabase.from('invoice_session_links').delete().eq('auth_user_id', userId),
    supabase.from('milestone_checklist_items').delete().eq('auth_user_id', userId),
    supabase.from('project_milestones').delete().eq('auth_user_id', userId),
    supabase.from('session_breaks').delete().eq('auth_user_id', userId),
    supabase.from('sessions').delete().eq('auth_user_id', userId),
    supabase.from('invoices').delete().eq('auth_user_id', userId),
    supabase.from('tasks').delete().eq('auth_user_id', userId),
    supabase.from('projects').delete().eq('auth_user_id', userId),
    supabase.from('clients').delete().eq('auth_user_id', userId),
  ];

  for (const operation of deletes) {
    const { error } = await operation;
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function importBackupIntoHostedAccount(
  snapshot: Time2PayBackup,
  options: HostedImportOptions,
): Promise<HostedImportReport> {
  const supabase = getSupabaseClient();
  const userId = await requireSupabaseUserId();

  if (options.replaceAll) {
    await clearHostedUserData(userId);
  }

  const timestamp = nowIso();
  const profile = snapshot.data.userProfile[0];
  const { error: profileError } = await supabase.from('user_profiles').upsert(
    {
      auth_user_id: userId,
      id: profile?.id ?? 'me',
      company_name: profile?.company_name ?? null,
      logo_url: profile?.logo_url ?? null,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      created_at: profile?.created_at ?? timestamp,
      updated_at: timestamp,
      github_pat: profile?.github_pat ?? null,
    },
    {
      onConflict: 'auth_user_id',
      ignoreDuplicates: false,
    },
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (snapshot.data.clients.length > 0) {
    const { error } = await supabase.from('clients').upsert(
      snapshot.data.clients.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.projects.length > 0) {
    const { error } = await supabase.from('projects').upsert(
      snapshot.data.projects.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.tasks.length > 0) {
    const { error } = await supabase.from('tasks').upsert(
      snapshot.data.tasks.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.invoices.length > 0) {
    const { error } = await supabase.from('invoices').upsert(
      snapshot.data.invoices.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.sessions.length > 0) {
    const { error } = await supabase.from('sessions').upsert(
      snapshot.data.sessions.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.sessionBreaks.length > 0) {
    const { error } = await supabase.from('session_breaks').upsert(
      snapshot.data.sessionBreaks.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.projectMilestones.length > 0) {
    const { error } = await supabase.from('project_milestones').upsert(
      snapshot.data.projectMilestones.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.milestoneChecklistItems.length > 0) {
    const { error } = await supabase.from('milestone_checklist_items').upsert(
      snapshot.data.milestoneChecklistItems.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.data.invoiceSessionLinks.length > 0) {
    const { error } = await supabase.from('invoice_session_links').upsert(
      snapshot.data.invoiceSessionLinks.map((row) => ({
        ...row,
        auth_user_id: userId,
      })),
      { onConflict: 'id' },
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    counts: toCounts(snapshot),
  };
}
