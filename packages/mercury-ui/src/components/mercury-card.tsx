import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { mercuryUiTheme } from '../theme';

type MercuryCardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function MercuryCard({ title, subtitle, children }: MercuryCardProps) {
  return (
    <View
      style={{
        backgroundColor: mercuryUiTheme.colors.surface,
        borderColor: mercuryUiTheme.colors.border,
        borderWidth: 1,
        borderRadius: mercuryUiTheme.radius.card,
        padding: 16,
        gap: 12,
      }}
    >
      {title ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: mercuryUiTheme.colors.text, fontSize: 18, fontWeight: '700' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: mercuryUiTheme.colors.mutedText, fontSize: 13 }}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
