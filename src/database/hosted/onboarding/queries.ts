import { ensureHostedProfileRow, nowIso, requireHostedUserId } from '@/database/hosted/shared/runtime';
import { getSupabaseClient } from '@/services/supabase-client';

export const TIME2PAY_ONBOARDING_FLOW_ID = 'time2pay-onboarding';
export const TIME2PAY_ONBOARDING_FLOW_VERSION = 1;

export const time2PayOnboardingStepIds = ['welcome', 'features', 'auth', 'legal'] as const;

export type Time2PayOnboardingStepId = (typeof time2PayOnboardingStepIds)[number];
export type HostedOnboardingGateStatus = 'needs-onboarding' | 'needs-legal' | 'complete';

export type LegalDocumentRequirement = {
  documentId: string;
  documentVersion: string;
};

export type HostedOnboardingGateSnapshot = {
  status: HostedOnboardingGateStatus;
  flowId: string;
  flowVersion: number;
  completedStepIds: Time2PayOnboardingStepId[];
  completedAt: string | null;
  acceptedDocumentKeys: string[];
  missingDocumentIds: string[];
};

type OnboardingStateRow = {
  completed_step_ids?: unknown;
  completed_at?: string | null;
};

type LegalAcceptanceRow = {
  document_id?: string | null;
  document_version?: string | null;
};

function documentKey(document: LegalDocumentRequirement): string {
  return `${document.documentId}@${document.documentVersion}`;
}

function normalizeStepIds(value: unknown): Time2PayOnboardingStepId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((stepId): stepId is Time2PayOnboardingStepId =>
    time2PayOnboardingStepIds.includes(stepId as Time2PayOnboardingStepId),
  );
}

function mergeStepIds(
  currentStepIds: Time2PayOnboardingStepId[],
  nextStepIds: Time2PayOnboardingStepId[],
): Time2PayOnboardingStepId[] {
  return time2PayOnboardingStepIds.filter(
    (stepId) => currentStepIds.includes(stepId) || nextStepIds.includes(stepId),
  );
}

async function requireOnboardingUserId(): Promise<string> {
  const userId = await requireHostedUserId();
  await ensureHostedProfileRow(userId);
  return userId;
}

async function loadOnboardingStateRow(authUserId: string): Promise<OnboardingStateRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_onboarding_state')
    .select('completed_step_ids,completed_at')
    .eq('auth_user_id', authUserId)
    .eq('flow_id', TIME2PAY_ONBOARDING_FLOW_ID)
    .eq('flow_version', TIME2PAY_ONBOARDING_FLOW_VERSION)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OnboardingStateRow | null) ?? null;
}

async function upsertOnboardingState(input: {
  authUserId: string;
  completedStepIds: Time2PayOnboardingStepId[];
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const timestamp = nowIso();
  const { error } = await supabase.from('user_onboarding_state').upsert(
    {
      auth_user_id: input.authUserId,
      flow_id: TIME2PAY_ONBOARDING_FLOW_ID,
      flow_version: TIME2PAY_ONBOARDING_FLOW_VERSION,
      completed_step_ids: input.completedStepIds,
      completed_at: input.completedAt ?? null,
      metadata: input.metadata ?? {},
      updated_at: timestamp,
    },
    { onConflict: 'auth_user_id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function recordOnboardingEvent(input: {
  authUserId: string;
  stepId: Time2PayOnboardingStepId;
  eventType: 'step_completed' | 'answer_selected' | 'legal_accepted' | 'flow_completed';
  answerKey?: string | null;
  answerValue?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('user_onboarding_events').insert({
    auth_user_id: input.authUserId,
    flow_id: TIME2PAY_ONBOARDING_FLOW_ID,
    flow_version: TIME2PAY_ONBOARDING_FLOW_VERSION,
    step_id: input.stepId,
    event_type: input.eventType,
    answer_key: input.answerKey ?? null,
    answer_value: input.answerValue ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getHostedOnboardingGateSnapshot(
  requiredDocuments: LegalDocumentRequirement[],
): Promise<HostedOnboardingGateSnapshot> {
  const supabase = getSupabaseClient();
  const authUserId = await requireOnboardingUserId();

  const [stateRow, acceptancesResult] = await Promise.all([
    loadOnboardingStateRow(authUserId),
    supabase
      .from('user_legal_acceptances')
      .select('document_id,document_version')
      .eq('auth_user_id', authUserId)
      .eq('flow_id', TIME2PAY_ONBOARDING_FLOW_ID)
      .eq('flow_version', TIME2PAY_ONBOARDING_FLOW_VERSION)
      .in(
        'document_id',
        requiredDocuments.map((document) => document.documentId),
      ),
  ]);

  if (acceptancesResult.error) {
    throw new Error(acceptancesResult.error.message);
  }

  const acceptedDocumentKeys = ((acceptancesResult.data ?? []) as LegalAcceptanceRow[])
    .filter((row): row is { document_id: string; document_version: string } =>
      Boolean(row.document_id && row.document_version),
    )
    .map((row) =>
      documentKey({
        documentId: row.document_id,
        documentVersion: row.document_version,
      }),
    );
  const acceptedDocumentKeySet = new Set(acceptedDocumentKeys);
  const missingDocumentIds = requiredDocuments
    .filter((document) => !acceptedDocumentKeySet.has(documentKey(document)))
    .map((document) => document.documentId);

  const completedStepIds = normalizeStepIds(stateRow?.completed_step_ids);
  const completedAt = stateRow?.completed_at ?? null;

  if (!stateRow) {
    return {
      status: 'needs-onboarding',
      flowId: TIME2PAY_ONBOARDING_FLOW_ID,
      flowVersion: TIME2PAY_ONBOARDING_FLOW_VERSION,
      completedStepIds,
      completedAt,
      acceptedDocumentKeys,
      missingDocumentIds,
    };
  }

  return {
    status: missingDocumentIds.length > 0 || !completedAt ? 'needs-legal' : 'complete',
    flowId: TIME2PAY_ONBOARDING_FLOW_ID,
    flowVersion: TIME2PAY_ONBOARDING_FLOW_VERSION,
    completedStepIds,
    completedAt,
    acceptedDocumentKeys,
    missingDocumentIds,
  };
}

export async function recordHostedOnboardingStepCompleted(
  stepId: Time2PayOnboardingStepId,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const authUserId = await requireOnboardingUserId();
  const stateRow = await loadOnboardingStateRow(authUserId);
  const completedStepIds = mergeStepIds(normalizeStepIds(stateRow?.completed_step_ids), [stepId]);

  await upsertOnboardingState({
    authUserId,
    completedStepIds,
    completedAt: stateRow?.completed_at ?? null,
    metadata,
  });
  await recordOnboardingEvent({
    authUserId,
    stepId,
    eventType: 'step_completed',
    metadata,
  });
}

export async function acceptHostedLegalDocument(
  document: LegalDocumentRequirement,
): Promise<void> {
  const supabase = getSupabaseClient();
  const authUserId = await requireOnboardingUserId();
  const { error } = await supabase.from('user_legal_acceptances').upsert(
    {
      auth_user_id: authUserId,
      document_id: document.documentId,
      document_version: document.documentVersion,
      flow_id: TIME2PAY_ONBOARDING_FLOW_ID,
      flow_version: TIME2PAY_ONBOARDING_FLOW_VERSION,
      metadata: {},
    },
    {
      ignoreDuplicates: true,
      onConflict: 'auth_user_id,document_id,document_version',
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  await recordOnboardingEvent({
    authUserId,
    stepId: 'legal',
    eventType: 'legal_accepted',
    answerKey: document.documentId,
    answerValue: { documentVersion: document.documentVersion },
  });
}

export async function completeHostedOnboarding(
  requiredDocuments: LegalDocumentRequirement[],
): Promise<void> {
  const authUserId = await requireOnboardingUserId();
  const snapshot = await getHostedOnboardingGateSnapshot(requiredDocuments);

  if (snapshot.missingDocumentIds.length > 0) {
    throw new Error('Review and accept the current Terms of Service and Privacy Policy first.');
  }

  const completedAt = nowIso();
  const completedStepIds = mergeStepIds(snapshot.completedStepIds, ['legal']);

  await upsertOnboardingState({
    authUserId,
    completedStepIds,
    completedAt,
    metadata: { completedBy: 'legal-review' },
  });
  await recordOnboardingEvent({
    authUserId,
    stepId: 'legal',
    eventType: 'flow_completed',
    metadata: { completedAt },
  });
}
