import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/server/db/_shared/db';
import { conflict, validation } from '@/server/db/_shared/errors';
import { toNumericString } from '@/server/db/_queries/_shared';
import { nowIso } from '@/server/db/_shared/parsers';

export type UpsertInvoiceMilestoneLinksInput = {
  invoiceId: string;
  links: {
    milestoneId: string;
    projectId: string;
    projectName: string | null;
    title: string;
    amount: number;
    amountType: 'percent' | 'fixed';
    amountValue: number;
    completionMode: 'toggle' | 'checklist';
    completedAt: string | null;
  }[];
};

export async function upsertInvoiceMilestoneLinks(
  db: WriteDb,
  authUserId: string,
  input: UpsertInvoiceMilestoneLinksInput,
): Promise<void> {
  if (!input.invoiceId.trim() || input.links.length === 0) return;
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    for (const link of input.links) {
      if (!Number.isFinite(link.amount) || link.amount < 0) {
        throw validation('Milestone amount must be a non-negative number.');
      }
      const milestoneResult = await tx.execute(sql`
        select pm.id
        from project_milestones pm
        inner join projects p on p.id = pm.project_id and p.auth_user_id = ${authUserId}::uuid
        where pm.id = ${link.milestoneId}
          and pm.project_id = ${link.projectId}
          and pm.auth_user_id = ${authUserId}::uuid
          and pm.is_completed = true
          and pm.deleted_at is null
        limit 1
      `);
      const milestoneRows = Array.isArray(milestoneResult) ? milestoneResult : ((milestoneResult as { rows?: unknown[] }).rows ?? []);
      if (milestoneRows.length === 0) throw validation('Only completed milestones can be invoiced.');
      try {
        await tx.execute(sql`
          insert into invoice_milestone_links (
            id, auth_user_id, invoice_id, milestone_id, project_id, project_name, title, amount,
            amount_type, amount_value, completion_mode, completed_at, created_at, updated_at, deleted_at
          ) values (
            ${`invoice_milestone_${crypto.randomUUID()}`}, ${authUserId}::uuid, ${input.invoiceId}, ${link.milestoneId},
            ${link.projectId}, ${link.projectName}, ${link.title}, ${toNumericString(link.amount)},
            ${link.amountType}, ${toNumericString(link.amountValue)}, ${link.completionMode}, ${link.completedAt},
            ${timestamp}, ${timestamp}, null
          )
        `);
      } catch (error) {
        throw conflict(error instanceof Error ? 'This completed milestone already has an active invoice draft.' : 'Unable to attach milestone to invoice.');
      }
    }
  });
}
