import * as legacy from '@/database/local/legacy';

export const createProjectMilestone = legacy.createProjectMilestone;
export const listProjectMilestones = legacy.listProjectMilestones;
export const getProjectMilestoneById = legacy.getProjectMilestoneById;
export const updateProjectMilestone = legacy.updateProjectMilestone;
export const deleteProjectMilestone = legacy.deleteProjectMilestone;
export const setProjectMilestoneCompletion = legacy.setProjectMilestoneCompletion;

export const createMilestoneChecklistItem = legacy.createMilestoneChecklistItem;
export const listMilestoneChecklistItems = legacy.listMilestoneChecklistItems;
export const updateMilestoneChecklistItem = legacy.updateMilestoneChecklistItem;
export const listMilestoneChecklistItemsByMilestoneIds =
  legacy.listMilestoneChecklistItemsByMilestoneIds;
export const areMilestoneChecklistItemsComplete = legacy.areMilestoneChecklistItemsComplete;

