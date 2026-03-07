import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { testMercuryConnection } from '@/services/mercury';

export function InvoiceBuilder() {
  const [mercuryStatus, setMercuryStatus] = useState<string>('Not checked yet');

  async function handleMercuryCheck(): Promise<void> {
    setMercuryStatus('Checking Mercury API connection...');
    try {
      const result = await testMercuryConnection();
      setMercuryStatus(`Mercury connected (${result.environment}).`);
    } catch (error: unknown) {
      setMercuryStatus(error instanceof Error ? error.message : 'Mercury connection failed');
    }
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <Text className="text-xl font-bold text-heading">Invoice Builder</Text>
      <Text className="text-muted">
        Ready: totals calculation, PayPal payment-link validation, session-to-invoice linking,
        optional Mercury invoice sync, and jsPDF export service are implemented.
      </Text>
      <Pressable className="rounded-md border border-border px-4 py-2" onPress={handleMercuryCheck}>
        <Text className="text-center font-semibold text-heading">Test Mercury Connection</Text>
      </Pressable>
      <Text className="text-sm text-muted">{mercuryStatus}</Text>
    </View>
  );
}
