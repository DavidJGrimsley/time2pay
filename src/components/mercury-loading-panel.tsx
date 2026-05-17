import { Text, View } from 'react-native';
import { MercuryLogo } from '@mr.dj2u/mercury-ui';
import { CosmosLoadingAnimation } from '@/components/UI/Loading';

type MercuryLoadingPanelProps = {
  subtitle: string;
  message: string;
};

export function MercuryLoadingPanel({ subtitle, message }: MercuryLoadingPanelProps) {
  return (
    <View
      style={{
        gap: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#314233',
        backgroundColor: '#0f1711',
        padding: 20,
      }}
    >
      <View style={{ gap: 8 }}>
        <MercuryLogo variant="horizontal" size={280} />
        <Text style={{ color: '#d4e0d0', fontSize: 15 }}>{subtitle}</Text>
      </View>

      <View
        style={{
          alignItems: 'center',
          gap: 12,
          borderWidth: 1,
          borderColor: '#2f4333',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 18,
          backgroundColor: '#121c14',
        }}
      >
        <CosmosLoadingAnimation size={72} />
        <Text style={{ color: '#d4e0d0', fontSize: 14, textAlign: 'center' }}>{message}</Text>
      </View>
    </View>
  );
}
