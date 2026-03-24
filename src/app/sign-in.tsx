import { Redirect, useRouter } from 'expo-router';
import { HostedAuthGate } from '@/components/hosted-auth-gate';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function SignInRoute() {
  const router = useRouter();
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const startTour = useAuthUiStore((state) => state.startTour);

  if (!dataModeResolved) {
    return <AppLoadingShell />;
  }

  if (!hostedMode) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <HostedAuthGate
      onTourExperience={() => {
        startTour();
        router.replace('/dashboard');
      }}
    />
  );
}
