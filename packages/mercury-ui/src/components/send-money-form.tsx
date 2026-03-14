import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
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
    if (!selectedRecipientId && recipients[0]?.id) {
      setSelectedRecipientId(recipients[0].id);
    }
  }, [recipients, selectedRecipientId]);

  const payload = useMemo<MercurySendMoneyInput>(
    () => ({
      idempotencyKey,
      recipientId: selectedRecipientId ?? undefined,
      amount: Number(amount) || 0,
      memo,
    }),
    [amount, idempotencyKey, memo, selectedRecipientId],
  );
  const parsedAmount = Number(amount);
  const canSubmit = Boolean(
    selectedAccountId &&
      selectedRecipientId &&
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
        <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} style={inputStyle} keyboardType="decimal-pad" />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>Memo</Text>
        <TextInput value={memo} onChangeText={setMemo} style={inputStyle} />
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
          style={{ alignSelf: 'flex-start' }}
        >
          <Text style={{ color: mercuryUiTheme.colors.accent, fontWeight: '700' }}>Generate new key</Text>
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
