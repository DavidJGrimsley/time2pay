import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  initializeDatabase,
  listClients,
  updateClientInvoiceContact,
  type Client,
} from '@/database/db';
import { ensureMercuryCustomer } from '@/services/mercury';
import {
  MercuryLogo,
  MercuryStatusNotice,
  type MercuryStatusTone,
} from '@mrdj/mercury-ui';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

const EMPTY_PICKER_VALUE = '';

type MercuryCustomerContactPanelProps = {
  visible: boolean;
};

type StatusState = {
  message: string;
  tone: MercuryStatusTone;
};

function toNullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatMercurySyncError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : 'Mercury customer sync failed.';
  if (rawMessage.includes('403') || rawMessage.toLowerCase().includes('subscriptions')) {
    return 'Mercury banking is connected, but customer sync requires Accounts Receivable access. Mercury sandbox banking access alone will not create AR customers.';
  }

  return rawMessage;
}

export function MercuryCustomerContactPanel({
  visible,
}: MercuryCustomerContactPanelProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    message:
      'Keep the local invoice contact current here. Mercury customer sync requires a customer email and Accounts Receivable access.',
    tone: 'neutral',
  });

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

  useEffect(() => {
    if (!visible) {
      return;
    }

    setIsLoading(true);
    initializeDatabase()
      .then(() => refreshClients())
      .catch((error: unknown) => {
        setStatus({
          message: error instanceof Error ? error.message : 'Failed to load customers.',
          tone: 'error',
        });
      })
      .finally(() => setIsLoading(false));
  }, [refreshClients, visible]);

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

  async function saveClientContact(): Promise<void> {
    if (!selectedClientId) {
      throw new Error('Select a customer to update.');
    }

    const trimmedClientName = clientName.trim();
    if (!trimmedClientName) {
      throw new Error('Customer company/name is required.');
    }

    await updateClientInvoiceContact({
      id: selectedClientId,
      name: trimmedClientName,
      phone: toNullableTrimmed(clientPhone),
      email: toNullableTrimmed(clientEmail),
    });
    await refreshClients(selectedClientId);
  }

  async function handleSaveContact(): Promise<void> {
    setStatus({ message: 'Saving customer contact...', tone: 'neutral' });
    setIsSaving(true);
    try {
      await saveClientContact();
      setStatus({ message: 'Customer contact saved locally.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save customer contact.';
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncCustomer(): Promise<void> {
    if (!selectedClientId) {
      const message = 'Select a customer before syncing.';
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    if (!clientEmail.trim()) {
      const message = 'Add a customer email before syncing the Mercury customer.';
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    setIsSyncing(true);
    setStatus({ message: 'Saving customer contact and syncing to Mercury...', tone: 'neutral' });

    try {
      await saveClientContact();
      await ensureMercuryCustomer({
        name: clientName.trim(),
        email: clientEmail.trim(),
      });
      setStatus({
        message: `Customer contact saved and Mercury customer synced for ${clientName.trim()}.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = formatMercurySyncError(error);
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSyncing(false);
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <View
      style={{
        gap: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#314233',
        backgroundColor: '#0f1711',
        padding: 20,
      }}
    >
      <View style={{ gap: 8 }}>
        <MercuryLogo variant="horizontal" size={220} />
        <Text style={{ color: '#f4fff4', fontSize: 24, fontWeight: '800' }}>Customer Contact</Text>
        <Text style={{ color: '#d4e0d0', fontSize: 14, lineHeight: 20 }}>
          Update the invoice contact details you want Time2Pay to use, then sync that customer to
          Mercury when AR access is available. If a customer was created earlier without an email,
          add it here first.
        </Text>
      </View>

      {clients.length === 0 ? (
        <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
          No customers yet. Create one from the Dashboard timer or GitHub flow, then manage the
          Mercury-facing contact here.
        </Text>
      ) : (
        <>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#314233',
              backgroundColor: '#111911',
              overflow: 'hidden',
            }}
          >
            <Picker
              selectedValue={selectedClientId ?? EMPTY_PICKER_VALUE}
              onValueChange={(value: string | number) => {
                const next = String(value ?? EMPTY_PICKER_VALUE);
                setSelectedClientId(next || null);
              }}
              dropdownIconColor="#f4fff4"
              style={{ color: '#f4fff4', backgroundColor: '#111911' }}
            >
              <Picker.Item
                label="Select customer"
                value={EMPTY_PICKER_VALUE}
                color="#9eb39f"
                style={{ color: '#9eb39f', backgroundColor: '#111911' }}
              />
              {clients.map((client) => (
                <Picker.Item
                  key={client.id}
                  label={client.name}
                  value={client.id}
                  color="#f4fff4"
                  style={{ color: '#f4fff4', backgroundColor: '#111911' }}
                />
              ))}
            </Picker>
          </View>

          <TextInput
            value={clientName}
            onChangeText={setClientName}
            placeholder="Customer company/name"
            placeholderTextColor="#9eb39f"
            style={inputStyle}
          />
          <TextInput
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="Customer phone"
            placeholderTextColor="#9eb39f"
            keyboardType="phone-pad"
            style={inputStyle}
          />
          <TextInput
            value={clientEmail}
            onChangeText={setClientEmail}
            placeholder="Customer email"
            placeholderTextColor="#9eb39f"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Pressable
              onPress={() => {
                handleSaveContact().catch(() => undefined);
              }}
              disabled={isSaving || isSyncing || isLoading || !selectedClientId}
              style={primaryButtonStyle}
            >
              <Text style={primaryButtonTextStyle}>{isSaving ? 'Saving...' : 'Save Contact'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                handleSyncCustomer().catch(() => undefined);
              }}
              disabled={isSaving || isSyncing || isLoading || !selectedClientId}
              style={secondaryButtonStyle}
            >
              <Text style={secondaryButtonTextStyle}>
                {isSyncing ? 'Syncing...' : 'Sync Customer to Mercury'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <MercuryStatusNotice message={status.message} tone={status.tone} />
    </View>
  );
}

const inputStyle = {
  borderRadius: 14,
  borderWidth: 1,
  borderColor: '#314233',
  backgroundColor: '#111911',
  color: '#f4fff4',
  paddingHorizontal: 12,
  paddingVertical: 10,
};

const primaryButtonStyle = {
  borderRadius: 16,
  backgroundColor: '#3b7bd0',
  paddingVertical: 12,
  paddingHorizontal: 18,
  alignItems: 'center' as const,
};

const primaryButtonTextStyle = {
  color: '#ffffff',
  fontWeight: '700' as const,
};

const secondaryButtonStyle = {
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#456049',
  backgroundColor: '#111911',
  paddingVertical: 12,
  paddingHorizontal: 18,
  alignItems: 'center' as const,
};

const secondaryButtonTextStyle = {
  color: '#f4fff4',
  fontWeight: '700' as const,
};
