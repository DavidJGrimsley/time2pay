import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Dashboard } from './screens/Dashboard';
import { Invoices } from './screens/Invoices';
import { Sessions } from './screens/Sessions';

type RouteKey = 'dashboard' | 'sessions' | 'invoices';

const routes: { key: RouteKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'invoices', label: 'Invoices' },
];

export default function App() {
  const [route, setRoute] = useState<RouteKey>('dashboard');

  const content = useMemo(() => {
    switch (route) {
      case 'sessions':
        return <Sessions />;
      case 'invoices':
        return <Invoices />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  }, [route]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <View style={styles.navRow}>
          {routes.map((nav) => {
            const active = route === nav.key;
            return (
              <Pressable
                key={nav.key}
                style={[styles.navButton, active && styles.navButtonActive]}
                onPress={() => setRoute(nav.key)}
                accessibilityRole="button"
              >
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{nav.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {content}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  wrapper: {
    flex: 1,
    padding: 24,
    rowGap: 16,
  },
  navRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  navButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navButtonActive: {
    backgroundColor: '#111827',
  },
  navLabel: {
    color: '#1f2937',
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#f9fafb',
  },
});
