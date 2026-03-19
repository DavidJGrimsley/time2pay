import { Redirect, useRouter } from 'expo-router';
import { HostedAuthGate } from '@/components/hosted-auth-gate';
import { isHostedMode } from '@/services/runtime-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function SignInRoute() {
  const router = useRouter();
  const hostedMode = isHostedMode();
  const startTour = useAuthUiStore((state) => state.startTour);

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

