import { getDb, initializeDatabase } from '@/database/local/shared/runtime';

export const TOUR_SEED_VERSION = 1;

const TOUR_CLIENT_ID = 'tour_client_001';
const TOUR_PROJECT_ID = 'tour_project_001';
const TOUR_TASK_DESIGN_ID = 'tour_task_001';
const TOUR_TASK_QA_ID = 'tour_task_002';
const TOUR_MILESTONE_ID = 'tour_milestone_001';
const TOUR_CHECKLIST_BRIEF_ID = 'tour_checklist_001';
const TOUR_CHECKLIST_REVIEW_ID = 'tour_checklist_002';
const TOUR_INVOICE_ID = 'tour_invoice_001';
const TOUR_SESSION_ONE_ID = 'tour_session_001';
const TOUR_SESSION_TWO_ID = 'tour_session_002';
const TOUR_SESSION_THREE_ID = 'tour_session_003';
const TOUR_SESSION_FOUR_ID = 'tour_session_004';

function isoDaysAgo(daysAgo: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

async function readCurrentTourSeedVersion(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ tour_seed_version: number }>(
    'SELECT tour_seed_version FROM user_profile WHERE id = ?',
    'me',
  );

  return row?.tour_seed_version ?? 0;
}

export async function ensureTourDemoData(): Promise<void> {
  await initializeDatabase();

  const currentSeedVersion = await readCurrentTourSeedVersion();
  if (currentSeedVersion >= TOUR_SEED_VERSION) {
    return;
  }

  const db = await getDb();

  const billedSessionOneStart = isoDaysAgo(6, 9, 0);
  const billedSessionOneEnd = isoDaysAgo(6, 11, 0);
  const billedSessionTwoStart = isoDaysAgo(5, 13, 30);
  const billedSessionTwoEnd = isoDaysAgo(5, 15, 0);
  const openSessionOneStart = isoDaysAgo(2, 10, 15);
  const openSessionOneEnd = isoDaysAgo(2, 11, 30);
  const openSessionTwoStart = isoDaysAgo(1, 14, 0);
  const openSessionTwoEnd = isoDaysAgo(1, 14, 45);
  const nowIso = new Date().toISOString();

  await db.execAsync('BEGIN;');

  try {
    await db.runAsync(
      `UPDATE user_profile
         SET company_name = CASE
               WHEN company_name IS NULL OR TRIM(company_name) = '' THEN ?
               ELSE company_name
             END,
             logo_url = CASE
               WHEN logo_url IS NULL OR TRIM(logo_url) = '' THEN ?
               ELSE logo_url
             END,
             full_name = CASE
               WHEN full_name IS NULL OR TRIM(full_name) = '' THEN ?
               ELSE full_name
             END,
             phone = CASE
               WHEN phone IS NULL OR TRIM(phone) = '' THEN ?
               ELSE phone
             END,
             email = CASE
               WHEN email IS NULL OR TRIM(email) = '' THEN ?
               ELSE email
             END,
             tour_seed_version = ?,
             updated_at = ?
       WHERE id = ?`,
      'Time2Pay Tour Studio',
      '/images/time2payLogo.png',
      'Tour User',
      '(555) 010-2000',
      'tour@time2pay.demo',
      TOUR_SEED_VERSION,
      nowIso,
      'me',
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO clients (
        id,
        name,
        email,
        phone,
        hourly_rate,
        github_org,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_CLIENT_ID,
      'Acme Design Co.',
      'billing@acme-demo.test',
      '(555) 010-1001',
      125,
      null,
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO projects (
        id,
        client_id,
        name,
        github_repo,
        pricing_mode,
        total_project_fee,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_PROJECT_ID,
      TOUR_CLIENT_ID,
      'Website Refresh',
      null,
      'milestone',
      2400,
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO tasks (
        id,
        project_id,
        name,
        github_branch,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_TASK_DESIGN_ID,
      TOUR_PROJECT_ID,
      'Landing page polish',
      null,
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO tasks (
        id,
        project_id,
        name,
        github_branch,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_TASK_QA_ID,
      TOUR_PROJECT_ID,
      'Invoice workflow QA',
      null,
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO project_milestones (
        id,
        project_id,
        title,
        amount_type,
        amount_value,
        completion_mode,
        due_note,
        sort_order,
        is_completed,
        completed_at,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_MILESTONE_ID,
      TOUR_PROJECT_ID,
      'Launch milestone',
      'percent',
      50,
      'checklist',
      'Demo milestone for the tour workspace.',
      0,
      0,
      null,
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO milestone_checklist_items (
        id,
        milestone_id,
        label,
        sort_order,
        is_completed,
        completed_at,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_CHECKLIST_BRIEF_ID,
      TOUR_MILESTONE_ID,
      'Approve updated landing page brief',
      0,
      1,
      isoDaysAgo(3, 16, 0),
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO milestone_checklist_items (
        id,
        milestone_id,
        label,
        sort_order,
        is_completed,
        completed_at,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_CHECKLIST_REVIEW_ID,
      TOUR_MILESTONE_ID,
      'Collect final stakeholder review notes',
      1,
      0,
      null,
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO sessions (
        id,
        client,
        client_id,
        project_id,
        task_id,
        start_time,
        end_time,
        duration,
        notes,
        invoice_id,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      TOUR_SESSION_ONE_ID,
      'Acme Design Co.',
      TOUR_CLIENT_ID,
      TOUR_PROJECT_ID,
      TOUR_TASK_DESIGN_ID,
      billedSessionOneStart,
      billedSessionOneEnd,
      7200,
      'Refined hero spacing, CTA layout, and mobile heading balance.',
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO sessions (
        id,
        client,
        client_id,
        project_id,
        task_id,
        start_time,
        end_time,
        duration,
        notes,
        invoice_id,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      TOUR_SESSION_TWO_ID,
      'Acme Design Co.',
      TOUR_CLIENT_ID,
      TOUR_PROJECT_ID,
      TOUR_TASK_QA_ID,
      billedSessionTwoStart,
      billedSessionTwoEnd,
      5400,
      'Walked through invoice creation and polished the status messaging.',
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO sessions (
        id,
        client,
        client_id,
        project_id,
        task_id,
        start_time,
        end_time,
        duration,
        notes,
        invoice_id,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      TOUR_SESSION_THREE_ID,
      'Acme Design Co.',
      TOUR_CLIENT_ID,
      TOUR_PROJECT_ID,
      TOUR_TASK_DESIGN_ID,
      openSessionOneStart,
      openSessionOneEnd,
      4500,
      'Demo-ready responsive nav cleanup.',
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO sessions (
        id,
        client,
        client_id,
        project_id,
        task_id,
        start_time,
        end_time,
        duration,
        notes,
        invoice_id,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
      TOUR_SESSION_FOUR_ID,
      'Acme Design Co.',
      TOUR_CLIENT_ID,
      TOUR_PROJECT_ID,
      TOUR_TASK_QA_ID,
      openSessionTwoStart,
      openSessionTwoEnd,
      2700,
      'Prepared demo copy for the profile and onboarding flow.',
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO invoices (
        id,
        client_id,
        total,
        status,
        invoice_type,
        mercury_invoice_id,
        payment_link,
        source_project_id,
        source_project_name,
        source_milestone_id,
        source_milestone_title,
        source_milestone_amount_type,
        source_milestone_amount_value,
        source_milestone_completion_mode,
        source_milestone_completed_at,
        source_session_link_mode,
        source_session_hourly_rate,
        created_at,
        updated_at,
        deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      TOUR_INVOICE_ID,
      TOUR_CLIENT_ID,
      437.5,
      'draft',
      'hourly',
      null,
      null,
      TOUR_PROJECT_ID,
      'Website Refresh',
      null,
      null,
      null,
      null,
      null,
      null,
      'billed',
      125,
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO invoice_session_links (
        id,
        invoice_id,
        session_id,
        link_mode,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      'tour_invoice_link_001',
      TOUR_INVOICE_ID,
      TOUR_SESSION_ONE_ID,
      'billed',
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO invoice_session_links (
        id,
        invoice_id,
        session_id,
        link_mode,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      'tour_invoice_link_002',
      TOUR_INVOICE_ID,
      TOUR_SESSION_TWO_ID,
      'billed',
      nowIso,
      nowIso,
    );

    await db.runAsync(
      `UPDATE sessions
         SET invoice_id = CASE
               WHEN id IN (?, ?) AND invoice_id IS NULL THEN ?
               ELSE invoice_id
             END,
             updated_at = ?
       WHERE id IN (?, ?)`,
      TOUR_SESSION_ONE_ID,
      TOUR_SESSION_TWO_ID,
      TOUR_INVOICE_ID,
      nowIso,
      TOUR_SESSION_ONE_ID,
      TOUR_SESSION_TWO_ID,
    );

    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}
