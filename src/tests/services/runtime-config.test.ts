import { afterEach, describe, expect, it } from 'vitest';
import {
  readPublicRuntimeConfigValue,
  readTrimmedPublicRuntimeConfigValue,
} from '@/services/runtime-config';

const ORIGINAL_ENV = {
  EXPO_PUBLIC_TIME2PAY_DATA_MODE: process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE,
};

afterEach(() => {
  process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = ORIGINAL_ENV.EXPO_PUBLIC_TIME2PAY_DATA_MODE;
  Reflect.deleteProperty(globalThis, 'window');
});

describe('runtime-config', () => {
  it('prefers runtime config injected on window over build-time env', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'local';
    (globalThis as Record<string, unknown>).window = {
      __TIME2PAY_RUNTIME_CONFIG__: {
        EXPO_PUBLIC_TIME2PAY_DATA_MODE: 'hosted',
      },
    };

    expect(readPublicRuntimeConfigValue('EXPO_PUBLIC_TIME2PAY_DATA_MODE')).toBe('hosted');
  });

  it('falls back to build-time env when runtime config is missing', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'local';

    expect(readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_TIME2PAY_DATA_MODE')).toBe('local');
  });

  it('uses the default Mercury allowlist IP when no runtime override is provided', () => {
    expect(readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_MERCURY_ALLOWLIST_IP')).toBe('108.175.12.95');
  });
});
