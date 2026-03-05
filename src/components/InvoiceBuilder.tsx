import { StyleSheet, Text, View } from 'react-native';

export function InvoiceBuilder() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Invoice Builder</Text>
      <Text>Invoice drafting workflow will be implemented here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
});
