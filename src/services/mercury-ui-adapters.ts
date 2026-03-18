import type {
  MercuryCustomerContactAdapter,
  MercuryUiAdapter,
} from '@mr.dj2u/mercury-ui';
import {
  initializeDatabase,
  listClients,
  updateClientInvoiceContact,
} from '@/database/db';
import {
  createMercuryInvoice,
  createMercuryRecipient,
  ensureMercuryCustomer,
  listMercuryAccounts,
  listMercuryRecipients,
  sendMercuryMoney,
  updateMercuryRecipient,
} from '@/services/mercury';

function toNullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = `${value ?? ''}`.trim();
  return trimmed ? trimmed : null;
}

export function formatMercuryCustomerSyncError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : 'Mercury customer sync failed.';
  if (rawMessage.includes('403') || rawMessage.toLowerCase().includes('subscriptions')) {
    return 'Mercury banking is connected, but customer sync requires Accounts Receivable access. Mercury sandbox banking access alone will not create AR customers.';
  }

  return rawMessage;
}

export const mercuryUiAdapter: MercuryUiAdapter = {
  listAccounts: listMercuryAccounts,
  listRecipients: listMercuryRecipients,
  createInvoice: createMercuryInvoice,
  createRecipient: createMercuryRecipient,
  updateRecipient: updateMercuryRecipient,
  sendMoney: sendMercuryMoney,
};

export const mercuryCustomerContactAdapter: MercuryCustomerContactAdapter = {
  loadCustomers: async () => {
    await initializeDatabase();
    const clients = await listClients();
    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      phone: client.phone ?? null,
      email: client.email ?? null,
    }));
  },
  saveCustomerContact: async (customer) => {
    await initializeDatabase();
    await updateClientInvoiceContact({
      id: customer.id,
      name: customer.name.trim(),
      phone: toNullableTrimmed(customer.phone),
      email: toNullableTrimmed(customer.email),
    });
  },
  syncCustomerToMercury: async (customer) => {
    await ensureMercuryCustomer({
      name: customer.name.trim(),
      email: `${customer.email ?? ''}`.trim(),
    });
  },
  formatSyncError: formatMercuryCustomerSyncError,
};
