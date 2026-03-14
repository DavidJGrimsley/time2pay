import { useEffect, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { InvoiceBuilder } from './InvoiceBuilder';
import { InvoiceHistory } from './InvoiceHistory';
import { MercurySessionInvoiceBuilder } from './mercury-session-invoice-builder';
import { testMercuryConnection, testMercuryInvoiceAccess } from '@/services/mercury';

type InvoiceBuilderMode = 'checking' | 'generic' | 'mercury';

export function InvoicesOverview() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };
  const [refreshKey, setRefreshKey] = useState(0);
  const [builderMode, setBuilderMode] = useState<InvoiceBuilderMode>('checking');
  const [builderModeMessage, setBuilderModeMessage] = useState(
    'Checking whether Mercury invoice mode is available in this environment...',
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const result = await testMercuryInvoiceAccess();
        if (!active) {
          return;
        }

        setBuilderMode('mercury');
        setBuilderModeMessage(
          `Mercury invoicing is enabled (${result.environment}). Using the Time2Pay Mercury invoice builder.`,
        );
        return;
      } catch {
        try {
          const result = await testMercuryConnection();
          if (!active) {
            return;
          }

          setBuilderMode('generic');
          setBuilderModeMessage(
            `Mercury is connected (${result.environment}), but Accounts Receivable invoicing is not enabled here yet. Using the standard Time2Pay invoice builder.`,
          );
        } catch {
          if (!active) {
            return;
          }

          setBuilderMode('generic');
          setBuilderModeMessage(
            'Mercury is unavailable here, so the standard Time2Pay invoice builder is active.',
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Invoices</Text>
      <Text className="text-muted">Create and manage client invoices.</Text>
      <Text className="text-sm text-muted">{builderModeMessage}</Text>
      <View className="items-center">
        <View className="w-full gap-3" style={contentWidthStyle}>
          {builderMode === 'mercury' ? (
            <MercurySessionInvoiceBuilder
              onInvoiceCreated={() => setRefreshKey((current) => current + 1)}
            />
          ) : null}
          {builderMode === 'generic' ? (
            <InvoiceBuilder onInvoiceCreated={() => setRefreshKey((current) => current + 1)} />
          ) : null}
          {builderMode === 'checking' ? (
            <View className="rounded-xl border border-border bg-card p-4">
              <Text className="text-muted">Checking Mercury connection before choosing the invoice flow...</Text>
            </View>
          ) : null}
          <InvoiceHistory refreshKey={refreshKey} />
        </View>
      </View>
    </View>
  );
}
