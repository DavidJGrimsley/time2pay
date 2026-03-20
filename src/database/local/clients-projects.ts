import * as queries from '@/database/local/clients-projects/queries';

export const createClient = queries.createClient;
export const listClients = queries.listClients;
export const getClientById = queries.getClientById;
export const updateClientInvoiceContact = queries.updateClientInvoiceContact;
export const updateClientHourlyRate = queries.updateClientHourlyRate;

export const createProject = queries.createProject;
export const listProjectsByClient = queries.listProjectsByClient;
export const listProjects = queries.listProjects;
export const getProjectById = queries.getProjectById;
export const updateProjectPricing = queries.updateProjectPricing;

export const createTask = queries.createTask;
export const listTasksByProject = queries.listTasksByProject;

