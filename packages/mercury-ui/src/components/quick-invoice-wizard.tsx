import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { MercuryAccount, MercuryInvoicePayload } from '@mrdj/mercury';
import { AccountsSelect } from './accounts-select';
import { MercuryCard } from './mercury-card';
import { MercuryStatusNotice, type MercuryStatusTone } from './mercury-status-notice';
import { mercuryUiTheme } from '../theme';

type QuickInvoiceWizardProps = {
  accounts: MercuryAccount[];
  onSubmit: (payload: MercuryInvoicePayload) => Promise<void> | void;
  busy?: boolean;
  status?: { message: string; tone: MercuryStatusTone };
  defaults?: Partial<MercuryInvoicePayload>;
  resetKey?: string | number;
};

function buildDefaultsSignature(defaults: Partial<MercuryInvoicePayload> | undefined): string {
  return JSON.stringify({
    customerName: defaults?.customerName ?? '',
    customerEmail: defaults?.customerEmail ?? '',
    description: defaults?.description ?? '',
    amount: defaults?.amount ?? '',
    destinationAccountId: defaults?.destinationAccountId ?? '',
  });
}

export function QuickInvoiceWizard({
  accounts,
  onSubmit,
  busy = false,
  status,
  defaults,
  resetKey,
}: QuickInvoiceWizardProps) {
  const defaultsSignature = buildDefaultsSignature(defaults);
  const [customerName, setCustomerName] = useState(defaults?.customerName ?? '');
  const [customerEmail, setCustomerEmail] = useState(defaults?.customerEmail ?? '');
  const [description, setDescription] = useState(defaults?.description ?? '');
  const [amount, setAmount] = useState(
    typeof defaults?.amount === 'number' && Number.isFinite(defaults.amount)
      ? `${defaults.amount}`
      : '',
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    defaults?.destinationAccountId ?? accounts[0]?.id ?? null,
  );

  useEffect(() => {
    setCustomerName(defaults?.customerName ?? '');
    setCustomerEmail(defaults?.customerEmail ?? '');
    setDescription(defaults?.description ?? '');
    setAmount(
      typeof defaults?.amount === 'number' && Number.isFinite(defaults.amount)
        ? `${defaults.amount}`
        : '',
    );
    setSelectedAccountId(defaults?.destinationAccountId ?? accounts[0]?.id ?? null);
  }, [accounts, defaults, defaultsSignature, resetKey]);

  useEffect(() => {
    if (!selectedAccountId && accounts[0]?.id) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const payload = useMemo<MercuryInvoicePayload>(
    () => ({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      description: description.trim() || undefined,
      amount: Number(amount) || 0,
      destinationAccountId: selectedAccountId ?? undefined,
    }),
    [amount, customerEmail, customerName, description, selectedAccountId],
  );

  const canSubmit = Boolean(
    customerName.trim() &&
      customerEmail.trim() &&
      selectedAccountId &&
      Number(payload.amount) > 0,
  );

  return (
    <MercuryCard
      title="Quick Invoice Builder"
      subtitle="The lean Mercury AR builder for developers who want customer, amount, and routing only."
    >
      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Customer name</Text>
        <TextInput value={customerName} onChangeText={setCustomerName} style={inputStyle} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Customer email</Text>
        <TextInput
          value={customerEmail}
          onChangeText={setCustomerEmail}
          style={inputStyle}
          autoCapitalize="none"
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} style={inputStyle} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          style={inputStyle}
          keyboardType="decimal-pad"
        />
      </View>

      <AccountsSelect
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
      />

      {status ? <MercuryStatusNotice message={status.message} tone={status.tone} /> : null}

      <Pressable
        onPress={() => onSubmit(payload)}
        disabled={!canSubmit || busy}
        style={{
          borderRadius: 16,
          backgroundColor: canSubmit ? mercuryUiTheme.colors.accent : '#9db6d3',
          paddingVertical: 12,
          alignItems: 'center',
          opacity: busy ? 0.85 : 1,
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '700' }}>
          {busy ? 'Creating...' : 'Create Quick Mercury Invoice'}
        </Text>
      </Pressable>
    </MercuryCard>
  );
}

const labelStyle = {
  color: mercuryUiTheme.colors.text,
  fontWeight: '700' as const,
};

const inputStyle = {
  borderWidth: 1,
  borderColor: mercuryUiTheme.colors.border,
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: mercuryUiTheme.colors.text,
  backgroundColor: mercuryUiTheme.colors.surface,
};
