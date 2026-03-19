import * as repository from '@/database/hosted/repository';

export const createClient = repository.createClient;
export const listClients = repository.listClients;
export const getClientById = repository.getClientById;
export const updateClientInvoiceContact = repository.updateClientInvoiceContact;
export const updateClientHourlyRate = repository.updateClientHourlyRate;

export const createProject = repository.createProject;
export const listProjectsByClient = repository.listProjectsByClient;
export const listProjects = repository.listProjects;
export const getProjectById = repository.getProjectById;
export const updateProjectPricing = repository.updateProjectPricing;

export const createTask = repository.createTask;
export const listTasksByProject = repository.listTasksByProject;

