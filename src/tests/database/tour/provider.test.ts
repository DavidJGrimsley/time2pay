import { beforeEach, describe, expect, it } from 'vitest';
import { ensureTourProviderInitialized, resetTourProviderData, tourProvider } from '@/database/tour/provider';

describe('tour provider integration', () => {
  beforeEach(async () => {
    await resetTourProviderData();
  });

  it('initializes a connected, deterministic workspace without a SQLite handle', async () => {
    await ensureTourProviderInitialized();

    const [profile, clients, projects, sessions, invoices] = await Promise.all([
      tourProvider.getUserProfile(),
      tourProvider.listClients(),
      tourProvider.listProjects(),
      tourProvider.listSessions(),
      tourProvider.listInvoices(),
    ]);

    expect(profile.company_name).toBe('Time2Pay Tour Studio');
    expect(clients).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Acme Design Co.' })]));
    expect(projects).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Website Refresh' })]));
    expect(sessions).toHaveLength(4);
    expect(invoices).toEqual(expect.arrayContaining([expect.objectContaining({ total: 437.5 })]));
    await expect(tourProvider.getDb()).rejects.toThrow('does not expose a SQLite handle');
  });

  it('resets mutations back to the original tour workspace', async () => {
    await tourProvider.createClient({
      id: 'e2e-client',
      name: 'Temporary test client',
      hourly_rate: 100,
    });
    expect(await tourProvider.listClients()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'e2e-client' })]),
    );

    await resetTourProviderData();

    const resetClients = await tourProvider.listClients();
    expect(resetClients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tour_client_001', name: 'Acme Design Co.' }),
      ]),
    );
    expect(resetClients.some((client) => client.id === 'e2e-client')).toBe(false);
  });
});
