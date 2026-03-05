import { Text, View } from 'react-native';
import { InvoiceBuilder } from './InvoiceBuilder';

export function InvoicesOverview() {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Invoices</Text>
      <Text className="text-muted">Create and manage client invoices.</Text>
      <InvoiceBuilder />
    </View>
  );
}
