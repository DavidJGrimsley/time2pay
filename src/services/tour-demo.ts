import { ensureTourProviderInitialized, resetTourProviderData } from '@/database/tour/provider';

export async function ensureTourDemoData(): Promise<void> {
  await ensureTourProviderInitialized();
}

export async function resetTourDemoData(): Promise<void> {
  await resetTourProviderData();
}
