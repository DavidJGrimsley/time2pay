import * as queries from '@/database/local/milestones/queries';

export const createProjectMilestone = queries.createProjectMilestone;
export const listProjectMilestones = queries.listProjectMilestones;
export const getProjectMilestoneById = queries.getProjectMilestoneById;
export const updateProjectMilestone = queries.updateProjectMilestone;
export const deleteProjectMilestone = queries.deleteProjectMilestone;
export const setProjectMilestoneCompletion = queries.setProjectMilestoneCompletion;

export const createMilestoneChecklistItem = queries.createMilestoneChecklistItem;
export const listMilestoneChecklistItems = queries.listMilestoneChecklistItems;
export const updateMilestoneChecklistItem = queries.updateMilestoneChecklistItem;
export const listMilestoneChecklistItemsByMilestoneIds =
  queries.listMilestoneChecklistItemsByMilestoneIds;
export const areMilestoneChecklistItemsComplete = queries.areMilestoneChecklistItemsComplete;

