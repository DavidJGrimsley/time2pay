import * as legacy from '@/database/local/legacy';

export const createClient = legacy.createClient;
export const listClients = legacy.listClients;
export const getClientById = legacy.getClientById;
export const updateClientInvoiceContact = legacy.updateClientInvoiceContact;
export const updateClientHourlyRate = legacy.updateClientHourlyRate;

export const createProject = legacy.createProject;
export const listProjectsByClient = legacy.listProjectsByClient;
export const listProjects = legacy.listProjects;
export const getProjectById = legacy.getProjectById;
export const updateProjectPricing = legacy.updateProjectPricing;

export const createTask = legacy.createTask;
export const listTasksByProject = legacy.listTasksByProject;
