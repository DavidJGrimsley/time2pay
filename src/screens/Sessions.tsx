import { StyleSheet, Text, View } from 'react-native';
import { SessionList } from '../components/SessionList';

export function Sessions() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sessions</Text>
      <Text style={styles.subtitle}>Track and review your logged work sessions.</Text>
      <SessionList />
    </View>
  );
}

export default Sessions;

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
