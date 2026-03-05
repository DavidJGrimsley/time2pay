import { StyleSheet, Text, View } from 'react-native';
import { InvoiceBuilder } from '../components/InvoiceBuilder';

export function Invoices() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Invoices</Text>
      <Text style={styles.subtitle}>Create and manage client invoices.</Text>
      <InvoiceBuilder />
    </View>
  );
}

export default Invoices;

const styles = StyleSheet.create({
  container: {
    rowGap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4b5563',
  },
});
