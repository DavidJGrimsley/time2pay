export type MercuryInvoiceDraft = {
  clientName: string;
  amountCents: number;
};

export async function createInvoiceDraft(draft: MercuryInvoiceDraft): Promise<{ id: string }> {
  // Placeholder for future Mercury API integration.
  return Promise.resolve({
    id: `${draft.clientName.toLowerCase().replace(/\s+/g, '-')}-${draft.amountCents}`,
  });
}
