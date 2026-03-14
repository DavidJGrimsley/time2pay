import { Pressable, Text, View } from 'react-native';
import type { MercuryAccount } from '@mrdj/mercury';
import { MercuryBadge } from './mercury-badge';
import { mercuryUiTheme } from '../theme';

type AccountsSelectProps = {
  accounts: MercuryAccount[];
  selectedAccountId?: string | null;
  onSelect: (accountId: string) => void;
  label?: string;
};

export function AccountsSelect({
  accounts,
  selectedAccountId,
  onSelect,
  label = 'Destination account',
}: AccountsSelectProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: mercuryUiTheme.colors.text, fontSize: 13, fontWeight: '700' }}>
        {label}
      </Text>
      <View style={{ gap: 8 }}>
        {accounts.map((account) => {
          const accountId = account.id ?? `account_${account.name ?? 'unknown'}`;
          const active = accountId === selectedAccountId;

          return (
            <Pressable
              key={accountId}
              onPress={() => onSelect(accountId)}
              style={{
                borderWidth: 1,
                borderColor: active ? mercuryUiTheme.colors.accent : mercuryUiTheme.colors.border,
                borderRadius: 16,
                backgroundColor: active ? mercuryUiTheme.colors.accentSoft : mercuryUiTheme.colors.surface,
                padding: 12,
                gap: 4,
              }}
            >
              <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>
                {account.nickname ?? account.name ?? 'Mercury account'}
              </Text>
              <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 12 }}>
                {accountId}
              </Text>
              {active ? <MercuryBadge label="Selected" tone="accent" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
