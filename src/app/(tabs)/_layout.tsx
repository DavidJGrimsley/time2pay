import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { errorMessage, logRuntimeDiagnostic } from '@/services/runtime-diagnostics';
import { isProfileComplete } from '@/services/profile-completion';
import { useAuthUiStore } from '@/stores/auth-ui-store';

const MIN_PROFILE_CHECK_MS = 220;
const PROFILE_GATE_TIMEOUT_MS = 7000;

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isProfileRoute = pathname === '/profile' || pathname.endsWith('/profile');

  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);

  const shouldRequireProfileCompletion =
    dataModeResolved &&
    !isProfileRoute &&
    !tourModeEnabled &&
    (!hostedMode || isAuthenticated);
  const [isProfileGateReady, setIsProfileGateReady] = useState(!dataModeResolved || !shouldRequireProfileCompletion);

  useEffect(() => {
    let isActive = true;
    logRuntimeDiagnostic('profileGate.effect.start', {
      pathname,
      dataModeResolved,
      hostedMode,
      isAuthenticated,
      tourModeEnabled,
      shouldRequireProfileCompletion,
      isProfileRoute,
    });

    if (!dataModeResolved) {
      setIsProfileGateReady(false);
      logRuntimeDiagnostic('profileGate.waitingForDataMode', {
        pathname,
      });
      return () => {
        isActive = false;
      };
    }

    if (!shouldRequireProfileCompletion) {
      setIsProfileGateReady(true);
      logRuntimeDiagnostic('profileGate.skipped', {
        reason: 'profile-requirement-disabled',
      });
      return () => {
        isActive = false;
      };
    }

    setIsProfileGateReady(false);

    let minimumDelayTimer: ReturnType<typeof setTimeout> | undefined;
    let profileGateTimeoutTimer: ReturnType<typeof setTimeout> | undefined;

    const checkProfileGate = async () => {
      const minimumDelay = new Promise((resolve) => {
        minimumDelayTimer = setTimeout(resolve, MIN_PROFILE_CHECK_MS);
      });
      const profileGateTimeout = new Promise<{ status: 'timeout' }>((resolve) => {
        profileGateTimeoutTimer = setTimeout(() => resolve({ status: 'timeout' }), PROFILE_GATE_TIMEOUT_MS);
      });
      const profileGateCheck = isProfileComplete()
        .then((complete) => ({ status: 'resolved' as const, complete }))
        .catch((error: unknown) => ({
          status: 'error' as const,
          message: errorMessage(error),
        }));

      try {
        const [result] = await Promise.all([Promise.race([profileGateCheck, profileGateTimeout]), minimumDelay]);
        if (!isActive) {
          return;
        }

        if (result.status === 'timeout') {
          logRuntimeDiagnostic(
            'profileGate.timeout',
            {
              timeoutMs: PROFILE_GATE_TIMEOUT_MS,
              isProfileRoute,
            },
            { level: 'warn' },
          );
          if (!isProfileRoute) {
            logRuntimeDiagnostic('profileGate.redirect.toProfile', {
              reason: 'timeout',
            });
            router.replace('/profile');
          }
          return;
        }

        if (result.status === 'error') {
          logRuntimeDiagnostic(
            'profileGate.error',
            {
              message: result.message,
              isProfileRoute,
            },
            { level: 'error' },
          );
          if (!isProfileRoute) {
            logRuntimeDiagnostic('profileGate.redirect.toProfile', {
              reason: 'check-error',
            });
            router.replace('/profile');
          }
          return;
        }

        logRuntimeDiagnostic('profileGate.result', {
          complete: result.complete,
          isProfileRoute,
        });

        if (!result.complete && !isProfileRoute) {
          logRuntimeDiagnostic('profileGate.redirect.toProfile', {
            reason: 'incomplete-profile',
          });
          router.replace('/profile');
        }
      } catch {
        if (!isActive) {
          return;
        }

        logRuntimeDiagnostic(
          'profileGate.unexpectedError',
          {
            isProfileRoute,
          },
          { level: 'error' },
        );
        if (!isProfileRoute) {
          logRuntimeDiagnostic('profileGate.redirect.toProfile', {
            reason: 'unexpected-exception',
          });
          router.replace('/profile');
        }
      } finally {
        if (isActive) {
          logRuntimeDiagnostic('profileGate.ready', {
            pathname,
          });
          setIsProfileGateReady(true);
        }
      }
    };

    checkProfileGate().catch(() => {
      if (isActive) {
        logRuntimeDiagnostic('profileGate.effect.promiseRejected', undefined, { level: 'error' });
        setIsProfileGateReady(true);
      }
    });

    return () => {
      isActive = false;
      clearTimeout(minimumDelayTimer);
      clearTimeout(profileGateTimeoutTimer);
    };
  }, [
    dataModeResolved,
    hostedMode,
    isAuthenticated,
    isProfileRoute,
    pathname,
    router,
    shouldRequireProfileCompletion,
    tourModeEnabled,
  ]);

  useEffect(() => {
    if (!dataModeResolved || !isProfileGateReady) {
      logRuntimeDiagnostic('profileGate.loadingShell.visible', {
        dataModeResolved,
        isProfileGateReady,
        pathname,
      });
    }
  }, [dataModeResolved, isProfileGateReady, pathname]);

  if (!dataModeResolved || !isProfileGateReady) {
    return <AppLoadingShell />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
        headerTintColor: isDark ? '#f8f7f3' : '#1a1f16',
        contentStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="sessions" options={{ title: 'Sessions' }} />
      <Stack.Screen name="projects" options={{ title: 'Projects' }} />
      <Stack.Screen name="invoices" options={{ title: 'Invoices' }} />
      <Stack.Screen name="bank" options={{ title: 'Bank' }} />
      <Stack.Screen name="payments" options={{ title: 'Payments' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}

