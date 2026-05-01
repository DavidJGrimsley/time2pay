import { Text, View } from 'react-native';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import { ControlledMercurySendMoneyWorkflow } from '@/components/controlled-mercury-send-money-workflow';
import { MercuryKeyGate } from '@/components/mercury-key-gate';
import { mercuryUiAdapter } from '@/services/mercury-ui-adapters';
import { showActionErrorAlert } from '@/services/system-alert';

export function PaymentsOverview() {
  const { width } = useStableWindowDimensions();
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
          <MercuryKeyGate>
            <ControlledMercurySendMoneyWorkflow
              adapter={mercuryUiAdapter}
              onError={showActionErrorAlert}
            />
          </MercuryKeyGate>
        </View>
      </View>
    </View>
  );
}
