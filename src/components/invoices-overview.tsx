import { useState } from 'react';
import { Text, View } from 'react-native';
import { InvoiceBuilder } from './InvoiceBuilder';
import { InvoiceHistory } from './InvoiceHistory';

export function InvoicesOverview() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Invoices</Text>
      <Text className="text-muted">Create and manage client invoices.</Text>
      <InvoiceBuilder onInvoiceCreated={() => setRefreshKey((current) => current + 1)} />
      <InvoiceHistory refreshKey={refreshKey} />
    </View>
  );
}
