import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  createMercuryIdempotencyKey,
  type MercuryAccount,
  type MercuryRecipient,
  type MercurySendMoneyInput,
} from '@mrdj/mercury';
import { AccountsSelect } from './accounts-select';
import { MercuryCard } from './mercury-card';
import { MercuryStatusNotice, type MercuryStatusTone } from './mercury-status-notice';
import { RecipientPicker } from './recipient-picker';
import { mercuryUiTheme } from '../theme';

function extractRecipientPaymentMethod(recipient: MercuryRecipient | null): string | null {
  if (!recipient) {
    return null;
  }

  const directCandidates = [recipient.paymentMethod, recipient.defaultPaymentMethod];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (!Array.isArray(recipient.paymentMethods)) {
    return null;
  }

  for (const method of recipient.paymentMethods) {
    if (typeof method === 'string' && method.trim()) {
      return method.trim();
    }

    if (!method || typeof method !== 'object' || Array.isArray(method)) {
      continue;
    }

    const record = method as Record<string, unknown>;
    const nestedCandidates = [record.paymentMethod, record.method, record.type];
    for (const candidate of nestedCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
}

function formatPaymentMethodLabel(value: string | null): string {
  if (!value) {
    return 'Unavailable';
  }

  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type SendMoneyFormProps = {
  accounts: MercuryAccount[];
  recipients: MercuryRecipient[];
  onSubmit: (accountId: string, input: MercurySendMoneyInput) => Promise<void> | void;
  busy?: boolean;
  status?: { message: string; tone: MercuryStatusTone };
};

export function SendMoneyForm({
  accounts,
  recipients,
  onSubmit,
  busy = false,
  status,
}: SendMoneyFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(recipients[0]?.id ?? null);
  const [amount, setAmount] = useState('0');
  const [memo, setMemo] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(createMercuryIdempotencyKey('send_money'));
  const [showIdempotencyHelp, setShowIdempotencyHelp] = useState(false);

  useEffect(() => {
    if (!selectedAccountId && accounts[0]?.id) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (
      (!selectedRecipientId || !recipients.some((recipient) => recipient.id === selectedRecipientId)) &&
      recipients[0]?.id
    ) {
      setSelectedRecipientId(recipients[0].id);
    }
  }, [recipients, selectedRecipientId]);

  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null,
    [recipients, selectedRecipientId],
  );
  const paymentMethod = useMemo(
    () => extractRecipientPaymentMethod(selectedRecipient),
    [selectedRecipient],
  );

  const payload = useMemo<MercurySendMoneyInput>(
    () => ({
      idempotencyKey,
      recipientId: selectedRecipientId ?? undefined,
      paymentMethod: paymentMethod ?? undefined,
      amount: Number(amount) || 0,
      memo,
    }),
    [amount, idempotencyKey, memo, paymentMethod, selectedRecipientId],
  );
  const parsedAmount = Number(amount);
  const canSubmit = Boolean(
    selectedAccountId &&
      selectedRecipientId &&
      paymentMethod &&
      Number.isFinite(parsedAmount) &&
      parsedAmount > 0 &&
      idempotencyKey.trim(),
  );

  return (
    <MercuryCard
      title="Send Money"
      subtitle="Enter amount and recipient, then submit once. Retries should reuse the same idempotency key."
    >
      <AccountsSelect
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
        label="Source account"
      />
      <RecipientPicker
        recipients={recipients}
        selectedRecipientId={selectedRecipientId}
        onSelect={setSelectedRecipientId}
      />
      <View style={{ gap: 8 }}>
        <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>Payment method</Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: paymentMethod ? mercuryUiTheme.colors.border : '#f5c2c7',
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: paymentMethod ? mercuryUiTheme.colors.surface : '#fff5f5',
          }}
        >
          <Text
            style={{
              color: paymentMethod ? mercuryUiTheme.colors.text : '#b42318',
              fontWeight: '600',
            }}
          >
            {paymentMethod
              ? formatPaymentMethodLabel(paymentMethod)
              : 'This recipient does not expose a usable Mercury payment method yet.'}
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} style={inputStyle} keyboardType="decimal-pad" />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>Memo</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          style={memoInputStyle}
          multiline
          textAlignVertical="top"
        />
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>Idempotency key</Text>
          <Pressable
            onPress={() => setShowIdempotencyHelp((value) => !value)}
            onHoverIn={() => setShowIdempotencyHelp(true)}
            onHoverOut={() => setShowIdempotencyHelp(false)}
            accessibilityRole="button"
            accessibilityLabel="What is an idempotency key?"
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: mercuryUiTheme.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mercuryUiTheme.colors.accentSoft,
            }}
          >
            <Text style={{ color: mercuryUiTheme.colors.accent, fontSize: 11, fontWeight: '800' }}>i</Text>
          </Pressable>
        </View>
        {showIdempotencyHelp ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#bfd4eb',
              borderRadius: 12,
              backgroundColor: '#eff6ff',
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#14345a', fontSize: 12, lineHeight: 18 }}>
              A unique key that prevents duplicate payouts if the same request is retried. Reuse the
              same key for retries, generate a new one for a new payment.
            </Text>
          </View>
        ) : null}
        <TextInput value={idempotencyKey} onChangeText={setIdempotencyKey} style={inputStyle} autoCapitalize="none" />
        <Pressable
          onPress={() => setIdempotencyKey(createMercuryIdempotencyKey('send_money'))}
          style={{ alignSelf: compact ? 'stretch' : 'flex-start' }}
        >
          <Text
            style={{
              color: mercuryUiTheme.colors.accent,
              fontWeight: '700',
              textAlign: compact ? 'center' : 'left',
            }}
          >
            Generate new key
          </Text>
        </Pressable>
      </View>
      {status ? <MercuryStatusNotice message={status.message} tone={status.tone} /> : null}
      <Pressable
        onPress={() => selectedAccountId && onSubmit(selectedAccountId, payload)}
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
          {busy ? 'Sending...' : 'Send via Mercury'}
        </Text>
      </Pressable>
    </MercuryCard>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: mercuryUiTheme.colors.border,
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: mercuryUiTheme.colors.text,
  backgroundColor: mercuryUiTheme.colors.surface,
};

const memoInputStyle = {
  ...inputStyle,
  minHeight: 88,
};
