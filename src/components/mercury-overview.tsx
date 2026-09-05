import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { BankOverview } from '@/components/bank-overview';
import { PaymentsOverview } from '@/components/payments-overview';

type MercurySection = 'bank' | 'payments';

function resolveSection(value: string | string[] | undefined): MercurySection {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'payments' ? 'payments' : 'bank';
}

/**
 * Combined Bank + Payments workspace. `@mr.dj2u/mercury-ui` ships a single static
 * light palette (`mercuryUiTheme`) with no appearance prop, so kit surfaces stay
 * light until that package grows a theme API.
 */
export function MercuryOverview() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const activeSection = resolveSection(section);

  function selectSection(next: MercurySection): void {
    if (next === 'payments') {
      router.replace({ pathname: '/mercury', params: { section: 'payments' } });
      return;
    }

    router.replace('/mercury');
  }

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Mercury</Text>
      <Text className="text-muted">
        Mercury checking and send-money tools in one place. Bank confirms account context; Payments
        moves money to recipients.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeSection === 'bank' }}
          onPress={() => selectSection('bank')}
          className={
            activeSection === 'bank'
              ? 'rounded-full bg-secondary px-3.5 py-2'
              : 'rounded-full border border-border px-3.5 py-2'
          }
        >
          <Text
            className={
              activeSection === 'bank' ? 'font-semibold text-white' : 'font-semibold text-heading'
            }
          >
            Bank
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeSection === 'payments' }}
          onPress={() => selectSection('payments')}
          className={
            activeSection === 'payments'
              ? 'rounded-full bg-secondary px-3.5 py-2'
              : 'rounded-full border border-border px-3.5 py-2'
          }
        >
          <Text
            className={
              activeSection === 'payments'
                ? 'font-semibold text-white'
                : 'font-semibold text-heading'
            }
          >
            Payments
          </Text>
        </Pressable>
      </View>
      {activeSection === 'payments' ? (
        <PaymentsOverview showHeader={false} />
      ) : (
        <BankOverview showHeader={false} />
      )}
    </View>
  );
}
