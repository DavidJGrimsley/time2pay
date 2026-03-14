import { Text, useWindowDimensions, View } from 'react-native';
import { MercurySendMoneyWorkflow } from './mercury-send-money-workflow';

export function PaymentsOverview() {
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
      <Text className="text-3xl font-extrabold text-heading">Payments</Text>
      <Text className="text-muted">
        Move money through Mercury using recipient-aware send-money workflows.
      </Text>
      <View className="items-center">
        <View className="w-full gap-3" style={contentWidthStyle}>
          <MercurySendMoneyWorkflow />
        </View>
      </View>
    </View>
  );
}
