import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, useColorScheme, View } from 'react-native';
import {
  getUserProfile,
  initializeDatabase,
  listClients,
  upsertUserProfile,
  updateClientInvoiceContact,
  type Client,
} from '@/database/db';
import {
  evaluateProfileCompletion,
  REQUIRED_PROFILE_FIELD_LABELS,
} from '@/services/profile-completion';

const EMPTY_PICKER_VALUE = '';

function toNullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function ProfileOverview() {
  const scheme = useColorScheme();
  const pickerColor = scheme === 'dark' ? '#e8e6e1' : '#1a1f16';

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [status, setStatus] = useState<string>('Loading profile...');

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const refreshClients = useCallback(async (preferredClientId?: string | null): Promise<void> => {
    const clientRows = await listClients();
    setClients(clientRows);
    setSelectedClientId((current) => {
      if (preferredClientId && clientRows.some((client) => client.id === preferredClientId)) {
        return preferredClientId;
      }
      if (current && clientRows.some((client) => client.id === current)) {
        return current;
      }
      return clientRows[0]?.id ?? null;
    });
  }, []);

  const loadProfileData = useCallback(async (): Promise<void> => {
    setStatus('Loading profile...');
    const profile = await getUserProfile();
    setCompanyName(profile.company_name ?? '');
    setLogoUrl(profile.logo_url ?? '');
    setFullName(profile.full_name ?? '');
    setBusinessPhone(profile.phone ?? '');
    setBusinessEmail(profile.email ?? '');
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(() => Promise.all([loadProfileData(), refreshClients()]))
      .then(() => setStatus('Profile loaded.'))
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Failed to load profile.');
      })
      .finally(() => setIsLoading(false));
  }, [loadProfileData, refreshClients]);

  useEffect(() => {
    if (!selectedClient) {
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      return;
    }

    setClientName(selectedClient.name);
    setClientPhone(selectedClient.phone ?? '');
    setClientEmail(selectedClient.email ?? '');
  }, [selectedClient]);

  async function handleSaveBusiness(): Promise<void> {
    setStatus('');
    const trimmedFullName = fullName.trim();
    const trimmedBusinessPhone = businessPhone.trim();
    const trimmedBusinessEmail = businessEmail.trim();
    const completion = evaluateProfileCompletion({
      full_name: trimmedFullName,
      phone: trimmedBusinessPhone,
      email: trimmedBusinessEmail,
    });

    if (!completion.isComplete) {
      const missing = completion.missingFields
        .map((field) => REQUIRED_PROFILE_FIELD_LABELS[field])
        .join(', ');
      setStatus(`Missing required business profile fields: ${missing}.`);
      return;
    }

    setIsSavingBusiness(true);
    try {
      await upsertUserProfile({
        company_name: toNullableTrimmed(companyName),
        logo_url: toNullableTrimmed(logoUrl),
        full_name: trimmedFullName,
        phone: trimmedBusinessPhone,
        email: trimmedBusinessEmail,
      });
      await loadProfileData();
      setStatus('Business profile saved.');
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Failed to save business profile.');
    } finally {
      setIsSavingBusiness(false);
    }
  }

  async function handleSaveClient(): Promise<void> {
    if (!selectedClientId) {
      setStatus('Select a client to update.');
      return;
    }

    const trimmedClientName = clientName.trim();
    if (!trimmedClientName) {
      setStatus('Client company/name is required.');
      return;
    }

    setIsSavingClient(true);
    try {
      await updateClientInvoiceContact({
        id: selectedClientId,
        name: trimmedClientName,
        phone: toNullableTrimmed(clientPhone),
        email: toNullableTrimmed(clientEmail),
      });
      await refreshClients(selectedClientId);
      setStatus('Client invoice contact saved.');
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Failed to save client contact.');
    } finally {
      setIsSavingClient(false);
    }
  }

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Profile</Text>
      <Text className="text-muted">
        Manage invoice sender details and client invoice contact details.
      </Text>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Your Business</Text>
        <TextInput
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Company name (optional)"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={logoUrl}
          onChangeText={setLogoUrl}
          placeholder="Logo URL (optional)"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={businessPhone}
          onChangeText={setBusinessPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={businessEmail}
          onChangeText={setBusinessEmail}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <Pressable
          className="rounded-md bg-secondary px-4 py-2"
          onPress={() => {
            handleSaveBusiness().catch(() => undefined);
          }}
          disabled={isSavingBusiness || isLoading}
        >
          <Text className="text-center font-semibold text-white">
            {isSavingBusiness ? 'Saving...' : 'Save Business Profile'}
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Client Invoice Contact</Text>
        {clients.length === 0 ? (
          <Text className="text-sm text-muted">
            No clients yet. Create one from the Dashboard timer flow, then edit invoice contact info here.
          </Text>
        ) : (
          <>
            <View className="rounded-md border border-border bg-background">
              <Picker
                selectedValue={selectedClientId ?? EMPTY_PICKER_VALUE}
                onValueChange={(value) => {
                  const next = String(value ?? EMPTY_PICKER_VALUE);
                  setSelectedClientId(next || null);
                }}
                dropdownIconColor={pickerColor}
                style={{ color: pickerColor }}
              >
                {clients.map((client) => (
                  <Picker.Item key={client.id} label={client.name} value={client.id} />
                ))}
              </Picker>
            </View>

            <TextInput
              value={clientName}
              onChangeText={setClientName}
              placeholder="Client company/name"
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <TextInput
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="Client phone"
              keyboardType="phone-pad"
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <TextInput
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="Client email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <Pressable
              className="rounded-md bg-secondary px-4 py-2"
              onPress={() => {
                handleSaveClient().catch(() => undefined);
              }}
              disabled={isSavingClient || isLoading || !selectedClientId}
            >
              <Text className="text-center font-semibold text-white">
                {isSavingClient ? 'Saving...' : 'Save Client Contact'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {status ? <Text className="text-sm text-muted">{status}</Text> : null}
    </View>
  );
}
