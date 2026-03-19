import * as repository from '@/database/hosted/repository';

export const createInvoice = repository.createInvoice;
export const listInvoices = repository.listInvoices;
export const listSessionsByInvoiceId = repository.listSessionsByInvoiceId;
export const assignSessionsToInvoice = repository.assignSessionsToInvoice;
export const createInvoiceSessionLinks = repository.createInvoiceSessionLinks;
export const listInvoiceSessionLinksByInvoiceId = repository.listInvoiceSessionLinksByInvoiceId;

