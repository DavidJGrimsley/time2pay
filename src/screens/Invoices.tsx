import { StyleSheet, Text, View } from 'react-native';
import { InvoiceBuilder } from '../components/InvoiceBuilder';

export function InvoicesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Invoices</Text>
      <Text style={styles.subtitle}>Create and manage client invoices.</Text>
      <InvoiceBuilder />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4b5563',
  },
});
