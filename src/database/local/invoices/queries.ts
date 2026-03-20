import * as legacy from '@/database/local/legacy';

export const createInvoice = legacy.createInvoice;
export const listInvoices = legacy.listInvoices;
export const listSessionsByInvoiceId = legacy.listSessionsByInvoiceId;
export const assignSessionsToInvoice = legacy.assignSessionsToInvoice;
export const createInvoiceSessionLinks = legacy.createInvoiceSessionLinks;
export const listInvoiceSessionLinksByInvoiceId = legacy.listInvoiceSessionLinksByInvoiceId;
