import { describe, expect, it, vi } from 'vitest';
import { sanitizeActionErrorMessage } from '@/services/system-alert';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: 'web' },
}));

describe('sanitizeActionErrorMessage', () => {
  it('keeps concise, user-safe Mercury recovery guidance', () => {
    const message =
      'Mercury rejected this key. Verify it is active and its IP allowlist includes the machine running Time2Pay. For help, email info@Time2Pay.app.';

    expect(message.length).toBeLessThanOrEqual(180);
    expect(sanitizeActionErrorMessage(message)).toBe(message);
  });
});
