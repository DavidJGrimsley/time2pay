import { StyleSheet, Text, View } from 'react-native';
import { Timer } from '../components/Timer';

export function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>
      <Text style={styles.subtitle}>Quick snapshot of your work and billing flow.</Text>
      <Timer />
    </View>
  );
}

export default Dashboard;

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
