import { Pressable, Text, View } from 'react-native';
import type { MercuryInvoiceResponse } from '@mrdj/mercury';
import { MercuryBadge } from './mercury-badge';
import { mercuryUiTheme } from '../theme';

type InvoicesTableProps = {
  invoices: MercuryInvoiceResponse[];
  onSelectInvoice?: (invoice: MercuryInvoiceResponse) => void;
};

export function InvoicesTable({ invoices, onSelectInvoice }: InvoicesTableProps) {
  return (
    <View style={{ gap: 10 }}>
      {invoices.map((invoice) => (
        <Pressable
          key={invoice.id}
          onPress={() => onSelectInvoice?.(invoice)}
          style={{
            borderWidth: 1,
            borderColor: mercuryUiTheme.colors.border,
            borderRadius: 16,
            backgroundColor: mercuryUiTheme.colors.surface,
            padding: 12,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>
              {invoice.id}
            </Text>
            <MercuryBadge
              label={`${invoice.status ?? 'draft'}`}
              tone={invoice.status === 'paid' ? 'success' : 'neutral'}
            />
          </View>
          <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 12 }}>
            {`${invoice.hosted_url ?? invoice.hostedUrl ?? 'No hosted URL yet'}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
