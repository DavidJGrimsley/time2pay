import type { ReactNode } from 'react';
import type { MercuryAccount, MercuryInvoicePayload } from '@mrdj/mercury';
import { Text, View } from 'react-native';
import { InvoiceWizard, type InvoiceWizardStatus } from './invoice-wizard';
import { MercuryLogo } from './mercury-logo';

type Time2PayMercuryInvoiceBuilderProps = {
  accounts: MercuryAccount[];
  defaults?: Partial<MercuryInvoicePayload>;
  resetKey?: string | number;
  onSubmit: (payload: MercuryInvoicePayload) => Promise<void> | void;
  busy?: boolean;
  status?: InvoiceWizardStatus;
  sourceChildren?: ReactNode;
};

export function Time2PayMercuryInvoiceBuilder({
  accounts,
  defaults,
  resetKey,
  onSubmit,
  busy = false,
  status,
  sourceChildren,
}: Time2PayMercuryInvoiceBuilderProps) {
  return (
    <View
      className="gap-4 rounded-2xl border p-5"
      style={{ borderColor: '#314233', backgroundColor: '#0f1711' }}
    >
      <View className="gap-2">
        <MercuryLogo variant="horizontal" size={280} />
        <Text style={{ color: '#d4e0d0', fontSize: 15 }}>
          Time2Pay session-based invoice drafting with Mercury invoice settings layered on top.
        </Text>
      </View>

      {sourceChildren ? (
        <View
          className="rounded-2xl border p-4"
          style={{ borderColor: '#2f4333', backgroundColor: '#f6f8fb' }}
        >
          {sourceChildren}
        </View>
      ) : null}

      <InvoiceWizard
        accounts={accounts}
        defaults={defaults}
        resetKey={resetKey}
        onSubmit={onSubmit}
        busy={busy}
        status={status}
        title="Mercury invoice settings"
        subtitle="Session-derived defaults are fully editable before the Mercury invoice is created."
        submitLabel="Create Mercury Invoice"
      />
    </View>
  );
}
