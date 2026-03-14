import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type {
  MercuryAccount,
  MercuryInvoicePayload,
  MercuryLineItemPayload,
  MercurySendEmailOption,
} from '@mrdj/mercury';
import { AccountsSelect } from './accounts-select';
import { MercuryCard } from './mercury-card';
import { MercuryStatusNotice, type MercuryStatusTone } from './mercury-status-notice';
import { mercuryUiTheme } from '../theme';

export type InvoiceWizardStatus = { message: string; tone: MercuryStatusTone };

type InvoiceWizardProps = {
  accounts: MercuryAccount[];
  onSubmit: (payload: MercuryInvoicePayload) => Promise<void> | void;
  busy?: boolean;
  status?: InvoiceWizardStatus;
  defaults?: Partial<MercuryInvoicePayload>;
  resetKey?: string | number;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  footer?: ReactNode;
};

type LineItemDraft = {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
  salesTaxRate: string;
};

function toDayInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createLineItemDraft(): LineItemDraft {
  return {
    id: `line_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    quantity: '',
    unitPrice: '',
    salesTaxRate: '',
  };
}

function buildLineItemDrafts(lineItems: MercuryLineItemPayload[] | undefined): LineItemDraft[] {
  if (!lineItems || lineItems.length === 0) {
    return [createLineItemDraft()];
  }

  return lineItems.map((lineItem, index) => ({
    id: `line_item_seed_${index}_${Math.random().toString(36).slice(2, 7)}`,
    name: lineItem.name ?? '',
    quantity: `${lineItem.quantity ?? ''}`,
    unitPrice: `${lineItem.unitPrice ?? ''}`,
    salesTaxRate:
      lineItem.salesTaxRate == null
        ? ''
        : `${lineItem.salesTaxRate}`,
  }));
}

function parseCcEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildDefaultsSignature(defaults: Partial<MercuryInvoicePayload> | undefined): string {
  return JSON.stringify({
    customerName: defaults?.customerName ?? '',
    customerEmail: defaults?.customerEmail ?? '',
    description: defaults?.description ?? '',
    amount: defaults?.amount ?? '',
    currency: defaults?.currency ?? '',
    destinationAccountId: defaults?.destinationAccountId ?? '',
    dueDateIso: defaults?.dueDateIso ?? '',
    invoiceDateIso: defaults?.invoiceDateIso ?? '',
    sendEmailOption: defaults?.sendEmailOption ?? '',
    achDebitEnabled: defaults?.achDebitEnabled ?? '',
    creditCardEnabled: defaults?.creditCardEnabled ?? '',
    useRealAccountNumber: defaults?.useRealAccountNumber ?? '',
    ccEmails: defaults?.ccEmails ?? [],
    lineItems: defaults?.lineItems ?? [],
  });
}

export function InvoiceWizard({
  accounts,
  onSubmit,
  busy = false,
  status,
  defaults,
  resetKey,
  title = 'Invoice Builder',
  subtitle = 'Full Mercury invoice controls, including routing, email behavior, payment rails, and structured line items.',
  submitLabel = 'Create Mercury Invoice',
  footer,
}: InvoiceWizardProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const useCompactLayout = viewportWidth < 980;
  const defaultsSignature = buildDefaultsSignature(defaults);

  const [customerName, setCustomerName] = useState(defaults?.customerName ?? '');
  const [customerEmail, setCustomerEmail] = useState(defaults?.customerEmail ?? '');
  const [description, setDescription] = useState(defaults?.description ?? '');
  const [amount, setAmount] = useState(
    typeof defaults?.amount === 'number' && Number.isFinite(defaults.amount)
      ? `${defaults.amount}`
      : '',
  );
  const [currency, setCurrency] = useState(defaults?.currency ?? 'USD');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    defaults?.destinationAccountId ?? accounts[0]?.id ?? null,
  );
  const [invoiceDateIso, setInvoiceDateIso] = useState(
    defaults?.invoiceDateIso ?? toDayInputValue(new Date()),
  );
  const [dueDateIso, setDueDateIso] = useState(
    defaults?.dueDateIso ??
      toDayInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  );
  const [sendEmailOption, setSendEmailOption] = useState<MercurySendEmailOption>(
    defaults?.sendEmailOption ?? 'SendNow',
  );
  const [achDebitEnabled, setAchDebitEnabled] = useState(defaults?.achDebitEnabled ?? true);
  const [creditCardEnabled, setCreditCardEnabled] = useState(defaults?.creditCardEnabled ?? false);
  const [useRealAccountNumber, setUseRealAccountNumber] = useState(
    defaults?.useRealAccountNumber ?? false,
  );
  const [ccEmailsInput, setCcEmailsInput] = useState((defaults?.ccEmails ?? []).join(', '));
  const [lineItemDrafts, setLineItemDrafts] = useState<LineItemDraft[]>(
    buildLineItemDrafts(defaults?.lineItems),
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
    setCurrency(defaults?.currency ?? 'USD');
    setSelectedAccountId(defaults?.destinationAccountId ?? accounts[0]?.id ?? null);
    setInvoiceDateIso(defaults?.invoiceDateIso ?? toDayInputValue(new Date()));
    setDueDateIso(
      defaults?.dueDateIso ??
        toDayInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    );
    setSendEmailOption(defaults?.sendEmailOption ?? 'SendNow');
    setAchDebitEnabled(defaults?.achDebitEnabled ?? true);
    setCreditCardEnabled(defaults?.creditCardEnabled ?? false);
    setUseRealAccountNumber(defaults?.useRealAccountNumber ?? false);
    setCcEmailsInput((defaults?.ccEmails ?? []).join(', '));
    setLineItemDrafts(buildLineItemDrafts(defaults?.lineItems));
  }, [accounts, defaults, defaultsSignature, resetKey]);

  useEffect(() => {
    if (!selectedAccountId && accounts[0]?.id) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const lineItemEvaluation = useMemo(() => {
    return lineItemDrafts.map((draft) => {
      const name = draft.name.trim();
      const quantityRaw = draft.quantity.trim();
      const unitPriceRaw = draft.unitPrice.trim();
      const salesTaxRateRaw = draft.salesTaxRate.trim();
      const hasAnyInput = Boolean(name || quantityRaw || unitPriceRaw || salesTaxRateRaw);

      if (!hasAnyInput) {
        return {
          id: draft.id,
          hasAnyInput: false,
          lineItem: null as MercuryLineItemPayload | null,
          subtotal: 0,
        };
      }

      const quantity = Number(quantityRaw);
      const unitPrice = Number(unitPriceRaw);
      const parsedTaxRate = salesTaxRateRaw ? Number(salesTaxRateRaw) : undefined;
      const hasValidQuantity = Number.isFinite(quantity) && quantity > 0;
      const hasValidUnitPrice = Number.isFinite(unitPrice) && unitPrice >= 0;
      const hasValidTaxRate =
        parsedTaxRate == null || (Number.isFinite(parsedTaxRate) && parsedTaxRate >= 0);

      if (!name || !hasValidQuantity || !hasValidUnitPrice || !hasValidTaxRate) {
        return {
          id: draft.id,
          hasAnyInput: true,
          lineItem: null as MercuryLineItemPayload | null,
          subtotal: 0,
        };
      }

      return {
        id: draft.id,
        hasAnyInput: true,
        lineItem: {
          name,
          quantity,
          unitPrice,
          salesTaxRate: parsedTaxRate,
        } as MercuryLineItemPayload,
        subtotal: quantity * unitPrice,
      };
    });
  }, [lineItemDrafts]);

  const hasInvalidLineItems = lineItemEvaluation.some(
    (entry) => entry.hasAnyInput && !entry.lineItem,
  );
  const lineItems = lineItemEvaluation
    .filter((entry): entry is typeof entry & { lineItem: MercuryLineItemPayload } =>
      Boolean(entry.lineItem),
    )
    .map((entry) => entry.lineItem);
  const lineItemsTotal = lineItemEvaluation.reduce((sum, entry) => sum + entry.subtotal, 0);

  const parsedAmount = Number(amount);
  const hasManualAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const resolvedAmount = hasManualAmount ? parsedAmount : lineItemsTotal;
  const ccEmails = parseCcEmails(ccEmailsInput);

  const payload = useMemo<MercuryInvoicePayload>(
    () => ({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      description: description.trim() || undefined,
      amount: resolvedAmount,
      currency: currency.trim().toUpperCase() || undefined,
      dueDateIso: dueDateIso.trim() || undefined,
      invoiceDateIso: invoiceDateIso.trim() || undefined,
      destinationAccountId: selectedAccountId ?? undefined,
      lineItems: lineItems.length > 0 ? lineItems : undefined,
      sendEmailOption,
      achDebitEnabled,
      creditCardEnabled,
      useRealAccountNumber,
      ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
    }),
    [
      achDebitEnabled,
      ccEmails,
      creditCardEnabled,
      currency,
      customerEmail,
      customerName,
      description,
      dueDateIso,
      invoiceDateIso,
      lineItems,
      resolvedAmount,
      selectedAccountId,
      sendEmailOption,
      useRealAccountNumber,
    ],
  );

  const canSubmit = Boolean(
    customerName.trim() &&
      customerEmail.trim() &&
      selectedAccountId &&
      resolvedAmount > 0 &&
      !hasInvalidLineItems,
  );

  return (
    <MercuryCard title={title} subtitle={subtitle}>
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

      <View style={{ flexDirection: useCompactLayout ? 'column' : 'row', gap: 8 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={labelStyle}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            style={inputStyle}
            keyboardType="decimal-pad"
            placeholder="Optional if line items are filled"
            placeholderTextColor={mercuryUiTheme.colors.mutedText}
          />
        </View>
        <View style={{ width: useCompactLayout ? '100%' : 120, gap: 8 }}>
          <Text style={labelStyle}>Currency</Text>
          <TextInput
            value={currency}
            onChangeText={setCurrency}
            style={inputStyle}
            autoCapitalize="characters"
            maxLength={3}
          />
        </View>
      </View>

      <View style={{ flexDirection: useCompactLayout ? 'column' : 'row', gap: 8 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={labelStyle}>Invoice date (YYYY-MM-DD)</Text>
          <TextInput
            value={invoiceDateIso}
            onChangeText={setInvoiceDateIso}
            style={inputStyle}
            autoCapitalize="none"
          />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={labelStyle}>Due date (YYYY-MM-DD)</Text>
          <TextInput
            value={dueDateIso}
            onChangeText={setDueDateIso}
            style={inputStyle}
            autoCapitalize="none"
          />
        </View>
      </View>

      <AccountsSelect
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
      />

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Send email option</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['SendNow', 'DontSend'] as const).map((option) => {
            const active = sendEmailOption === option;
            const optionLabel = option === 'SendNow' ? 'Send now' : 'Do not send';
            return (
              <Pressable
                key={option}
                onPress={() => setSendEmailOption(option)}
                style={{
                  borderWidth: 1,
                  borderColor: active ? mercuryUiTheme.colors.accent : mercuryUiTheme.colors.border,
                  borderRadius: 999,
                  backgroundColor: active
                    ? mercuryUiTheme.colors.accentSoft
                    : mercuryUiTheme.colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: active ? mercuryUiTheme.colors.accent : mercuryUiTheme.colors.text,
                    fontWeight: '700',
                    fontSize: 12,
                  }}
                >
                  {optionLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>CC emails (comma-separated)</Text>
        <TextInput
          value={ccEmailsInput}
          onChangeText={setCcEmailsInput}
          style={inputStyle}
          autoCapitalize="none"
          placeholder="ops@example.com, accounting@example.com"
          placeholderTextColor={mercuryUiTheme.colors.mutedText}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Payment options</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            {
              key: 'achDebitEnabled',
              label: `ACH debit: ${achDebitEnabled ? 'On' : 'Off'}`,
              active: achDebitEnabled,
              toggle: () => setAchDebitEnabled((value) => !value),
            },
            {
              key: 'creditCardEnabled',
              label: `Credit card: ${creditCardEnabled ? 'On' : 'Off'}`,
              active: creditCardEnabled,
              toggle: () => setCreditCardEnabled((value) => !value),
            },
            {
              key: 'useRealAccountNumber',
              label: `Real account number: ${useRealAccountNumber ? 'On' : 'Off'}`,
              active: useRealAccountNumber,
              toggle: () => setUseRealAccountNumber((value) => !value),
            },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={option.toggle}
              style={{
                borderWidth: 1,
                borderColor: option.active ? mercuryUiTheme.colors.accent : mercuryUiTheme.colors.border,
                borderRadius: 999,
                backgroundColor: option.active
                  ? mercuryUiTheme.colors.accentSoft
                  : mercuryUiTheme.colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  color: option.active ? mercuryUiTheme.colors.accent : mercuryUiTheme.colors.text,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={labelStyle}>Line items</Text>
          <Pressable
            onPress={() => setLineItemDrafts((current) => [...current, createLineItemDraft()])}
          >
            <Text style={{ color: mercuryUiTheme.colors.accent, fontWeight: '700' }}>
              Add line item
            </Text>
          </Pressable>
        </View>

        {lineItemDrafts.map((lineItemDraft, index) => (
          <View
            key={lineItemDraft.id}
            style={{
              borderWidth: 1,
              borderColor: mercuryUiTheme.colors.border,
              borderRadius: 14,
              backgroundColor: mercuryUiTheme.colors.surfaceMuted,
              padding: 10,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: mercuryUiTheme.colors.text, fontSize: 12, fontWeight: '700' }}>
                Item {index + 1}
              </Text>
              {lineItemDrafts.length > 1 ? (
                <Pressable
                  onPress={() =>
                    setLineItemDrafts((current) =>
                      current.filter((existing) => existing.id !== lineItemDraft.id),
                    )
                  }
                >
                  <Text style={{ color: mercuryUiTheme.colors.danger, fontSize: 12, fontWeight: '700' }}>
                    Remove
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <TextInput
              value={lineItemDraft.name}
              onChangeText={(value) =>
                setLineItemDrafts((current) =>
                  current.map((existing) =>
                    existing.id === lineItemDraft.id ? { ...existing, name: value } : existing,
                  ),
                )
              }
              style={inputStyle}
              placeholder="Name"
              placeholderTextColor={mercuryUiTheme.colors.mutedText}
            />

            <View style={{ flexDirection: useCompactLayout ? 'column' : 'row', gap: 8 }}>
              <TextInput
                value={lineItemDraft.quantity}
                onChangeText={(value) =>
                  setLineItemDrafts((current) =>
                    current.map((existing) =>
                      existing.id === lineItemDraft.id ? { ...existing, quantity: value } : existing,
                    ),
                  )
                }
                style={useCompactLayout ? inputStyle : { ...inputStyle, flex: 1, minWidth: 0 }}
                keyboardType="decimal-pad"
                placeholder="Qty"
                placeholderTextColor={mercuryUiTheme.colors.mutedText}
              />
              <TextInput
                value={lineItemDraft.unitPrice}
                onChangeText={(value) =>
                  setLineItemDrafts((current) =>
                    current.map((existing) =>
                      existing.id === lineItemDraft.id ? { ...existing, unitPrice: value } : existing,
                    ),
                  )
                }
                style={useCompactLayout ? inputStyle : { ...inputStyle, flex: 1, minWidth: 0 }}
                keyboardType="decimal-pad"
                placeholder="Unit price"
                placeholderTextColor={mercuryUiTheme.colors.mutedText}
              />
              <TextInput
                value={lineItemDraft.salesTaxRate}
                onChangeText={(value) =>
                  setLineItemDrafts((current) =>
                    current.map((existing) =>
                      existing.id === lineItemDraft.id ? { ...existing, salesTaxRate: value } : existing,
                    ),
                  )
                }
                style={useCompactLayout ? inputStyle : { ...inputStyle, flex: 1, minWidth: 0 }}
                keyboardType="decimal-pad"
                placeholder="Tax %"
                placeholderTextColor={mercuryUiTheme.colors.mutedText}
              />
            </View>
          </View>
        ))}

        <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 12 }}>
          Filled line items total: ${lineItemsTotal.toFixed(2)}. Manual amount overrides this total.
        </Text>
        {hasInvalidLineItems ? (
          <Text style={{ color: mercuryUiTheme.colors.danger, fontSize: 12 }}>
            Complete or clear partially filled line items before submitting.
          </Text>
        ) : null}
      </View>

      {status ? <MercuryStatusNotice message={status.message} tone={status.tone} /> : null}
      {footer}
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
          {busy ? 'Creating...' : submitLabel}
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
