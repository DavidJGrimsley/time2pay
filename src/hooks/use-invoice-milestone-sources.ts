import { useEffect, useMemo, useState } from 'react';
import { listInvoices, listProjectMilestones, listProjectsByClient, type ProjectMilestone } from '@/database/db';
import { computeMilestoneInvoiceAmount } from '@/services/invoice';

export type InvoiceMilestoneSource = {
  milestone: ProjectMilestone;
  projectId: string;
  projectName: string;
  projectTotalFee: number | null;
  amount: number;
};

export function useInvoiceMilestoneSources(
  clientId: string | null,
  projectId: string | null,
  refreshKey?: number,
) {
  const [sources, setSources] = useState<InvoiceMilestoneSource[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setSources([]);
      setSelectedIds([]);
      return () => { active = false; };
    }
    Promise.all([listProjectsByClient(clientId), listInvoices()]).then(async ([projects, invoices]) => {
      const blocked = new Set(invoices.map((invoice) => invoice.source_milestone_id).filter((id): id is string => Boolean(id)));
      const scopedProjects = projectId ? projects.filter((project) => project.id === projectId) : projects;
      const rows = await Promise.all(scopedProjects.map(async (project) => {
        const milestones = await listProjectMilestones(project.id);
        return milestones
          .filter((milestone) => milestone.is_completed && !blocked.has(milestone.id))
          .map((milestone) => ({
            milestone,
            projectId: project.id,
            projectName: project.name,
            projectTotalFee: project.total_project_fee,
            amount: computeMilestoneInvoiceAmount({
              amountType: milestone.amount_type,
              amountValue: milestone.amount_value,
              projectTotalFee: project.total_project_fee,
            }),
          }));
      }));
      if (!active) return;
      const nextSources = rows.flat();
      setSources(nextSources);
      setSelectedIds((current) => {
        const retained = current.filter((id) => nextSources.some((source) => source.milestone.id === id));
        return retained.length > 0 || current.length > 0 ? retained : nextSources.map((source) => source.milestone.id);
      });
    }).catch(() => {
      if (active) {
        setSources([]);
        setSelectedIds([]);
      }
    });
    return () => { active = false; };
  }, [clientId, projectId, refreshKey]);

  const selectedSources = useMemo(
    () => sources.filter((source) => selectedIds.includes(source.milestone.id)),
    [selectedIds, sources],
  );

  function toggleMilestone(milestoneId: string): void {
    setSelectedIds((current) => current.includes(milestoneId)
      ? current.filter((id) => id !== milestoneId)
      : [...current, milestoneId]);
  }

  return { sources, selectedIds, selectedSources, toggleMilestone };
}
