import { useState } from 'react';
import { type Href, Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { resetTourDemoData } from '@/services/tour-demo';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export function WorkspaceNavBanner() {
  const [isResettingTour, setIsResettingTour] = useState(false);
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const tourInitError = useAuthUiStore((state) => state.tourInitError);
  const setTourInitError = useAuthUiStore((state) => state.setTourInitError);
  const showTourBanner = dataModeResolved && tourModeEnabled;
  const showSignInBanner = dataModeResolved && !isAuthenticated && (hostedMode || tourModeEnabled);
  const showModeBanner = showTourBanner || showSignInBanner;

  async function handleResetTour(): Promise<void> {
    setIsResettingTour(true);
    try {
      await resetTourDemoData();
      setTourInitError(null);
    } catch (error) {
      setTourInitError(error instanceof Error ? error.message : 'Failed to reset tour data.');
    } finally {
      setIsResettingTour(false);
    }
  }

  if (!showModeBanner && !tourInitError) {
    return null;
  }

  return (
    <View className="gap-2">
      {showModeBanner ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Text className="text-xs text-muted">
            {tourModeEnabled
              ? hostedMode
                ? 'Tour mode active. Sign in to save data to your hosted account.'
                : 'Tour mode active. Sign in to exit the tour and use your own local data.'
              : 'Sign in to unlock hosted account sync.'}
          </Text>
          {showSignInBanner ? (
            <Link href={'/sign-in' as Href} asChild>
              <Pressable className="rounded-full bg-secondary px-3 py-1.5">
                <Text className="text-xs font-semibold text-white">Sign In</Text>
              </Pressable>
            </Link>
          ) : null}
          {tourModeEnabled ? (
            <Pressable
              className="rounded-full border border-border px-3 py-1.5"
              onPress={() => {
                handleResetTour().catch(() => undefined);
              }}
              disabled={isResettingTour}
            >
              <Text className="text-xs font-semibold text-heading">
                {isResettingTour ? 'Resetting...' : 'Reset Tour'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {tourInitError ? (
        <View className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-2">
          <Text className="text-xs text-danger">{tourInitError}</Text>
        </View>
      ) : null}
    </View>
  );
}
