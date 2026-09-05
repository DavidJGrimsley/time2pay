import { Link, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { initializeDatabase, listClients, type Client } from '@/database/db';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';

type Notice = { message: string; tone: NoticeTone };

export function CustomersListScreen() {
  const [customers, setCustomers] = useState<Client[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(() => {
    initializeDatabase()
      .then(listClients)
      .then(setCustomers)
      .catch((error: unknown) => {
        setNotice({ message: error instanceof Error ? error.message : 'Failed to load customers.', tone: 'error' });
      });
  }, []);

  useEffect(() => load(), [load]);

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-3xl font-extrabold text-heading">Customers</Text>
        <Text className="text-muted">Keep billing contacts, rates, and GitHub organizations in one place.</Text>
      </View>
      <Link href={'/settings/customers/new' as Href} asChild>
        <Pressable className="self-start rounded-md bg-secondary px-4 py-2">
          <Text className="font-semibold text-white">Add customer</Text>
        </Pressable>
      </Link>
      {notice ? <InlineNotice tone={notice.tone} message={notice.message} /> : null}
      {customers.length === 0 ? <Text className="text-sm text-muted">No customers yet.</Text> : null}
      <View className="gap-px overflow-hidden rounded-xl border border-border bg-border">
        {customers.map((customer) => (
          <Link key={customer.id} href={`/settings/customers/${customer.id}` as Href} asChild>
            <Pressable className="flex-row items-center justify-between gap-3 bg-card p-4">
              <View className="flex-1 gap-1">
                <Text className="text-base font-semibold text-heading">{customer.name}</Text>
                <Text className="text-sm text-muted">
                  {customer.email ?? 'No email'} · ${customer.hourly_rate.toFixed(2)}/hr
                </Text>
              </View>
              <Text className="text-2xl text-secondary">→</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}
