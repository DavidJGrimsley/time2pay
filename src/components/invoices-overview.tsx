import { Link, type Href } from 'expo-router';
import React from 'react';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MercurySessionInvoiceWorkspace } from '@mr.dj2u/mercury-ui';
import { InvoiceBuilder } from './InvoiceBuilder';
import { InvoiceHistory } from './InvoiceHistory';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { useTime2PayMercurySessionWorkspace } from '@/hooks/use-time2pay-mercury-session-workspace';
import { getMercuryCredentialStatus, type MercuryCredentialStatus } from '@/services/mercury-credentials';
import { mercuryUiAdapter } from '@/services/mercury-ui-adapters';
import { useAuthUiStore } from '@/stores/auth-ui-store';

type InvoiceBuilderMode = 't2p' | 'mercury';

export function InvoicesOverview() {
  const { width } = useStableWindowDimensions();
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };
  const [refreshKey, setRefreshKey] = useState(0);
  const [builderMode, setBuilderMode] = useState<InvoiceBuilderMode>('t2p');
  const [mercuryCredentialStatus, setMercuryCredentialStatus] =
    useState<MercuryCredentialStatus | null>(null);
  const [isLoadingMercuryCredentialStatus, setIsLoadingMercuryCredentialStatus] = useState(false);
  const triggerRefresh = () => setRefreshKey((current) => current + 1);
  const sessionAdapter = useTime2PayMercurySessionWorkspace({
    onInvoiceCreated: triggerRefresh,
    refreshKey,
  });
  const accessMode =
    dataModeResolved && hostedMode
      ? tourModeEnabled
        ? 'tour'
        : 'hosted'
      : 'local';
  const needsHostedMercuryCredential = accessMode === 'hosted' && isAuthenticated;
  const mercuryRequiresHostedMode = accessMode === 'local';
  const mercuryRequiresSignIn = accessMode === 'hosted' && !isAuthenticated;
  const mercuryCredentialReady =
    accessMode === 'tour' ||
    (needsHostedMercuryCredential && Boolean(mercuryCredentialStatus?.configured));
  const mercurySetupTitle = mercuryRequiresHostedMode
    ? 'Hosted mode required'
    : mercuryRequiresSignIn
      ? 'Sign in required'
      : 'Mercury API key required';
  const mercurySetupMessage = mercuryRequiresHostedMode
    ? 'Mercury production actions now use the signed-in user key saved in Supabase. Switch to hosted mode, or use tour mode for sandbox credentials.'
    : mercuryRequiresSignIn
      ? 'Sign in before using the Mercury invoice builder.'
      : 'Save your Mercury production API key in Profile before using the Mercury invoice builder.';

  useEffect(() => {
    let active = true;

    if (builderMode !== 'mercury' || !needsHostedMercuryCredential) {
      setIsLoadingMercuryCredentialStatus(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingMercuryCredentialStatus(true);
    getMercuryCredentialStatus()
      .then((status) => {
        if (!active) {
          return;
        }
        setMercuryCredentialStatus(status);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setMercuryCredentialStatus({ configured: false, keyLastFour: null, updatedAt: null });
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('Failed to load Mercury credential status:', error);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingMercuryCredentialStatus(false);
        }
      });

    return () => {
      active = false;
    };
  }, [builderMode, needsHostedMercuryCredential]);

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Invoices</Text>
      <Text className="text-muted">Create and manage client invoices.</Text>
      <View className="items-center">
        <View className="w-full gap-3" style={contentWidthStyle}>
          <View className="items-stretch md:items-end">
            <View className="flex-row rounded-md border border-border bg-background p-1">
              {(['t2p', 'mercury'] as InvoiceBuilderMode[]).map((mode) => {
                const active = builderMode === mode;
                const label = mode === 't2p' ? 'T2P Invoice Builder' : 'Mercury Invoice Builder';
                return (
                  <Pressable
                    key={mode}
                    className={active ? 'flex-1 rounded bg-secondary px-3 py-2 md:flex-none' : 'flex-1 rounded px-3 py-2 md:flex-none'}
                    onPress={() => setBuilderMode(mode)}
                  >
                    <Text
                      className={active ? 'text-center text-sm font-semibold text-white' : 'text-center text-sm font-semibold text-heading'}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {builderMode === 'mercury' && isLoadingMercuryCredentialStatus ? (
            <View className="rounded-xl border border-border bg-card p-4">
              <Text className="text-muted">Checking saved Mercury API key...</Text>
            </View>
          ) : null}
          {builderMode === 'mercury' && !isLoadingMercuryCredentialStatus && !mercuryCredentialReady ? (
            <View className="gap-3 rounded-xl border border-border bg-card p-4">
              <Text className="text-lg font-bold text-heading">{mercurySetupTitle}</Text>
              <Text className="text-sm text-muted">{mercurySetupMessage}</Text>
              {!mercuryRequiresHostedMode ? (
                <Link href={(mercuryRequiresSignIn ? '/sign-in' : '/profile') as Href} asChild>
                  <Pressable className="self-start rounded-md bg-secondary px-4 py-2">
                    <Text className="font-semibold text-white">
                      {mercuryRequiresSignIn ? 'Sign In' : 'Open Profile'}
                    </Text>
                  </Pressable>
                </Link>
              ) : null}
            </View>
          ) : null}
          {builderMode === 'mercury' && mercuryCredentialReady && !isLoadingMercuryCredentialStatus ? (
            <MercurySessionInvoiceWorkspace
              adapter={mercuryUiAdapter}
              sessionAdapter={sessionAdapter}
            />
          ) : null}
          {builderMode === 't2p' ? (
            <InvoiceBuilder onInvoiceCreated={triggerRefresh} refreshKey={refreshKey} />
          ) : null}
          <InvoiceHistory refreshKey={refreshKey} onInvoiceDeleted={triggerRefresh} />
        </View>
      </View>
    </View>
  );
}
