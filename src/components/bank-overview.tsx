import { Text, useWindowDimensions, View } from 'react-native';
import {
  MercuryBankOverview,
  MercuryCustomerContactPanel,
} from '@mr.dj2u/mercury-ui';
import {
  mercuryCustomerContactAdapter,
  mercuryUiAdapter,
} from '@/services/mercury-ui-adapters';
import { showActionErrorAlert } from '@/services/system-alert';

export function BankOverview() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Bank</Text>
      <Text className="text-muted">
        Mercury checking visibility. Use this to confirm your account context before sending invoices.
      </Text>

      <View className="items-center">
        <View className="w-full" style={contentWidthStyle}>
          <View style={{ gap: 16 }}>
            <MercuryBankOverview adapter={mercuryUiAdapter} />
            <MercuryCustomerContactPanel
              adapter={mercuryCustomerContactAdapter}
              onError={showActionErrorAlert}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
