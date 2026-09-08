import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useUniwind } from 'uniwind';
import { tabTint } from '@/components/workspace-nav';

export function AppNativeTabs() {
  const { theme } = useUniwind();
  const tintColor = tabTint(theme === 'dark');

  return (
    <NativeTabs tintColor={tintColor}>
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sessions">
        <NativeTabs.Trigger.Icon sf="clock.fill" md="schedule" />
        <NativeTabs.Trigger.Label>Sessions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="invoices">
        <NativeTabs.Trigger.Icon sf="doc.text.fill" md="description" />
        <NativeTabs.Trigger.Label>Invoices</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mercury">
        <NativeTabs.Trigger.Icon sf="building.columns.fill" md="account_balance" />
        <NativeTabs.Trigger.Label>Mercury</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
