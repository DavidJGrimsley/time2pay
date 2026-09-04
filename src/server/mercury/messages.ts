export const MERCURY_SUPPORT_CONTACT = 'For help, email info@Time2Pay.app.';

export function formatMercuryUnauthorizedMessage(): string {
  return `Mercury rejected this key. Verify it is active and its IP allowlist includes the machine running Time2Pay. ${MERCURY_SUPPORT_CONTACT}`;
}
