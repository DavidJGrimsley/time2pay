import * as repository from '@/database/hosted/repository';

export const createProjectMilestone = repository.createProjectMilestone;
export const listProjectMilestones = repository.listProjectMilestones;
export const getProjectMilestoneById = repository.getProjectMilestoneById;
export const updateProjectMilestone = repository.updateProjectMilestone;
export const deleteProjectMilestone = repository.deleteProjectMilestone;
export const setProjectMilestoneCompletion = repository.setProjectMilestoneCompletion;

export const createMilestoneChecklistItem = repository.createMilestoneChecklistItem;
export const listMilestoneChecklistItems = repository.listMilestoneChecklistItems;
export const updateMilestoneChecklistItem = repository.updateMilestoneChecklistItem;
export const listMilestoneChecklistItemsByMilestoneIds =
  repository.listMilestoneChecklistItemsByMilestoneIds;
export const areMilestoneChecklistItemsComplete = repository.areMilestoneChecklistItemsComplete;

