import { useEffect, useState } from 'react';
import { getMercuryCredentialStatus, type MercuryCredentialStatus } from '@/services/mercury-credentials';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import type { AppAccessMode } from '@/services/runtime-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export type MercuryKeyStatus = {
  isLoading: boolean;
  accessMode: AppAccessMode | null;
  configured: boolean | null;
  arAccessAvailable: boolean | null;
  requiresSignIn: boolean;
};

export function useMercuryKeyStatus(): MercuryKeyStatus {
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const [isFetching, setIsFetching] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState<MercuryCredentialStatus | null>(null);

  const accessMode: AppAccessMode | null = !dataModeResolved
    ? null
    : hostedMode
      ? tourModeEnabled
        ? 'tour'
        : 'hosted'
      : 'local';

  const needsFetch = accessMode === 'hosted' && isAuthenticated;

  useEffect(() => {
    if (!needsFetch) {
      return;
    }

    let active = true;
    setIsFetching(true);

    getMercuryCredentialStatus()
      .then((status) => {
        if (!active) {
          return;
        }
        setCredentialStatus(status);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCredentialStatus({
          configured: false,
          keyLastFour: null,
          updatedAt: null,
          arAccessAvailable: null,
          arAccessVerifiedAt: null,
        });
      })
      .finally(() => {
        if (active) {
          setIsFetching(false);
        }
      });

    return () => {
      active = false;
    };
  }, [needsFetch]);

  const configured: boolean | null =
    accessMode === 'tour'
      ? true
      : accessMode === 'local'
        ? false
        : accessMode === 'hosted' && !isAuthenticated
          ? false
          : credentialStatus?.configured ?? null;

  const arAccessAvailable: boolean | null =
    accessMode === 'tour'
      ? true
      : accessMode === 'hosted' && configured === true
        ? credentialStatus?.arAccessAvailable ?? null
        : configured === false
          ? false
          : null;

  return {
    isLoading: isFetching,
    accessMode,
    configured,
    arAccessAvailable,
    requiresSignIn: accessMode === 'hosted' && !isAuthenticated,
  };
}
