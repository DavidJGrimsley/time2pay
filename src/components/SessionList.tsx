import { StyleSheet, Text, View } from 'react-native';

export function SessionList() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Session List</Text>
      <Text>Logged work sessions will be listed here.</Text>
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
