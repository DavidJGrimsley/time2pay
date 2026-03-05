import { StyleSheet, Text, View } from 'react-native';

export function Timer() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Timer</Text>
      <Text>Session timing controls will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    rowGap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
});
