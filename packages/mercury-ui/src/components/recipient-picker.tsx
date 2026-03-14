import { Pressable, Text, View } from 'react-native';
import type { MercuryRecipient } from '@mrdj/mercury';
import { MercuryBadge } from './mercury-badge';
import { mercuryUiTheme } from '../theme';

type RecipientPickerProps = {
  recipients: MercuryRecipient[];
  selectedRecipientId?: string | null;
  onSelect: (recipientId: string) => void;
};

export function RecipientPicker({
  recipients,
  selectedRecipientId,
  onSelect,
}: RecipientPickerProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: mercuryUiTheme.colors.text, fontSize: 13, fontWeight: '700' }}>
        Recipient
      </Text>
      {recipients.length === 0 ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: mercuryUiTheme.colors.border,
            borderRadius: 16,
            backgroundColor: mercuryUiTheme.colors.surfaceMuted,
            padding: 12,
            gap: 4,
          }}
        >
          <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>
            No recipients found
          </Text>
          <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 12 }}>
            Add a recipient in Mercury first, then reload this page.
          </Text>
        </View>
      ) : null}
      {recipients.map((recipient) => {
        const recipientId = recipient.id ?? `recipient_${recipient.name ?? 'unknown'}`;
        const active = recipientId === selectedRecipientId;

        return (
          <Pressable
            key={recipientId}
            onPress={() => onSelect(recipientId)}
            style={{
              borderWidth: 1,
              borderColor: active ? mercuryUiTheme.colors.accent : mercuryUiTheme.colors.border,
              borderRadius: 16,
              backgroundColor: active ? mercuryUiTheme.colors.accentSoft : mercuryUiTheme.colors.surfaceMuted,
              padding: 12,
              gap: 4,
            }}
          >
            <Text style={{ color: mercuryUiTheme.colors.text, fontWeight: '700' }}>
              {recipient.name ?? 'Recipient'}
            </Text>
            <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 12 }}>
              {recipient.email ?? recipientId}
            </Text>
            {active ? <MercuryBadge label="Selected" tone="accent" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
