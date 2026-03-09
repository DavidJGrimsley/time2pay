import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { InvoiceBuilder } from './InvoiceBuilder';
import { InvoiceHistory } from './InvoiceHistory';

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

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Invoices</Text>
      <Text className="text-muted">Create and manage client invoices.</Text>
      <View className="items-center">
        <View className="w-full gap-3" style={contentWidthStyle}>
          <InvoiceBuilder onInvoiceCreated={() => setRefreshKey((current) => current + 1)} />
          <InvoiceHistory refreshKey={refreshKey} />
        </View>
      </View>
    </View>
  );
}
