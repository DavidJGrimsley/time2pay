import { Redirect } from 'expo-router';

import { AppLoadingShell } from '@/components/app-loading-shell';
import { HostedAuthGate } from '@/components/hosted-auth-gate';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';

export default function OnboardingAuthScreen() {
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();

  if (!dataModeResolved) {
    return <AppLoadingShell />;
  }

  if (!hostedMode) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <HostedAuthGate
      description="Use an email magic link or GitHub to create or open your Time2Pay account. After authentication, you will review the legal documents once and enter the app."
      githubLabel="Continue with GitHub"
      magicLinkLabel="Send account link"
      redirectPath="/onboarding/legal"
      shouldCreateUser
      title="Create or open your Time2Pay account"
    />
  );
}
