export const MERCURY_OAUTH_RETURN_PATHS = [
  '/settings/integrations',
  '/onboarding/mercury',
] as const;

export type MercuryOAuthReturnPath = (typeof MERCURY_OAUTH_RETURN_PATHS)[number];

export const DEFAULT_MERCURY_OAUTH_RETURN_PATH: MercuryOAuthReturnPath =
  '/settings/integrations';

export function normalizeMercuryOAuthReturnPath(
  value: unknown,
): MercuryOAuthReturnPath {
  return MERCURY_OAUTH_RETURN_PATHS.includes(value as MercuryOAuthReturnPath)
    ? (value as MercuryOAuthReturnPath)
    : DEFAULT_MERCURY_OAUTH_RETURN_PATH;
}
