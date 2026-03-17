import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { MercuryRecipient } from '@/services/mercury';
import {
  createMercuryRecipient,
  updateMercuryRecipient,
} from '@/services/mercury';
import {
  MercuryCard,
  MercuryStatusNotice,
  type MercuryStatusTone,
  mercuryUiTheme,
} from '@mrdj/mercury-ui';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

type MercuryRecipientManagerProps = {
  recipients: MercuryRecipient[];
  busy?: boolean;
  onRecipientsChanged?: () => Promise<void> | void;
};

type StatusState = {
  message: string;
  tone: MercuryStatusTone;
};

const RECIPIENT_READ_ONLY_KEYS = new Set([
  'id',
  'status',
  'createdAt',
  'updatedAt',
  'dateLastPaid',
]);

function buildPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildEditableRecipientPayload(recipient: MercuryRecipient): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(recipient)) {
    if (RECIPIENT_READ_ONLY_KEYS.has(key) || value == null) {
      continue;
    }
    patch[key] = value;
  }

  return patch;
}

export function MercuryRecipientManager({
  recipients,
  busy = false,
  onRecipientsChanged,
}: MercuryRecipientManagerProps) {
  const { width } = useWindowDimensions();
  const compact = width < 980;
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    recipients[0]?.id ? `${recipients[0].id}` : null,
  );
  const [payloadText, setPayloadText] = useState('{\n  \n}');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    message:
      'Create or update recipients with raw Mercury recipient JSON. This stays flexible while the schema is still evolving.',
    tone: 'neutral',
  });

  const selectedRecipient = useMemo(
    () =>
      recipients.find((recipient) => `${recipient.id ?? ''}` === `${selectedRecipientId ?? ''}`) ??
      null,
    [recipients, selectedRecipientId],
  );

  function parsePayload(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(payloadText) as Record<string, unknown>;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Recipient payload must be a JSON object.');
      }
      return parsed;
    } catch (error: unknown) {
      const rawMessage =
        error instanceof Error ? error.message : 'Recipient payload must be valid JSON.';
      const message = rawMessage.includes('JSON')
        ? `${rawMessage} Check quotes and remove any trailing commas.`
        : rawMessage;
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return null;
    }
  }

  async function handleCreate(): Promise<void> {
    const payload = parsePayload();
    if (!payload) {
      return;
    }

    setIsSaving(true);
    try {
      const recipient = await createMercuryRecipient(payload);
      setStatus({
        message: `Recipient ${recipient.name ?? recipient.id ?? 'created'} created successfully.`,
        tone: 'success',
      });
      setPayloadText('{\n  \n}');
      await onRecipientsChanged?.();
      if (recipient.id) {
        setSelectedRecipientId(`${recipient.id}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create Mercury recipient.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!selectedRecipientId) {
      const message = 'Select a recipient before updating.';
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    const payload = parsePayload();
    if (!payload) {
      return;
    }

    setIsSaving(true);
    try {
      const recipient = await updateMercuryRecipient(selectedRecipientId, payload);
      setStatus({
        message: `Recipient ${recipient.name ?? recipient.id ?? selectedRecipientId} updated successfully.`,
        tone: 'success',
      });
      await onRecipientsChanged?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update Mercury recipient.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <MercuryCard
      title="Recipient Manager"
      subtitle="Paste a valid Mercury recipient JSON payload to create or patch a recipient without leaving Time2Pay."
    >
      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Selected recipient</Text>
        <View style={{ flexDirection: compact ? 'column' : 'row', flexWrap: 'wrap', gap: 8 }}>
          {recipients.map((recipient) => {
            const recipientId = `${recipient.id ?? recipient.name ?? 'recipient'}`;
            const active = recipientId === selectedRecipientId;
            return (
              <Pressable
                key={recipientId}
                onPress={() => setSelectedRecipientId(recipientId)}
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
                  {recipient.name ?? recipientId}
                </Text>
              </Pressable>
            );
          })}
          {recipients.length === 0 ? (
            <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 12 }}>
              No recipients loaded yet.
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 8 }}>
        <Pressable
          onPress={() => setPayloadText('{\n  \n}')}
          style={secondaryButtonStyle}
        >
          <Text style={secondaryButtonTextStyle}>Reset JSON</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            setPayloadText(
              selectedRecipient
                ? buildPrettyJson(buildEditableRecipientPayload(selectedRecipient))
                : '{\n  \n}',
            )
          }
          style={secondaryButtonStyle}
        >
          <Text style={secondaryButtonTextStyle}>Load editable recipient JSON</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Recipient payload JSON</Text>
        <TextInput
          value={payloadText}
          onChangeText={setPayloadText}
          multiline
          textAlignVertical="top"
          style={jsonInputStyle}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy && !isSaving}
        />
        <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 12, lineHeight: 18 }}>
          Tip: the loader now strips obvious read-only fields, but Mercury may still reject fields it
          does not allow for updates. If that happens, keep only the patch you actually want to send.
        </Text>
      </View>

      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 8 }}>
        <Pressable
          onPress={handleCreate}
          disabled={busy || isSaving}
          style={primaryButtonStyle}
        >
          <Text style={primaryButtonTextStyle}>
            {isSaving ? 'Saving...' : 'Create recipient'}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleUpdate}
          disabled={busy || isSaving || !selectedRecipientId}
          style={{
            ...secondaryButtonStyle,
            opacity: !selectedRecipientId ? 0.6 : 1,
          }}
        >
          <Text style={secondaryButtonTextStyle}>Update selected recipient</Text>
        </Pressable>
      </View>

      <MercuryStatusNotice message={status.message} tone={status.tone} />
    </MercuryCard>
  );
}

const labelStyle = {
  color: mercuryUiTheme.colors.text,
  fontWeight: '700' as const,
};

const primaryButtonStyle = {
  borderRadius: 16,
  backgroundColor: mercuryUiTheme.colors.accent,
  paddingVertical: 12,
  paddingHorizontal: 16,
  alignItems: 'center' as const,
};

const primaryButtonTextStyle = {
  color: '#ffffff',
  fontWeight: '700' as const,
};

const secondaryButtonStyle = {
  borderRadius: 16,
  borderWidth: 1,
  borderColor: mercuryUiTheme.colors.border,
  backgroundColor: mercuryUiTheme.colors.surface,
  paddingVertical: 12,
  paddingHorizontal: 16,
  alignItems: 'center' as const,
};

const secondaryButtonTextStyle = {
  color: mercuryUiTheme.colors.text,
  fontWeight: '700' as const,
};

const jsonInputStyle = {
  borderWidth: 1,
  borderColor: mercuryUiTheme.colors.border,
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 12,
  color: mercuryUiTheme.colors.text,
  backgroundColor: mercuryUiTheme.colors.surface,
  minHeight: 220,
  fontFamily: 'monospace',
};
