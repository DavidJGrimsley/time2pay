import * as queries from '@/database/hosted/invoices/queries';

export const createInvoice = queries.createInvoice;
export const listInvoices = queries.listInvoices;
export const listSessionsByInvoiceId = queries.listSessionsByInvoiceId;
export const assignSessionsToInvoice = queries.assignSessionsToInvoice;
export const createInvoiceSessionLinks = queries.createInvoiceSessionLinks;
export const listInvoiceSessionLinksByInvoiceId = queries.listInvoiceSessionLinksByInvoiceId;

