export const e2ePublicEnvironment = Object.freeze({
  EXPO_PUBLIC_TIME2PAY_DATA_MODE: 'hosted',
  EXPO_PUBLIC_SITE_ORIGIN: 'http://127.0.0.1:4173',
  EXPO_PUBLIC_SUPABASE_URL: 'https://time2pay-e2e.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'time2pay-e2e-anon-key',
});

export function createE2eEnvironment(overrides = {}) {
  return {
    ...process.env,
    ...e2ePublicEnvironment,
    ...overrides,
  };
}
