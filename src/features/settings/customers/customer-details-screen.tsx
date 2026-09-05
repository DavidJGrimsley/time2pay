import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { getClientById, initializeDatabase, updateClientDetails } from '@/database/db';
import { createTime2PayClient } from '@/services/client-sync';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';

type Notice = { message: string; tone: NoticeTone };

function createId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nullable(value: string): string | null {
  return value.trim() || null;
}

export function CustomerDetailsScreen({ isNew = false }: { isNew?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const customerId = !isNew && typeof params.id === 'string' ? params.id : null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('0');
  const [githubOrg, setGithubOrg] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    initializeDatabase()
      .then(() => getClientById(customerId))
      .then((customer) => {
        if (!customer) {
          setNotice({ message: 'Customer not found.', tone: 'error' });
          return;
        }
        setName(customer.name);
        setEmail(customer.email ?? '');
        setPhone(customer.phone ?? '');
        setHourlyRate(customer.hourly_rate.toString());
        setGithubOrg(customer.github_org ?? '');
      })
      .catch((error: unknown) => setNotice({ message: error instanceof Error ? error.message : 'Failed to load customer.', tone: 'error' }));
  }, [customerId]);

  async function save(): Promise<void> {
    const rate = Number(hourlyRate);
    if (!name.trim()) {
      setNotice({ message: 'Customer name is required.', tone: 'error' });
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setNotice({ message: 'Hourly rate must be a non-negative number.', tone: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      if (customerId) {
        await updateClientDetails({
          id: customerId,
          name: name.trim(),
          email: nullable(email),
          phone: nullable(phone),
          hourly_rate: rate,
          github_org: nullable(githubOrg),
        });
      } else {
        await createTime2PayClient({
          id: createId(),
          name: name.trim(),
          email: nullable(email),
          phone: nullable(phone),
          hourly_rate: rate,
          github_org: nullable(githubOrg),
        });
      }
      router.replace('/settings/customers');
    } catch (error: unknown) {
      setNotice({ message: error instanceof Error ? error.message : 'Failed to save customer.', tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-3xl font-extrabold text-heading">{customerId ? 'Edit customer' : 'New customer'}</Text>
        <Text className="text-muted">These details are used for time entry, invoices, and GitHub context.</Text>
      </View>
      <View className="gap-3 rounded-xl bg-card p-4">
        {([
          { label: 'Name', value: name, onChange: setName, placeholder: 'Customer name' },
          { label: 'Email', value: email, onChange: setEmail, placeholder: 'billing@example.com' },
          { label: 'Phone', value: phone, onChange: setPhone, placeholder: 'Phone number' },
          { label: 'Hourly rate', value: hourlyRate, onChange: setHourlyRate, placeholder: '0' },
          { label: 'GitHub organization', value: githubOrg, onChange: setGithubOrg, placeholder: 'organization (optional)' },
        ] as const).map(({ label, value, onChange, placeholder }) => (
          <View key={label} className="gap-1">
            <Text className="text-xs uppercase tracking-wide text-muted">{label}</Text>
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder={placeholder}
              autoCapitalize={label === 'GitHub organization' || label === 'Email' ? 'none' : 'words'}
              keyboardType={label === 'Hourly rate' ? 'decimal-pad' : label === 'Email' ? 'email-address' : 'default'}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </View>
        ))}
        {notice ? <InlineNotice tone={notice.tone} message={notice.message} /> : null}
        <View className="flex-row gap-2">
          <Pressable disabled={isSaving} className={`rounded-md bg-secondary px-4 py-2 ${isSaving ? 'opacity-60' : ''}`} onPress={() => save().catch(() => undefined)}>
            <Text className="font-semibold text-white">{isSaving ? 'Saving...' : 'Save customer'}</Text>
          </Pressable>
          <Pressable className="rounded-md border border-border px-4 py-2" onPress={() => router.back()}>
            <Text className="font-semibold text-heading">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
