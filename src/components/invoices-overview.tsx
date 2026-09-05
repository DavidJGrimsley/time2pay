import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MercurySessionInvoiceWorkspace } from '@mr.dj2u/mercury-ui';
import { InvoiceBuilder } from './InvoiceBuilder';
import { InvoiceHistory } from './InvoiceHistory';
import { MercuryKeyGate } from './mercury-key-gate';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import { useTime2PayMercurySessionWorkspace } from '@/hooks/use-time2pay-mercury-session-workspace';
import { mercuryUiAdapter } from '@/services/mercury-ui-adapters';
import { getUserProfile, upsertUserProfile, type InvoiceBuilderMode } from '@/database/db';

export function InvoicesOverview() {
  const { width } = useStableWindowDimensions();
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };
  const [refreshKey, setRefreshKey] = useState(0);
  const [builderMode, setBuilderMode] = useState<InvoiceBuilderMode>('t2p');
  const triggerRefresh = () => setRefreshKey((current) => current + 1);
  const sessionAdapter = useTime2PayMercurySessionWorkspace({
    onInvoiceCreated: triggerRefresh,
    refreshKey,
  });

  useEffect(() => {
    getUserProfile()
      .then((profile) => setBuilderMode(profile.invoice_builder_mode ?? 't2p'))
      .catch(() => setBuilderMode('t2p'));
  }, []);

  function selectBuilderMode(mode: InvoiceBuilderMode): void {
    setBuilderMode(mode);
    upsertUserProfile({ invoice_builder_mode: mode }).catch(() => undefined);
  }

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
                const label = mode === 't2p' ? 'Time2Pay' : 'Mercury';
                return (
                  <Pressable
                    key={mode}
                    className={active ? 'flex-1 rounded bg-secondary px-3 py-2 md:flex-none' : 'flex-1 rounded px-3 py-2 md:flex-none'}
                    onPress={() => selectBuilderMode(mode)}
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

          {builderMode === 'mercury' ? (
            <MercuryKeyGate requireArAccess>
              <MercurySessionInvoiceWorkspace
                adapter={mercuryUiAdapter}
                sessionAdapter={sessionAdapter}
              />
            </MercuryKeyGate>
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
