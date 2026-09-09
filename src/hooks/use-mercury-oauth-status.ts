import { useEffect, useState } from 'react';
import {
  getMercuryOAuthStatus,
  type MercuryOAuthConnectionStatus,
} from '@/services/mercury-oauth';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export function useMercuryOAuthStatus(): {
  isLoading: boolean;
  status: MercuryOAuthConnectionStatus | null;
} {
  const { hostedMode, resolved } = useResolvedDataMode();
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const shouldFetch = resolved && hostedMode && isAuthenticated && !tourModeEnabled;
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<MercuryOAuthConnectionStatus | null>(null);

  useEffect(() => {
    if (!shouldFetch) {
      setStatus(null);
      return;
    }
    let active = true;
    setIsLoading(true);
    getMercuryOAuthStatus()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus);
      })
      .catch(() => {
        if (active) setStatus(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shouldFetch]);

  return { isLoading, status };
}
