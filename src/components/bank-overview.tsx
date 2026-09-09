import { Text, View } from 'react-native';
import {
  MercuryCustomerContactPanel,
} from '@mr.dj2u/mercury-ui';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import { ControlledMercuryBankOverview } from '@/components/controlled-mercury-bank-overview';
import { MercuryPoweredBy } from '@/components/mercury-disclosure';
import { MercuryKeyGate } from '@/components/mercury-key-gate';
import {
  mercuryCustomerContactAdapter,
  mercuryUiAdapter,
} from '@/services/mercury-ui-adapters';
import { showActionErrorAlert } from '@/services/system-alert';

export function BankOverview({ showHeader = true }: { showHeader?: boolean }) {
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
      {showHeader ? (
        <>
          <Text className="text-3xl font-extrabold text-heading">Bank</Text>
          <Text className="text-muted">
            Mercury checking visibility. Use this to confirm your account context before sending invoices.
          </Text>
        </>
      ) : null}

      <View className="items-center">
        <View className="w-full" style={contentWidthStyle}>
          <View style={{ gap: 16 }}>
            <MercuryKeyGate headerAccessory={<MercuryPoweredBy />} requirement="read">
              <ControlledMercuryBankOverview adapter={mercuryUiAdapter} />
            </MercuryKeyGate>
            <MercuryKeyGate requirement="advanced">
              <MercuryCustomerContactPanel
                adapter={mercuryCustomerContactAdapter}
                onError={showActionErrorAlert}
              />
            </MercuryKeyGate>
          </View>
        </View>
      </View>
    </View>
  );
}
