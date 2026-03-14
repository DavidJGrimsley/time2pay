import { Text, View } from 'react-native';
import { mercuryUiTheme } from '../theme';

export type MercuryStatusTone = 'neutral' | 'success' | 'error';

type MercuryStatusNoticeProps = {
  message: string;
  tone?: MercuryStatusTone;
};

const paletteByTone = {
  neutral: {
    backgroundColor: mercuryUiTheme.colors.neutralSoft,
    borderColor: mercuryUiTheme.colors.border,
    color: mercuryUiTheme.colors.text,
  },
  success: {
    backgroundColor: mercuryUiTheme.colors.successSoft,
    borderColor: '#b6e5cf',
    color: mercuryUiTheme.colors.success,
  },
  error: {
    backgroundColor: mercuryUiTheme.colors.dangerSoft,
    borderColor: '#f2c5c5',
    color: mercuryUiTheme.colors.danger,
  },
} as const;

export function MercuryStatusNotice({ message, tone = 'neutral' }: MercuryStatusNoticeProps) {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  const palette = paletteByTone[tone];

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: palette.borderColor,
        backgroundColor: palette.backgroundColor,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: palette.color, fontSize: 13 }}>{trimmed}</Text>
    </View>
  );
}
