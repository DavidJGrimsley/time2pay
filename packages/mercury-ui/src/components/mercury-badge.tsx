import { Text, View } from 'react-native';
import { mercuryUiTheme } from '../theme';

export type MercuryBadgeTone = 'neutral' | 'accent' | 'success' | 'danger';

type MercuryBadgeProps = {
  label: string;
  tone?: MercuryBadgeTone;
};

const paletteByTone = {
  neutral: {
    backgroundColor: mercuryUiTheme.colors.neutralSoft,
    color: mercuryUiTheme.colors.text,
  },
  accent: {
    backgroundColor: mercuryUiTheme.colors.accentSoft,
    color: mercuryUiTheme.colors.accent,
  },
  success: {
    backgroundColor: mercuryUiTheme.colors.successSoft,
    color: mercuryUiTheme.colors.success,
  },
  danger: {
    backgroundColor: mercuryUiTheme.colors.dangerSoft,
    color: mercuryUiTheme.colors.danger,
  },
} as const;

export function MercuryBadge({ label, tone = 'neutral' }: MercuryBadgeProps) {
  const palette = paletteByTone[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: mercuryUiTheme.radius.pill,
        backgroundColor: palette.backgroundColor,
      }}
    >
      <Text style={{ color: palette.color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
