export type PricingMode = 'hourly' | 'milestone';
export type MilestoneAmountType = 'percent' | 'fixed';
export type MilestoneCompletionMode = 'toggle' | 'checklist';
export type InvoiceType = 'hourly' | 'milestone';
export type InvoiceSessionLinkMode = 'context' | 'billed';

export type Session = {
  id: string;
  client: string;
  client_id: string | null;
  project_id: string | null;
  task_id: string | null;
  client_name?: string | null;
  project_name?: string | null;
  task_name?: string | null;
  github_org?: string | null;
  github_repo?: string | null;
  github_branch?: string | null;
  break_count?: number;
  is_paused?: number;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  notes: string | null;
  commit_sha: string | null;
  commit_url?: string | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  hourly_rate: number;
  github_org: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  github_repo: string | null;
  pricing_mode: PricingMode;
  total_project_fee: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Task = {
  id: string;
  project_id: string;
  name: string;
  github_branch: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Invoice = {
  id: string;
  client_id: string;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  invoice_type: InvoiceType;
  mercury_invoice_id: string | null;
  payment_link: string | null;
  source_project_id: string | null;
  source_project_name: string | null;
  source_milestone_id: string | null;
  source_milestone_title: string | null;
  source_milestone_amount_type: MilestoneAmountType | null;
  source_milestone_amount_value: number | null;
  source_milestone_completion_mode: MilestoneCompletionMode | null;
  source_milestone_completed_at: string | null;
  source_session_link_mode: InvoiceSessionLinkMode | null;
  source_session_hourly_rate: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InvoiceWithClient = Invoice & {
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_hourly_rate?: number | null;
};

export type UserProfile = {
  id: string;
  company_name: string | null;
  logo_url: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  github_pat?: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionBreak = {
  id: string;
  session_id: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  amount_type: MilestoneAmountType;
  amount_value: number;
  completion_mode: MilestoneCompletionMode;
  due_note: string | null;
  sort_order: number;
  is_completed: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MilestoneChecklistItem = {
  id: string;
  milestone_id: string;
  label: string;
  sort_order: number;
  is_completed: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InvoiceSessionLink = {
  id: string;
  invoice_id: string;
  session_id: string;
  link_mode: InvoiceSessionLinkMode;
  created_at: string;
  updated_at: string;
};

export type CoreDbValidationReport = {
  schemaVersion: number;
  startedSessionId: string;
  manualSessionId: string;
  invoiceId: string;
  linkedSessionCount: number;
};
