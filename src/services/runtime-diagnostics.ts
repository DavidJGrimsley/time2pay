const DEBUG_QUERY_PARAM = 'debugAuth';
export const DEBUG_STORAGE_KEY = 'time2pay.debug.auth';
const LOG_PREFIX = '[Time2PayDebug]';

type DiagnosticLevel = 'info' | 'warn' | 'error';

type DiagnosticPayload = Record<string, unknown>;

let diagnosticsEnabled = false;
let diagnosticsInitialized = false;
let globalListenersBound = false;

function isWebRuntime(): boolean {
  return typeof window !== 'undefined';
}

function parseToggleValue(raw: string | null): boolean | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}

function formatDiagnosticValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  return value;
}

function normalizePayload(payload: DiagnosticPayload | undefined): DiagnosticPayload {
  if (!payload) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, formatDiagnosticValue(value)]),
  );
}

function getCurrentRoute(): string {
  if (!isWebRuntime()) {
    return 'non-web';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function readPersistedDebugToggle(): boolean {
  if (!isWebRuntime()) {
    return false;
  }

  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDebugToggle(enabled: boolean): void {
  if (!isWebRuntime()) {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(DEBUG_STORAGE_KEY, '1');
      return;
    }

    window.localStorage.removeItem(DEBUG_STORAGE_KEY);
  } catch {
    // no-op
  }
}

function bindGlobalErrorListeners(): void {
  if (!isWebRuntime() || globalListenersBound) {
    return;
  }

  window.addEventListener('error', (event) => {
    logRuntimeDiagnostic(
      'window.error',
      {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
      },
      { level: 'error' },
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    logRuntimeDiagnostic(
      'window.unhandledrejection',
      {
        reason: formatDiagnosticValue(event.reason),
      },
      { level: 'error' },
    );
  });

  globalListenersBound = true;
}

function resolveDiagnosticsEnabledFromBrowser(): {
  enabled: boolean;
  source: 'query' | 'storage' | 'default';
  queryValue: string | null;
} {
  if (!isWebRuntime()) {
    return {
      enabled: false,
      source: 'default',
      queryValue: null,
    };
  }

  const queryValue = new URLSearchParams(window.location.search).get(DEBUG_QUERY_PARAM);
  const queryToggle = parseToggleValue(queryValue);

  if (queryToggle !== null) {
    persistDebugToggle(queryToggle);
    return {
      enabled: queryToggle,
      source: 'query',
      queryValue,
    };
  }

  const persisted = readPersistedDebugToggle();
  if (persisted) {
    return {
      enabled: true,
      source: 'storage',
      queryValue,
    };
  }

  return {
    enabled: false,
    source: 'default',
    queryValue,
  };
}

export function isRuntimeDiagnosticsEnabled(): boolean {
  return diagnosticsEnabled;
}

export function bootstrapRuntimeDiagnostics(): void {
  if (!isWebRuntime()) {
    return;
  }

  const initializedBefore = diagnosticsInitialized;
  const previousEnabled = diagnosticsEnabled;
  const resolution = resolveDiagnosticsEnabledFromBrowser();
  diagnosticsEnabled = resolution.enabled;
  diagnosticsInitialized = true;

  if (diagnosticsEnabled) {
    bindGlobalErrorListeners();
  }

  if (diagnosticsEnabled) {
    logRuntimeDiagnostic('diagnostics.bootstrap', {
      source: resolution.source,
      queryValue: resolution.queryValue,
      wasEnabled: previousEnabled,
      initializedBefore,
    });
  }
}

export function logRuntimeDiagnostic(
  event: string,
  payload?: DiagnosticPayload,
  options?: { level?: DiagnosticLevel },
): void {
  if (!diagnosticsEnabled) {
    return;
  }

  const level = options?.level ?? 'info';
  const data = {
    event,
    timestamp: new Date().toISOString(),
    route: getCurrentRoute(),
    initialized: diagnosticsInitialized,
    ...normalizePayload(payload),
  };

  if (level === 'error') {
    console.error(LOG_PREFIX, data);
    return;
  }

  if (level === 'warn') {
    console.warn(LOG_PREFIX, data);
    return;
  }

  console.log(LOG_PREFIX, data);
}
